// Feature flags mínimos por allowlist en variables de entorno.
// Cambiar la lista en Railway redespliega la API; no requiere migraciones.

function parseList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function canUseAiRoutines(user: { id: string; email: string }, teamId: string): boolean {
  if (!process.env.OPENAI_API_KEY) return false
  const teams = parseList(process.env.AI_ROUTINES_TEAM_IDS)
  const users = parseList(process.env.AI_ROUTINES_USERS)
  return (
    teams.has(teamId.toLowerCase()) ||
    users.has(user.id.toLowerCase()) ||
    users.has(user.email.toLowerCase())
  )
}
