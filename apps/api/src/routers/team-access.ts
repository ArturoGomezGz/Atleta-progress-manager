import type { teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"

// Decisiones puras de acceso multi-tenant. Sin @atleta/db/client: la consulta
// vive en teams.ts (assertMember/assertCoach/assertAthleteInTeam) y aquí solo
// se decide qué hacer con su resultado, para poder testearlo sin Postgres.
export type TeamMemberRow = typeof teamMember.$inferSelect

export function decideMembership(member: TeamMemberRow | undefined, requirement: "member" | "coach"): TeamMemberRow {
  if (!member) throw new TRPCError({ code: "FORBIDDEN" })
  if (requirement === "coach" && member.role !== "coach") throw new TRPCError({ code: "FORBIDDEN" })
  return member
}

// NOT_FOUND (no FORBIDDEN) para no revelar si el atleta existe en otro equipo.
// El filtro role = "athlete" OR selfAthlete lo aplica la consulta SQL; aquí
// solo se decide sobre si hubo fila o no.
export function decideAthleteInTeam(member: TeamMemberRow | undefined): TeamMemberRow {
  if (!member) throw new TRPCError({ code: "NOT_FOUND" })
  return member
}
