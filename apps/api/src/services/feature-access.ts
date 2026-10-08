// Acceso a la generación de rutinas con IA. Además del flag `ai_generator`
// (lib/features.ts), se conservan las allowlists originales por equipo/usuario.
// Cambiar la lista en Railway redespliega la API; no requiere migraciones.

import { hasFeature } from "../lib/features"

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
  if (hasFeature(user, "ai_generator")) return true
  const teams = parseList(process.env.AI_ROUTINES_TEAM_IDS)
  const users = parseList(process.env.AI_ROUTINES_USERS)
  return (
    teams.has(teamId.toLowerCase()) ||
    users.has(user.id.toLowerCase()) ||
    users.has(user.email.toLowerCase())
  )
}
