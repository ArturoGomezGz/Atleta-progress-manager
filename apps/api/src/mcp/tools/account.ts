// Herramientas de cuenta: whoami y list_athletes.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { MAX_BLOCK_EXERCISES, MAX_ITEMS, MAX_SETS_PER_EXERCISE } from "../../services/routine-content-input"
import { todayUtc } from "../../services/session-assign"
import { resolveTeamId } from "../context"
import { registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"

/** Semanas máximas de un plan (training_plan_weeks_check en la BD). */
const MAX_PLAN_WEEKS = 16

const teamIdInput = z.string().uuid().optional().describe("Equipo; omítelo si solo eres coach de uno (ver whoami)")

export function registerAccountTools(server: McpServer, ctx: McpToolContext): void {
  registerAtletaTool(server, ctx, {
    name: "whoami",
    title: "Quién soy",
    description:
      "Devuelve el usuario conectado, sus equipos (con rol), el equipo por defecto, las funciones activas, los permisos del token, la fecha de hoy (UTC) y los límites de una rutina. Llámala primero: casi todas las herramientas aceptan teamId y lo infieren de aquí.",
    scope: "atleta:read",
    input: {},
    async run(_args, ctx) {
      const teams = await ctx.caller.teams.list()
      const coachTeams = teams.filter((t) => t.role === "coach")
      const defaultTeamId = coachTeams.length === 1 ? coachTeams[0]!.team.id : teams.length === 1 ? teams[0]!.team.id : null
      const u = ctx.principal.user
      return {
        user: { id: u.id, name: u.name, email: u.email },
        teams: teams.map((t) => ({ teamId: t.team.id, name: t.team.name, role: t.role, selfAthlete: t.selfAthlete })),
        defaultTeamId,
        features: [...ctx.features],
        scopes: [...ctx.principal.scopes],
        today: todayUtc(ctx.now()),
        limits: { maxItems: MAX_ITEMS, maxBlockExercises: MAX_BLOCK_EXERCISES, maxSets: MAX_SETS_PER_EXERCISE, maxPlanWeeks: MAX_PLAN_WEEKS },
      }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "list_athletes",
    title: "Listar atletas",
    description:
      "Lista los atletas de un equipo del que eres coach (incluye al coach si entrena en su equipo) con su athleteId, para asignar rutinas. No incluye correos. Con la función de grupos activa también devuelve los grupos con sus athleteIds.",
    scope: "atleta:read",
    input: { teamId: teamIdInput },
    async run(args, ctx) {
      const teamId = await resolveTeamId(ctx, args.teamId, "coach")
      const members = await ctx.caller.teams.members({ teamId })
      const athletes = members
        .filter((m) => m.role === "athlete" || m.selfAthlete)
        .map((m) => ({ athleteId: m.userId, name: m.userName, role: m.role, selfAthlete: m.selfAthlete }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
      const groups = ctx.features.has("groups")
        ? (await ctx.caller.groups.list({ teamId })).map((g) => ({ groupId: g.id, name: g.name, athleteIds: g.members.map((m) => m.athleteId) }))
        : undefined
      return { teamId, athletes, ...(groups && { groups }) }
    },
  })
}
