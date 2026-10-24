// Resolución del header Authorization de /mcp a un McpPrincipal.
//
// - `atl_pat_…`: token personal → mcp_personal_token por SHA-256 (hex); no revocado ni vencido.
// - `atl_oat_…`: access token opaco de @better-auth/oauth-provider. El plugin guarda
//   `base64url(sha256(token sin prefijo))` sin padding (su `defaultHasher`, storeTokens
//   "hashed"); aquí se replica para buscarlo en oauth_access_token, con expires_at > ahora y
//   el cliente sin deshabilitar. Si el plugin cambia su formato, el test de integración
//   del flujo OAuth (test/integration/oauth.itest.ts) lo detecta.
// - Cualquier otro prefijo se rechaza sin tocar la BD.
//
// El repositorio es inyectable (tests unitarios con un AuthRepo falso). Nunca se loguea el
// token: quien llama solo recibe el motivo del rechazo.

import { createHash } from "node:crypto"
import type { DB } from "@atleta/db/client"
import { mcpPersonalToken, oauthAccessToken, oauthClient, user } from "@atleta/db/schema"
import { eq } from "drizzle-orm"
import { hashPersonalToken, isPersonalToken, shouldTouchPat } from "./personal-tokens"
import { MCP_SCOPES, type McpPrincipal, type McpScope } from "./types"

export const OAUTH_ACCESS_TOKEN_PREFIX = "atl_oat_"
export const OAUTH_REFRESH_TOKEN_PREFIX = "atl_ort_"
export const OAUTH_CLIENT_SECRET_PREFIX = "atl_ocs_"

// Los tokens que emitimos son base64url/alfanuméricos; cualquier otra cosa es basura
const TOKEN_RE = /^[A-Za-z0-9_-]{16,512}$/

export type PatRow = {
  id: string
  userId: string
  scopes: string[]
  expiresAt: Date | null
  revokedAt: Date | null
  lastUsedAt: Date | null
}

export type OAuthTokenRow = {
  id: string
  userId: string | null
  clientId: string
  scopes: string[]
  expiresAt: Date | null
  clientDisabled: boolean
}

export type AuthRepo = {
  findPat(hash: string): Promise<PatRow | null>
  touchPat(id: string, at: Date): Promise<void>
  findOAuthToken(hash: string): Promise<OAuthTokenRow | null>
  findUser(id: string): Promise<McpPrincipal["user"] | null>
}

export type AuthFailureReason =
  | "missing"
  | "malformed"
  | "unknown_prefix"
  | "not_found"
  | "revoked"
  | "expired"
  | "client_disabled"
  | "user_not_found"

export type AuthResult = { ok: true; principal: McpPrincipal } | { ok: false; reason: AuthFailureReason }

/** Hash con el que @better-auth/oauth-provider 1.6.9 guarda tokens (SHA-256, base64url sin padding). */
export function hashOAuthToken(tokenWithoutPrefix: string): string {
  return createHash("sha256").update(tokenWithoutPrefix, "utf8").digest("base64url")
}

/** Solo los scopes del MCP (offline_access u otros no dan permisos sobre herramientas). */
export function toMcpScopes(scopes: readonly string[]): ReadonlySet<McpScope> {
  return new Set(scopes.filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s)))
}

/** Extrae el token de `Bearer <token>`; null si el header no tiene esa forma. */
export function parseBearer(authorization: string | undefined): string | null | undefined {
  if (authorization === undefined || authorization.trim() === "") return undefined
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(authorization.trim())
  if (!match || !TOKEN_RE.test(match[1]!)) return null
  return match[1]!
}

export async function resolveMcpAuth(authorization: string | undefined, repo: AuthRepo, now: Date = new Date()): Promise<AuthResult> {
  const token = parseBearer(authorization)
  if (token === undefined) return { ok: false, reason: "missing" }
  if (token === null) return { ok: false, reason: "malformed" }

  if (isPersonalToken(token)) {
    const row = await repo.findPat(hashPersonalToken(token))
    if (!row) return { ok: false, reason: "not_found" }
    if (row.revokedAt) return { ok: false, reason: "revoked" }
    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" }
    const u = await repo.findUser(row.userId)
    if (!u) return { ok: false, reason: "user_not_found" }
    if (shouldTouchPat(row.lastUsedAt, now)) {
      // No bloquea la autenticación si falla: solo es informativo
      await repo.touchPat(row.id, now).catch(() => {})
    }
    return {
      ok: true,
      principal: {
        kind: "pat",
        user: u,
        scopes: toMcpScopes(row.scopes),
        tokenId: row.id,
        ...(row.expiresAt && { expiresAt: row.expiresAt }),
      },
    }
  }

  if (token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
    const raw = token.slice(OAUTH_ACCESS_TOKEN_PREFIX.length)
    if (!raw) return { ok: false, reason: "malformed" }
    const row = await repo.findOAuthToken(hashOAuthToken(raw))
    if (!row || !row.userId) return { ok: false, reason: "not_found" }
    if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" }
    if (row.clientDisabled) return { ok: false, reason: "client_disabled" }
    const u = await repo.findUser(row.userId)
    if (!u) return { ok: false, reason: "user_not_found" }
    return {
      ok: true,
      principal: {
        kind: "oauth",
        user: u,
        scopes: toMcpScopes(row.scopes),
        tokenId: row.id,
        clientId: row.clientId,
        expiresAt: row.expiresAt,
      },
    }
  }

  return { ok: false, reason: "unknown_prefix" }
}

/** Principal del header Authorization, o null si no es válido (contrato de docs/mcp.md). */
export async function resolveMcpPrincipal(authorization: string | undefined, repo: AuthRepo, now?: Date): Promise<McpPrincipal | null> {
  const result = await resolveMcpAuth(authorization, repo, now)
  return result.ok ? result.principal : null
}

/** AuthRepo sobre Postgres (Drizzle). */
export function createAuthRepo(db: DB): AuthRepo {
  return {
    async findPat(hash) {
      const [row] = await db
        .select({
          id: mcpPersonalToken.id,
          userId: mcpPersonalToken.userId,
          scopes: mcpPersonalToken.scopes,
          expiresAt: mcpPersonalToken.expiresAt,
          revokedAt: mcpPersonalToken.revokedAt,
          lastUsedAt: mcpPersonalToken.lastUsedAt,
        })
        .from(mcpPersonalToken)
        .where(eq(mcpPersonalToken.tokenHash, hash))
        .limit(1)
      return row ?? null
    },
    async touchPat(id, at) {
      await db.update(mcpPersonalToken).set({ lastUsedAt: at }).where(eq(mcpPersonalToken.id, id))
    },
    async findOAuthToken(hash) {
      const [row] = await db
        .select({
          id: oauthAccessToken.id,
          userId: oauthAccessToken.userId,
          clientId: oauthAccessToken.clientId,
          scopes: oauthAccessToken.scopes,
          expiresAt: oauthAccessToken.expiresAt,
          disabled: oauthClient.disabled,
        })
        .from(oauthAccessToken)
        .innerJoin(oauthClient, eq(oauthClient.clientId, oauthAccessToken.clientId))
        .where(eq(oauthAccessToken.token, hash))
        .limit(1)
      if (!row) return null
      const { disabled, ...rest } = row
      return { ...rest, clientDisabled: disabled === true }
    },
    async findUser(id) {
      const [row] = await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, id))
        .limit(1)
      return row ?? null
    },
  }
}
