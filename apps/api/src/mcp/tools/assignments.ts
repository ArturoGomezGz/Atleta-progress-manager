// Herramientas de asignados (sesiones): assign_routine, list_assignments y cancel_assignment.
// Reutilizan sessions.create / createMany / list / cancel / cancelAthlete. Una sesión guarda un
// snapshot de la rutina: editarla después no cambia lo ya asignado.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { MAX_ASSIGN_ATHLETES, MAX_ASSIGN_DATES, MAX_SEQUENCE_STEPS } from "../../routers/sessions"
import { ROUTINE_KINDS, scheduledTimeSchema } from "../../services/routine-kind"
import { todayUtc } from "../../services/session-assign"
import { resolveTeamId } from "../context"
import { McpToolError } from "../errors"
import { toAssignmentView } from "../format"
import { registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 100
const SESSION_STATUSES = ["scheduled", "active", "completed", "cancelled"] as const

const dateInput = z.string().date().describe("YYYY-MM-DD")
const kindInput = z.enum(ROUTINE_KINDS).describe("warmup (calentamiento), main (principal) o recovery (recuperación)")
const timeInput = scheduledTimeSchema.describe("Hora sugerida HH:MM (24 h), solo informativa")

function checkScheduleLimit(ctx: McpToolContext) {
  const limit = ctx.limiters.schedule.hit(ctx.principal.user.id)
  if (!limit.ok) {
    throw new McpToolError("RATE_LIMITED", `Demasiadas asignaciones en la última hora. Reintenta en ${limit.retryAfterSeconds} s.`, {
      retryAfterSeconds: limit.retryAfterSeconds,
    })
  }
}

export function registerAssignmentTools(server: McpServer, ctx: McpToolContext): void {
  registerAtletaTool(server, ctx, {
    name: "assign_routine",
    title: "Asignar rutina",
    description:
      `Asigna una rutina a atletas del equipo de la rutina (athleteId de list_athletes, máx. ${MAX_ASSIGN_ATHLETES}). Sin dates queda disponible ahora; con dates crea una sesión por fecha (máx. ${MAX_ASSIGN_DATES}): las fechas futuras quedan programadas (requieren la función de sesiones programadas) y las de hoy o antes, activas. "Hoy" es UTC (ver whoami). Las rutinas archivadas no se pueden asignar. Opcionales para entrenamientos (no evaluaciones): kind (por defecto el de la rutina), insertIndex y scheduledTime. Orden dentro del día: por defecto la rutina va AL FINAL de lo que esos atletas ya tienen ese día (la primera queda en 0); con insertIndex (0 = al inicio, n = al final, siendo n el número de entrenamientos que ya tienen ese día) la insertas en ese lugar y las demás se reordenan; no se puede insertar antes de una rutina ya completada o en curso (BAD_REQUEST). Con varias dates, insertIndex aplica a cada fecha. position queda como orden absoluto avanzado (no combinar con insertIndex). El atleta debe completar (o saltar) los pasos anteriores del día antes de iniciar el siguiente; para encadenar varios entrenamientos de una vez usa assign_sequence. Confirma con el usuario atletas y fechas antes de asignar. Máximo 20 asignaciones por hora.`,
    scope: "atleta:write",
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      routineId: z.string().uuid(),
      athleteIds: z.array(z.string().min(1)).min(1).max(MAX_ASSIGN_ATHLETES),
      dates: z.array(dateInput).min(1).max(MAX_ASSIGN_DATES).optional(),
      kind: kindInput.optional(),
      insertIndex: z.number().int().min(0).max(99).optional().describe("Lugar en la lista de entrenamientos que esos atletas ya tienen ese día: 0 = al inicio, n = al final (por defecto). Las demás se reordenan."),
      position: z.number().int().min(0).max(99).optional().describe("Avanzado: orden absoluto dentro del día (0 = primero). Prefiere insertIndex"),
      scheduledTime: timeInput.optional(),
    },
    async run(args, ctx) {
      // El equipo es el de la rutina (routines.get exige ser miembro; sessions.* exige ser coach)
      const routine = await ctx.caller.routines.get({ id: args.routineId })
      const athleteIds = [...new Set(args.athleteIds)]
      checkScheduleLimit(ctx)
      const extra = { kind: args.kind, position: args.position, insertIndex: args.insertIndex, scheduledTime: args.scheduledTime }
      const sessions = args.dates
        ? await ctx.caller.sessions.createMany({ routineId: routine.id, teamId: routine.teamId, athleteIds, dates: [...new Set(args.dates)], ...extra })
        : [await ctx.caller.sessions.create({ routineId: routine.id, teamId: routine.teamId, athleteIds, ...extra })]
      return {
        routineId: routine.id,
        teamId: routine.teamId,
        athleteIds,
        sessions: sessions.map((s) => ({ sessionId: s.id, date: s.scheduledDate, status: s.status, kind: s.kind, position: s.position, scheduledTime: s.scheduledTime })),
      }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "assign_sequence",
    title: "Asignar secuencia de entrenamientos",
    description:
      `Asigna una secuencia ordenada de entrenamientos (p. ej. calentamiento → principal → recuperación) a atletas del equipo: por cada fecha de dates (1..${MAX_ASSIGN_DATES}, puede ser una sola) crea una sesión por paso, con position = índice del paso (máx. ${MAX_SEQUENCE_STEPS} pasos). Todo o nada. Solo rutinas de entrenamiento (las evaluaciones no entran). Cada paso puede fijar kind (por defecto el de la rutina) y scheduledTime (HH:MM, informativa). El atleta debe completar o saltar cada paso antes de iniciar el siguiente. Un solo aviso al atleta por asignación. Fechas futuras requieren la función de sesiones programadas. El equipo es el de la primera rutina. Confirma con el usuario atletas, fechas y orden antes de asignar. Máximo 20 asignaciones por hora.`,
    scope: "atleta:write",
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      athleteIds: z.array(z.string().min(1)).min(1).max(MAX_ASSIGN_ATHLETES),
      dates: z.array(dateInput).min(1).max(MAX_ASSIGN_DATES),
      steps: z
        .array(z.object({ routineId: z.string().uuid(), kind: kindInput.optional(), scheduledTime: timeInput.optional() }))
        .min(1)
        .max(MAX_SEQUENCE_STEPS),
    },
    async run(args, ctx) {
      const first = await ctx.caller.routines.get({ id: args.steps[0]!.routineId })
      const athleteIds = [...new Set(args.athleteIds)]
      checkScheduleLimit(ctx)
      const sessions = await ctx.caller.sessions.createSequence({ teamId: first.teamId, athleteIds, dates: [...new Set(args.dates)], steps: args.steps })
      return {
        teamId: first.teamId,
        athleteIds,
        sessions: sessions.map((s) => ({
          sessionId: s.id, routineId: s.routineId, date: s.scheduledDate, status: s.status, kind: s.kind, position: s.position, scheduledTime: s.scheduledTime,
        })),
      }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "list_assignments",
    title: "Listar asignados",
    description:
      `Lista las sesiones asignadas de un equipo, de la más reciente a la más antigua: rutina, fecha programada, estado y (si eres coach) atletas con su avance. Filtros: athleteId, rango de fechas from/to (fecha programada o, sin fecha, el día en que se asignó), status y planAssignmentId. Un atleta solo ve las suyas. Por defecto ${DEFAULT_LIST_LIMIT} resultados.`,
    scope: "atleta:read",
    input: {
      teamId: z.string().uuid().optional(),
      athleteId: z.string().min(1).optional(),
      from: dateInput.optional(),
      to: dateInput.optional(),
      status: z.array(z.enum(SESSION_STATUSES)).min(1).optional(),
      planAssignmentId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
    },
    async run(args, ctx) {
      const teamId = await resolveTeamId(ctx, args.teamId, "member")
      const teams = await ctx.caller.teams.list()
      const isCoach = teams.some((t) => t.team.id === teamId && t.role === "coach")
      // Privacidad: quien no es coach solo consulta sus propias sesiones
      const athleteId = isCoach ? args.athleteId : ctx.principal.user.id
      const rows = await ctx.caller.sessions.list({
        teamId,
        athleteId,
        from: args.from,
        to: args.to,
        status: args.status,
        planAssignmentId: args.planAssignmentId,
        limit: args.limit ?? DEFAULT_LIST_LIMIT,
      })
      return { teamId, today: todayUtc(ctx.now()), assignments: rows.map((r) => toAssignmentView(r, { includeAthletes: isCoach })) }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "cancel_assignment",
    title: "Cancelar asignado",
    description:
      "Cancela una sesión asignada completa o, con athleteId, solo para ese atleta (esto último solo en sesiones de evaluación). Lo ya registrado no se borra. Confirma con el usuario antes de cancelar.",
    scope: "atleta:write",
    annotations: { destructiveHint: true, idempotentHint: true },
    input: { sessionId: z.string().uuid(), athleteId: z.string().min(1).optional() },
    async run(args, ctx) {
      if (args.athleteId) {
        await ctx.caller.sessions.cancelAthlete({ sessionId: args.sessionId, athleteId: args.athleteId })
        return { sessionId: args.sessionId, athleteId: args.athleteId, cancelled: "athlete" as const }
      }
      await ctx.caller.sessions.cancel({ id: args.sessionId })
      return { sessionId: args.sessionId, cancelled: "session" as const }
    },
  })
}
