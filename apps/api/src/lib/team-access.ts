import { db } from "@atleta/db/client"
import { teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, or } from "drizzle-orm"

// Aislamiento entre equipos — única barrera que impide que un usuario opere
// sobre un teamId ajeno. Se separa cada assert en (consulta sin ejecutar) +
// (chequeo puro) para poder testear ambas partes sin DB.

type TeamMemberRow = typeof teamMember.$inferSelect

export function memberQuery(userId: string, teamId: string) {
  return db
    .select()
    .from(teamMember)
    .where(and(eq(teamMember.userId, userId), eq(teamMember.teamId, teamId)))
    .limit(1)
}

export function athleteInTeamQuery(athleteId: string, teamId: string) {
  return db
    .select()
    .from(teamMember)
    .where(and(eq(teamMember.userId, athleteId), eq(teamMember.teamId, teamId), or(eq(teamMember.role, "athlete"), eq(teamMember.selfAthlete, true))))
    .limit(1)
}

export function requireMember<T extends TeamMemberRow>(member: T | undefined): T {
  if (!member) throw new TRPCError({ code: "FORBIDDEN" })
  return member
}

export function requireCoach<T extends Pick<TeamMemberRow, "role">>(member: T): T {
  if (member.role !== "coach") throw new TRPCError({ code: "FORBIDDEN" })
  return member
}

// NOT_FOUND (no FORBIDDEN) para no revelar si el atleta existe en otro equipo
export function requireAthlete<T extends TeamMemberRow>(member: T | undefined): T {
  if (!member) throw new TRPCError({ code: "NOT_FOUND" })
  return member
}

export async function assertMember(userId: string, teamId: string) {
  return requireMember((await memberQuery(userId, teamId))[0])
}

export async function assertCoach(userId: string, teamId: string) {
  return requireCoach(await assertMember(userId, teamId))
}

export async function assertAthleteInTeam(athleteId: string, teamId: string) {
  return requireAthlete((await athleteInTeamQuery(athleteId, teamId))[0])
}
