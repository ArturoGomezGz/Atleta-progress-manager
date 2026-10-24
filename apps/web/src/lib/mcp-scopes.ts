// Permisos (scopes) del conector MCP en palabras de la UI. Los nombres internos
// (`atleta:read`, `atleta:write`, `offline_access`) no se muestran. Ver docs/mcp.md.

export type McpScopeKey = "atleta:read" | "atleta:write" | "offline_access"

export const MCP_SCOPE_LABELS: Record<McpScopeKey, { title: string; description: string }> = {
  "atleta:read": {
    title: "Ver tus datos de entrenamiento",
    description: "Tus equipos, atletas (solo su nombre, nunca su correo), ejercicios, entrenamientos, asignados y planes.",
  },
  "atleta:write": {
    title: "Crear y modificar",
    description: "Crear y editar entrenamientos y ejercicios, asignarlos a tus atletas y programar planes.",
  },
  offline_access: {
    title: "Mantener la conexión",
    description: "Seguir conectada sin pedirte que inicies sesión de nuevo cada hora.",
  },
}

export function scopeTitle(scope: string): string {
  return MCP_SCOPE_LABELS[scope as McpScopeKey]?.title ?? scope
}

/** Resumen corto para listas: "Lectura" o "Lectura y escritura". */
export function scopesSummary(scopes: readonly string[]): string {
  if (scopes.includes("atleta:write")) return "Lectura y escritura"
  if (scopes.includes("atleta:read")) return "Solo lectura"
  return "Sin permisos"
}

/** Scopes conocidos en orden fijo (lectura, escritura, conexión); los desconocidos se omiten. */
export function knownScopes(scopes: readonly string[]): McpScopeKey[] {
  return (Object.keys(MCP_SCOPE_LABELS) as McpScopeKey[]).filter((s) => scopes.includes(s))
}
