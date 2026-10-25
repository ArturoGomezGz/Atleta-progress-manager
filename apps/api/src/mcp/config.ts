// URLs y orígenes del conector MCP. Se leen de process.env en cada llamada (no al importar)
// para que los tests de integración puedan fijar el entorno antes de levantar la app.
//
// - El servidor de autorización OAuth vive en el origen WEB (la cookie de sesión es del
//   dominio web: /api/auth/* se proxea con rewrites de Next) → issuer `${BETTER_AUTH_URL}/api/auth`.
// - El recurso protegido (/mcp) vive en el origen de la API → `${API_PUBLIC_URL}/mcp`.
// Ver docs/mcp.md ("Autenticación") y docs/deploy.md.

/** Scopes que se pueden pedir en OAuth (offline_access habilita el refresh token). */
export const OAUTH_SCOPES = ["atleta:read", "atleta:write", "offline_access"] as const

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

export function webUrl(): string {
  return trimSlash(process.env.WEB_URL || "http://localhost:3000")
}

/** URL pública de la API (Railway). En local, la API escucha en :3001. */
export function apiPublicUrl(): string {
  return trimSlash(process.env.API_PUBLIC_URL || "http://localhost:3001")
}

/** Identificador del recurso OAuth (RFC 8707/9728) y URL del conector que se configura en el cliente. */
export function mcpResourceUrl(): string {
  return trimSlash(process.env.MCP_RESOURCE_URL || `${apiPublicUrl()}/mcp`)
}

/** Issuer del servidor de autorización (better-auth: baseURL + basePath). */
export function authIssuer(): string {
  return `${trimSlash(process.env.BETTER_AUTH_URL || "http://localhost:3001")}/api/auth`
}

/** URL del Protected Resource Metadata (RFC 9728): /.well-known/oauth-protected-resource + ruta del recurso. */
export function protectedResourceMetadataUrl(): string {
  const resource = new URL(mcpResourceUrl())
  const path = resource.pathname === "/" ? "" : resource.pathname
  return `${resource.origin}/.well-known/oauth-protected-resource${path}`
}

/** Normaliza un origen (`https://x.com/` → `https://x.com`); null si no es una URL válida. */
export function normalizeOrigin(value: string): string | null {
  try {
    const u = new URL(value.trim())
    return u.origin === "null" ? null : u.origin
  } catch {
    return null
  }
}

/**
 * Orígenes de navegador permitidos en /mcp y /.well-known/*: el web y MCP_ALLOWED_ORIGINS
 * (separados por comas; p. ej. el de MCP Inspector, http://localhost:6274).
 */
export function allowedOrigins(): Set<string> {
  const list = [webUrl(), ...(process.env.MCP_ALLOWED_ORIGINS ?? "").split(",")]
  return new Set(list.map((o) => (o.trim() ? normalizeOrigin(o) : null)).filter((o): o is string => !!o))
}

/** ¿Se acepta una request con este header Origin? Sin Origin (clientes que no son navegador) sí. */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (origin === undefined || origin === "") return true
  const normalized = normalizeOrigin(origin)
  return !!normalized && allowedOrigins().has(normalized)
}
