// Creación de equipos compartida por `teams.create` y `teams.ensureDefault`.

import { db } from "@atleta/db/client"
import { team, teamMember } from "@atleta/db/schema"
import { eq, sql } from "drizzle-orm"

export const DEFAULT_TEAM_NAME = "Mi equipo"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
    return { teamId: created.id, created: true }
  })
}
