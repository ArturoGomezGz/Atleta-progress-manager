// Contrato compartido del servidor MCP (Paquete A). Lo consumen la capa HTTP/auth
// (Paquete B), las herramientas (C) y los planes (D). Ver docs/mcp.md.

import type { FastifyBaseLogger } from "fastify"
import type { FeatureKey } from "../lib/features"
import type { RateLimiter } from "../lib/rate-limit"
import type { createCaller } from "../routers"

export type McpScope = "atleta:read" | "atleta:write"
export const MCP_SCOPES: readonly McpScope[] = ["atleta:read", "atleta:write"]

/** Usuario autenticado en /mcp, resuelto desde un token OAuth (`atl_oat_…`) o personal (`atl_pat_…`). */
export type McpPrincipal = {
  kind: "oauth" | "pat"
  user: {
    id: string
    email: string
    name: string
    emailVerified: boolean
    image: string | null
    createdAt: Date
    updatedAt: Date
  }
  scopes: ReadonlySet<McpScope>
  /** Id de la fila del token (oauth_access_token.id o mcp_personal_token.id). Nunca el token. */
  tokenId: string
  /** client_id OAuth (solo kind "oauth"). */
  clientId?: string
  expiresAt?: Date
}

/** Caller tRPC del servidor con la sesión sintética del principal (ver context.ts). */
export type AppCaller = ReturnType<typeof createCaller>

/** Limitadores por usuario que aplican las herramientas (inyectables en tests). */
export type McpLimiters = {
  /** Toda herramienta de escritura (30/min). */
  write: RateLimiter
  /** create_exercise (10/h). */
  exerciseCreate: RateLimiter
  /** assign_routine + schedule_plan sin dryRun (20/h). */
  schedule: RateLimiter
}

/** Contexto de una request MCP: se crea uno por request (servidor stateless). */
export type McpToolContext = {
  principal: McpPrincipal
  caller: AppCaller
  /** Flags activos del usuario (activeFeatures). */
  features: ReadonlySet<FeatureKey>
  log: FastifyBaseLogger
  now: () => Date
  limiters: McpLimiters
  /** Id de la request HTTP, para correlacionar errores INTERNAL. */
  requestId?: string
}
