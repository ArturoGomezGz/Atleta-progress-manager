// Capa HTTP del conector MCP sobre el Fastify de la API (Paquete B):
//   POST /mcp                       Streamable HTTP stateless (un McpServer + transporte por request)
//   GET|DELETE /mcp                 405 (sin stream SSE ni sesiones)
//   GET /.well-known/oauth-protected-resource[/mcp]       Protected Resource Metadata (RFC 9728)
//   GET /.well-known/oauth-authorization-server[/api/auth] metadata del AS (RFC 8414; el web la
//                                   proxea con el rewrite /.well-known/:path*)
//
// Orden de las comprobaciones de POST /mcp (hook onRequest, antes de leer el cuerpo):
//   Origin (anti DNS-rebinding) → token (401 + WWW-Authenticate) → scopes (403) → flag `mcp`
//   (403, JSON-RPC -32001) → tasa por usuario (429 + Retry-After). Luego Fastify parsea el
//   cuerpo (máx. 256 KB → 413), el handler rechaza los batches JSON-RPC (400, -32600) y entrega
//   la request al transporte del SDK.
// Logs: una línea por request ("[mcp] request") y los fallos de auth con warn y solo el
// motivo; nunca tokens, argumentos ni contenido. Ver docs/mcp.md ("Seguridad").

import type { IncomingMessage } from "node:http"
import { db } from "@atleta/db/client"
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"
import type { FastifyCorsOptions } from "@fastify/cors"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { fromNodeHeaders } from "better-auth/node"
import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { auth } from "../auth"
import { WEB_PROXY_HEADER } from "../lib/client-ip"
import { activeFeatures, hasFeature } from "../lib/features"
import { createRateLimiter, type RateLimiter } from "../lib/rate-limit"
import { createAuthRepo, resolveMcpAuth, type AuthRepo } from "./auth"
import {
  OAUTH_SCOPES,
  allowedOrigins,
  apiPublicUrl,
  authIssuer,
  isOriginAllowed,
  mcpResourceUrl,
  protectedResourceMetadataUrl,
  webUrl,
} from "./config"
import { createMcpCaller } from "./context"
import { createMcpServer } from "./server"
import { MCP_SCOPES, type McpLimiters, type McpPrincipal, type McpToolContext } from "./types"

/** Límite del cuerpo de POST /mcp. */
export const MCP_BODY_LIMIT = 256 * 1024
/** Código JSON-RPC cuando el usuario no tiene el flag `mcp`. */
export const MCP_FEATURE_DISABLED_CODE = -32001

export type McpHttpLimiters = McpLimiters & {
  /** Requests a /mcp por usuario (120/min). */
  request: RateLimiter
}

export type McpHttpOptions = {
  /** Repositorio de tokens (por defecto, Postgres). */
  authRepo?: AuthRepo
  /** Limitadores por usuario; los que falten usan los de producción. */
  limiters?: Partial<McpHttpLimiters>
  now?: () => Date
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function defaultMcpLimiters(): McpHttpLimiters {
  return {
    request: createRateLimiter({ max: 120, windowMs: MINUTE }),
    write: createRateLimiter({ max: 30, windowMs: MINUTE }),
    exerciseCreate: createRateLimiter({ max: 10, windowMs: HOUR }),
    schedule: createRateLimiter({ max: 20, windowMs: HOUR }),
  }
}

/**
 * Contexto de herramientas para un principal ya autenticado (uno por request). Es lo que
 * recibe createMcpServer; los tests pueden construirlo igual con un logger y limitadores propios.
 */
export function createMcpToolContext(
  principal: McpPrincipal,
  opts: { log: FastifyBaseLogger; limiters: McpLimiters; now?: () => Date; requestId?: string },
): McpToolContext {
  const now = opts.now ?? (() => new Date())
  return {
    principal,
    caller: createMcpCaller(principal, opts.log, now()),
    features: new Set(activeFeatures(principal.user)),
    log: opts.log,
    now,
    limiters: { write: opts.limiters.write, exerciseCreate: opts.limiters.exerciseCreate, schedule: opts.limiters.schedule },
    ...(opts.requestId && { requestId: opts.requestId }),
  }
}

/** AuthInfo del SDK (llega a los handlers como `extra.authInfo`). Sin el token real. */
export function toSdkAuthInfo(p: McpPrincipal): AuthInfo {
  return {
    token: "",
    clientId: p.clientId ?? `pat:${p.tokenId}`,
    scopes: [...p.scopes],
    ...(p.expiresAt && { expiresAt: Math.floor(p.expiresAt.getTime() / 1000) }),
    resource: new URL(mcpResourceUrl()),
    extra: { kind: p.kind, userId: p.user.id, tokenId: p.tokenId },
  }
}

function isMcpPath(url: string): boolean {
  const path = url.split("?")[0]!
  return path === "/mcp" || path === "/mcp/" || path.startsWith("/.well-known/")
}

/**
 * Opciones de @fastify/cors por ruta (delegator de app.ts): /mcp y /.well-known/* aceptan los
 * orígenes del conector, sin cookies, y exponen los headers que lee un cliente MCP de navegador.
 * El resto de la API sigue aceptando solo WEB_URL con credenciales.
 */
export function corsOptionsFor(url: string): FastifyCorsOptions {
  if (isMcpPath(url)) {
    return {
      origin: [...allowedOrigins()],
      credentials: false,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Mcp-Protocol-Version"],
    }
  }
  return { origin: webUrl(), credentials: true }
}

function wwwAuthenticate(error?: "invalid_token" | "insufficient_scope"): string {
  const parts = [
    ...(error ? [`error="${error}"`] : []),
    `resource_metadata="${protectedResourceMetadataUrl()}"`,
    `scope="${MCP_SCOPES.join(" ")}"`,
  ]
  return `Bearer ${parts.join(", ")}`
}

function rpcError(reply: FastifyReply, status: number, code: number, message: string) {
  return reply.status(status).type("application/json").send({ jsonrpc: "2.0", error: { code, message }, id: null })
}

function rpcMethodOf(body: unknown): string | undefined {
  const method = (body as { method?: unknown } | null)?.method
  return typeof method === "string" ? method.slice(0, 64) : undefined
}

function principalLog(p: McpPrincipal) {
  return { kind: p.kind, userId: p.user.id, ...(p.clientId ? { clientId: p.clientId } : { tokenId: p.tokenId }) }
}

export async function registerMcpHttp(app: FastifyInstance, opts: McpHttpOptions = {}): Promise<void> {
  const repo = opts.authRepo ?? createAuthRepo(db)
  const limiters: McpHttpLimiters = { ...defaultMcpLimiters(), ...opts.limiters }
  const now = opts.now ?? (() => new Date())
  const principals = new WeakMap<IncomingMessage, McpPrincipal>()

  async function guard(req: FastifyRequest, reply: FastifyReply) {
    const origin = req.headers.origin
    if (!isOriginAllowed(origin)) {
      req.log.warn({ mcp: { reason: "origin_not_allowed" } }, "[mcp] request rechazada")
      return rpcError(reply, 403, -32000, "Origen no permitido")
    }

    const result = await resolveMcpAuth(req.headers.authorization, repo, now())
    if (!result.ok) {
      req.log.warn({ mcp: { reason: result.reason } }, "[mcp] auth rechazada")
      reply.header("WWW-Authenticate", wwwAuthenticate(result.reason === "missing" ? undefined : "invalid_token"))
      return rpcError(reply, 401, -32000, "Se requiere autenticación: conecta el cliente con OAuth o con un token personal de Atleta")
    }

    const p = result.principal
    if (p.scopes.size === 0) {
      req.log.warn({ mcp: { reason: "insufficient_scope", ...principalLog(p) } }, "[mcp] auth rechazada")
      reply.header("WWW-Authenticate", wwwAuthenticate("insufficient_scope"))
      return rpcError(reply, 403, -32000, "El token no tiene permisos de Atleta (atleta:read o atleta:write)")
    }

    if (!hasFeature(p.user, "mcp")) {
      req.log.warn({ mcp: { reason: "feature_disabled", ...principalLog(p) } }, "[mcp] request rechazada")
      return rpcError(reply, 403, MCP_FEATURE_DISABLED_CODE, "El conector MCP aún no está disponible para tu cuenta")
    }

    const limit = limiters.request.hit(p.user.id)
    if (!limit.ok) {
      req.log.warn({ mcp: { reason: "rate_limited", ...principalLog(p) } }, "[mcp] request rechazada")
      reply.header("Retry-After", String(limit.retryAfterSeconds))
      return rpcError(reply, 429, -32000, `Demasiadas solicitudes seguidas. Reintenta en ${limit.retryAfterSeconds} s.`)
    }

    principals.set(req.raw, p)
  }

  app.post("/mcp", { bodyLimit: MCP_BODY_LIMIT, onRequest: guard }, async (req, reply) => {
    const principal = principals.get(req.raw)
    if (!principal) return rpcError(reply, 401, -32000, "Se requiere autenticación")

    // Batches JSON-RPC: MCP 2025-06-18 los eliminó y un batch contaría como 1 request para el
    // limitador por usuario (10 llamadas por el precio de una). Se rechazan antes del transporte.
    if (Array.isArray(req.body)) {
      req.log.warn({ mcp: { reason: "batch_not_supported", ...principalLog(principal) } }, "[mcp] request rechazada")
      return rpcError(reply, 400, -32600, "Batch JSON-RPC no soportado: envía un solo mensaje JSON-RPC por POST (MCP 2025-06-18 eliminó los batches)")
    }

    const started = Date.now()
    const rpcMethod = rpcMethodOf(req.body)
    const ctx = createMcpToolContext(principal, { log: req.log, limiters, now, requestId: String(req.id) })
    const server = createMcpServer(ctx)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })

    // Desde aquí responde el transporte del SDK: Fastify ya no envía nada ni corre onResponse
    reply.hijack()
    for (const [key, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(key, value as string | number | readonly string[])
    }
    reply.raw.on("close", () => {
      void transport.close()
      void server.close()
    })
    reply.raw.on("finish", () => {
      const status = reply.raw.statusCode
      req.log.info(
        { mcp: { ...principalLog(principal), rpcMethod, ms: Date.now() - started, ok: status < 400, status } },
        "[mcp] request",
      )
    })

    try {
      await server.connect(transport)
      ;(req.raw as IncomingMessage & { auth?: AuthInfo }).auth = toSdkAuthInfo(principal)
      await transport.handleRequest(req.raw, reply.raw, req.body)
    } catch (err) {
      req.log.error({ err, mcp: principalLog(principal) }, "[mcp] error en el transporte")
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" })
        reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Error interno" }, id: null }))
      }
    }
  })

  // Servidor stateless sin stream SSE: GET (stream) y DELETE (cerrar sesión) no aplican
  const methodNotAllowed = async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Allow", "POST")
    return rpcError(reply, 405, -32000, "Método no permitido: usa POST")
  }
  app.get("/mcp", methodNotAllowed)
  app.delete("/mcp", methodNotAllowed)

  // Protected Resource Metadata (RFC 9728): a qué servidor de autorización ir y con qué scopes
  const protectedResource = async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "public, max-age=300")
    return reply.send({
      resource: mcpResourceUrl(),
      authorization_servers: [authIssuer()],
      scopes_supported: [...OAUTH_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Atleta",
      resource_documentation: `${webUrl()}/settings/conectar-ia`,
    })
  }
  app.get("/.well-known/oauth-protected-resource", protectedResource)
  app.get("/.well-known/oauth-protected-resource/mcp", protectedResource)

  // Metadata del servidor de autorización (RFC 8414). El issuer es `${BETTER_AUTH_URL}/api/auth`,
  // así que los clientes la piden en <WEB>/.well-known/oauth-authorization-server/api/auth; la
  // raíz se sirve por compatibilidad con clientes que no agregan la ruta del issuer.
  const asMetadata = oauthProviderAuthServerMetadata(auth)
  const authServer = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // La firma del web (x-atleta-web-proxy, ver lib/client-ip.ts) nunca llega a better-auth
      const headers = fromNodeHeaders(req.headers)
      headers.delete(WEB_PROXY_HEADER)
      const res = await asMetadata(new Request(`${apiPublicUrl()}${req.url}`, { headers }))
      reply.status(res.status)
      res.headers.forEach((value, key) => {
        if (key !== "content-length" && key !== "content-encoding") reply.header(key, value)
      })
      return reply.send(await res.text())
    } catch (err) {
      req.log.error(err, "[mcp] metadata del servidor de autorización")
      return reply.status(500).send({ error: "server_error" })
    }
  }
  app.get("/.well-known/oauth-authorization-server", authServer)
  app.get("/.well-known/oauth-authorization-server/api/auth", authServer)
}
