// Creación de equipos compartida por `teams.create` y `teams.ensureDefault`.

import { db } from "@atleta/db/client"
import { team, teamMember, userPreferences } from "@atleta/db/schema"
import { and, count, eq, or, sql } from "drizzle-orm"

export const DEFAULT_TEAM_NAME = "Mi equipo"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Plazas de atleta ocupadas: atletas del equipo más coaches con auto-entrenamiento
 * (un mismo miembro cuenta una sola vez).
 */
export async function countAthletePlazas(tx: Pick<Tx, "select">, teamId: string) {
  const [{ plazas }] = await tx
    .select({ plazas: count() })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), or(eq(teamMember.role, "athlete"), eq(teamMember.selfAthlete, true))))
  return plazas
}

/** Crea el equipo y la membresía de coach de su dueño. */
export async function createTeamWithCoach(
  tx: Pick<Tx, "insert">,
  userId: string,
  name: string,
  opts: { selfAthlete?: boolean } = {},
) {
  const [newTeam] = await tx.insert(team).values({ name }).returning()
  await tx.insert(teamMember).values({
    teamId: newTeam.id,
    userId,
    role: "coach",
    ...(opts.selfAthlete && { selfAthlete: true }),
  })
  return newTeam
}

/**
 * Equipo por defecto de un usuario nuevo: solo se crea si no tiene ninguna
 * membresía. El lock de asesoría por usuario serializa llamadas concurrentes
 * (doble clic, dos pestañas), así la segunda ve la membresía de la primera.
 */
export async function ensureDefaultTeam(userId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`default-team:${userId}`}))`)
    const [existing] = await tx
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .where(eq(teamMember.userId, userId))
      .limit(1)
    if (existing) return { teamId: existing.teamId, created: false }
    const created = await createTeamWithCoach(tx, userId, DEFAULT_TEAM_NAME, { selfAthlete: true })
    // Solo quien recibe el equipo por defecto entra al onboarding (docs/onboarding.md)
    const onboarding = { status: "active" as const, teamId: created.id }
    await tx
      .insert(userPreferences)
      .values({ userId, onboarding })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { onboarding } })
    return { teamId: created.id, created: true }
  })
}
