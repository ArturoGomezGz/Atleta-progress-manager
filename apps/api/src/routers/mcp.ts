import { db } from "@atleta/db/client"
import { mcpPersonalToken, oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm"
import { z } from "zod"
import { createRateLimiter } from "../lib/rate-limit"
import { mcpResourceUrl } from "../mcp/config"
import {
  MAX_ACTIVE_PATS,
  PAT_DEFAULT_EXPIRY_DAYS,
  PAT_EXPIRY_DAYS,
  generatePersonalToken,
  patExpiresAt,
  type PatExpiryDays,
} from "../mcp/personal-tokens"
import { MCP_SCOPES, type McpScope } from "../mcp/types"
import { featureProcedure, router } from "../trpc"

// Conector MCP (flag `mcp`): URL del conector, tokens personales (PAT) y apps OAuth
// conectadas. Lo usa la página web "Conectar IA" (/settings/conectar-ia). Ver docs/mcp.md.

// Crear PAT: 10 por usuario al día (además del máximo de MAX_ACTIVE_PATS activos)
const createTokenLimiter = createRateLimiter({ max: 10, windowMs: 24 * 60 * 60_000 })

// Un token MCP no administra tokens ni apps: estas rutas solo se usan con la sesión web.
// (Las herramientas MCP llaman a tRPC con una sesión sintética `mcp_<kind>_<id>`.)
const webOnlyProcedure = featureProcedure("mcp").use(({ ctx, next }) => {
  if (ctx.session.session.id.startsWith("mcp_")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Los tokens del conector no pueden administrar tokens ni apps conectadas" })
  }
  return next()
})

const expiryDaysSchema = z
  .union([z.literal(PAT_EXPIRY_DAYS[0]), z.literal(PAT_EXPIRY_DAYS[1]), z.literal(PAT_EXPIRY_DAYS[2]), z.null()])
  .default(PAT_DEFAULT_EXPIRY_DAYS)

// atleta:write sin atleta:read no tiene sentido (las escrituras leen antes): se agrega
function normalizeScopes(scopes: McpScope[]): McpScope[] {
  const set = new Set(scopes)
  if (set.has("atleta:write")) set.add("atleta:read")
  return MCP_SCOPES.filter((s) => set.has(s))
}

function activeTokenWhere(userId: string, now: Date) {
  return and(
    eq(mcpPersonalToken.userId, userId),
    isNull(mcpPersonalToken.revokedAt),
    or(isNull(mcpPersonalToken.expiresAt), gt(mcpPersonalToken.expiresAt, now)),
  )
}

export const mcpRouter = router({
  // URL que se pega en el cliente (Claude, ChatGPT…) y scopes disponibles
  connectionInfo: webOnlyProcedure.query(() => ({
    mcpUrl: mcpResourceUrl(),
    scopes: [...MCP_SCOPES],
  })),

  // Tokens personales no revocados (incluye vencidos, para que se vean como tales)
  listTokens: webOnlyProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: mcpPersonalToken.id,
        name: mcpPersonalToken.name,
        prefix: mcpPersonalToken.tokenPrefix,
        scopes: mcpPersonalToken.scopes,
        createdAt: mcpPersonalToken.createdAt,
        lastUsedAt: mcpPersonalToken.lastUsedAt,
        expiresAt: mcpPersonalToken.expiresAt,
      })
      .from(mcpPersonalToken)
      .where(and(eq(mcpPersonalToken.userId, ctx.session.user.id), isNull(mcpPersonalToken.revokedAt)))
      .orderBy(desc(mcpPersonalToken.createdAt))
  }),

  // Crea un token; el valor completo solo se devuelve aquí (se guarda su hash)
  createToken: webOnlyProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        scopes: z.array(z.enum(MCP_SCOPES as [McpScope, ...McpScope[]])).min(1),
        expiresInDays: expiryDaysSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const now = new Date()

      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(mcpPersonalToken)
        .where(activeTokenWhere(userId, now))
      if (count >= MAX_ACTIVE_PATS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ya tienes ${MAX_ACTIVE_PATS} tokens activos. Revoca alguno para crear otro.`,
        })
      }

      const limit = createTokenLimiter.hit(userId)
      if (!limit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Creaste demasiados tokens hoy. Intenta de nuevo en ${Math.ceil(limit.retryAfterSeconds / 3600)} h.`,
        })
      }

      const { token, hash, prefix } = generatePersonalToken()
      const expiresAt = patExpiresAt(input.expiresInDays as PatExpiryDays, now)
      const [row] = await db
        .insert(mcpPersonalToken)
        .values({ userId, name: input.name, tokenHash: hash, tokenPrefix: prefix, scopes: normalizeScopes(input.scopes), expiresAt })
        .returning({ id: mcpPersonalToken.id })
      ctx.log.info({ mcp: { userId, tokenId: row!.id } }, "[mcp] token personal creado")
      return { id: row!.id, token, prefix, expiresAt }
    }),

  revokeToken: webOnlyProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const rows = await db
      .update(mcpPersonalToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(mcpPersonalToken.id, input.id), eq(mcpPersonalToken.userId, ctx.session.user.id), isNull(mcpPersonalToken.revokedAt)))
      .returning({ id: mcpPersonalToken.id })
    if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Token no encontrado" })
    ctx.log.info({ mcp: { userId: ctx.session.user.id, tokenId: input.id } }, "[mcp] token personal revocado")
    return { ok: true as const }
  }),

  // Apps OAuth a las que el usuario dio consentimiento (Claude, ChatGPT…)
  listConnectedApps: webOnlyProcedure.query(async ({ ctx }) => {
    return db
      .select({
        clientId: oauthConsent.clientId,
        name: oauthClient.name,
        uri: oauthClient.uri,
        icon: oauthClient.icon,
        scopes: oauthConsent.scopes,
        connectedAt: oauthConsent.createdAt,
        updatedAt: oauthConsent.updatedAt,
      })
      .from(oauthConsent)
      .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
      .where(eq(oauthConsent.userId, ctx.session.user.id))
      .orderBy(desc(oauthConsent.updatedAt))
  }),

  // Desconecta una app: borra sus tokens (acceso y refresh) y el consentimiento de este usuario.
  // El siguiente uso del token responde 401 y la app tendrá que pedir permiso de nuevo.
  revokeApp: webOnlyProcedure.input(z.object({ clientId: z.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const removed = await db.transaction(async (tx) => {
      await tx.delete(oauthAccessToken).where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, input.clientId)))
      await tx.delete(oauthRefreshToken).where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, input.clientId)))
      return tx
        .delete(oauthConsent)
        .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, input.clientId)))
        .returning({ id: oauthConsent.id })
    })
    if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Esa app no está conectada a tu cuenta" })
    ctx.log.info({ mcp: { userId, clientId: input.clientId } }, "[mcp] app desconectada")
    return { ok: true as const }
  }),
})
