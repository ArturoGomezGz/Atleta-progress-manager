// Herramientas MCP de planes de entrenamiento multi-semana (flag `training_plans`) y el
// prompt `planificar_mesociclo`. Cada herramienta llama al router plans.* con el caller
// del usuario (mismas reglas de rol y flag que la web). Ver docs/mcp.md, "Planes".

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import {
  MAX_PLAN_WEEKS,
  MAX_PLAN_WORKOUTS,
  MAX_SCHEDULE_SESSIONS,
  planCancelAssignmentShape,
  planCreateShape,
  planDuplicateShape,
  planScheduleShape,
  planUpdateShape,
} from "../../services/training-plan-input"
import { resolveTeamId } from "../context"
import { ErrorDetails, McpToolError } from "../errors"
import { isToolAvailable, registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"

const FEATURE = "training_plans" as const
const teamIdInput = z.string().uuid().optional().describe("Equipo; si se omite, el único donde eres coach")

const CALENDAR_RULES =
  "Calendario: weekday ISO (1 = lunes … 7 = domingo); la semana 1 es la semana lunes–domingo que contiene startDate; " +
  "fecha = lunes de esa semana + (semana − 1)·7 + (weekday − 1). Los huecos antes de startDate, antes de hoy (UTC) o sin rutina se omiten y se reportan en skipped."

/** CONFLICT de plans.update con el mensaje propio del plan (el genérico menciona get_routine). */
function planConflict(err: unknown): never {
  if (err instanceof TRPCError && err.code === "CONFLICT") {
    const details = err.cause instanceof ErrorDetails ? err.cause.details : undefined
    throw new McpToolError("CONFLICT", `${err.message} Vuelve a leerlo con get_plan y reintenta con su updatedAt.`, details)
  }
  throw err
}

export function registerPlanTools(server: McpServer, ctx: McpToolContext): void {
  registerAtletaTool(server, ctx, {
    name: "list_plans",
    title: "Listar planes",
    description:
      "Lista los planes de entrenamiento de varias semanas del equipo (sin archivados salvo includeArchived). " +
      "Devuelve planId, nombre, objetivo, semanas, estado, número de entrenamientos y asignaciones activas.",
    scope: "atleta:read",
    feature: FEATURE,
    input: { teamId: teamIdInput, includeArchived: z.boolean().optional() },
    run: async (args, c) => {
      const teamId = await resolveTeamId(c, args.teamId, "member")
      return c.caller.plans.list({ teamId, includeArchived: args.includeArchived ?? false })
    },
  })

  registerAtletaTool(server, ctx, {
    name: "get_plan",
    title: "Ver plan",
    description:
      "Detalle de un plan: semanas (nombre, enfoque, notas) con sus días y entrenamientos (workoutId, rutina), y las " +
      "asignaciones (assignmentId, fecha de inicio, atletas y avance). Usa updatedAt como expectedUpdatedAt en update_plan.",
    scope: "atleta:read",
    feature: FEATURE,
    input: { planId: z.string().uuid() },
    run: (args, c) => c.caller.plans.get({ planId: args.planId }),
  })

  registerAtletaTool(server, ctx, {
    name: "create_plan",
    title: "Crear plan",
    description:
      `Crea un plan de 1 a ${MAX_PLAN_WEEKS} semanas en una sola transacción. Cada entrenamiento (workouts[]) va en una semana y un día ` +
      "ISO (1 = lunes … 7 = domingo) y referencia exactamente una rutina: routineId (rutina de entrenamiento existente, no archivada) " +
      "o routineKey (una rutina nueva definida en routines[] con key, name y content, con el mismo formato de contenido que create_routine). " +
      `Varios entrenamientos el mismo día se ordenan como llegan. Máximo ${MAX_PLAN_WORKOUTS} entrenamientos. El plan se crea en borrador ` +
      "y no asigna nada: después usa schedule_plan. Confirma el plan con el usuario antes de crearlo.",
    scope: "atleta:write",
    feature: FEATURE,
    annotations: { destructiveHint: false },
    input: { teamId: teamIdInput, ...planCreateShape },
    run: async (args, c) => {
      const teamId = await resolveTeamId(c, args.teamId, "coach")
      return c.caller.plans.create({ ...args, teamId })
    },
  })

  registerAtletaTool(server, ctx, {
    name: "update_plan",
    title: "Modificar plan",
    description:
      "Modifica un plan con concurrencia optimista (expectedUpdatedAt = updatedAt de get_plan; si cambió → CONFLICT). " +
      "Permite cambiar nombre, descripción, objetivo, semanas, estado (draft/active/archived), metadatos por semana, " +
      "agregar huecos (addWorkouts, con rutinas nuevas en routines[]), quitarlos (removeWorkoutIds) o reemplazarlos todos " +
      "(replaceWorkouts). Reducir semanas solo se permite si no quedan huecos fuera. No cambia lo ya programado.",
    scope: "atleta:write",
    feature: FEATURE,
    annotations: { destructiveHint: true },
    input: planUpdateShape,
    run: (args, c) => c.caller.plans.update(args).catch(planConflict),
  })

  registerAtletaTool(server, ctx, {
    name: "duplicate_plan",
    title: "Duplicar plan",
    description:
      "Copia un plan (semanas y entrenamientos) como borrador nuevo. Con copyRoutines también duplica cada rutina del plan " +
      "y la copia apunta a las rutinas nuevas (útil para ajustarlas sin tocar el original).",
    scope: "atleta:write",
    feature: FEATURE,
    annotations: { destructiveHint: false },
    input: planDuplicateShape,
    run: (args, c) => c.caller.plans.duplicate(args),
  })

  registerAtletaTool(server, ctx, {
    name: "schedule_plan",
    title: "Programar plan",
    description:
      "Aplica un plan a atletas a partir de startDate: crea una sesión asignada por entrenamiento con su fecha (los atletas " +
      `la ven en su app como cualquier asignado). ${CALENDAR_RULES} ` +
      `Máximo ${MAX_SCHEDULE_SESSIONS} sesiones de atleta (entrenamientos × atletas) por llamada. ` +
      "Usa primero dryRun: true para mostrar las fechas al usuario y confirma antes de programar de verdad.",
    scope: "atleta:write",
    feature: FEATURE,
    annotations: { destructiveHint: false },
    input: planScheduleShape,
    run: async (args, c) => {
      if (!args.dryRun) {
        const limit = c.limiters.schedule.hit(c.principal.user.id)
        if (!limit.ok) {
          throw new McpToolError(
            "RATE_LIMITED",
            `Demasiadas asignaciones seguidas. Reintenta en ${limit.retryAfterSeconds} s.`,
            { retryAfterSeconds: limit.retryAfterSeconds },
          )
        }
      }
      return c.caller.plans.schedule(args)
    },
  })

  registerAtletaTool(server, ctx, {
    name: "cancel_plan_assignment",
    title: "Cancelar plan asignado",
    description:
      "Cancela las sesiones de una asignación de plan (assignmentId de get_plan) que ningún atleta ha empezado; las " +
      "iniciadas o completadas se conservan. Con fromDate solo cancela desde esa fecha (la asignación sigue activa); " +
      "sin fromDate la asignación queda cancelada. Confirma con el usuario antes de cancelar.",
    scope: "atleta:write",
    feature: FEATURE,
    annotations: { destructiveHint: true },
    input: planCancelAssignmentShape,
    run: (args, c) => c.caller.plans.cancelAssignment(args),
  })

  registerPlanPrompt(server, ctx)
}

// ─── Prompt planificar_mesociclo ──────────────────────────────────────────────

function registerPlanPrompt(server: McpServer, ctx: McpToolContext) {
  // El flujo termina en create_plan / schedule_plan: sin esas herramientas no tiene sentido
  if (!isToolAvailable(ctx, { scope: "atleta:write", feature: FEATURE })) return

  server.registerPrompt(
    "planificar_mesociclo",
    {
      title: "Planificar mesociclo",
      description: "Diseña un plan de varias semanas (mesociclo) en Atleta y, si el usuario lo confirma, lo programa a sus atletas.",
      argsSchema: {
        objetivo: z.string().describe("Objetivo del bloque, p. ej. fuerza máxima, hipertrofia, preparación de carrera"),
        semanas: z.string().describe(`Número de semanas (1..${MAX_PLAN_WEEKS})`),
        dias_por_semana: z.string().describe("Días de entrenamiento por semana, p. ej. 3"),
        nivel: z.string().optional().describe("principiante, intermedio o avanzado"),
        equipamiento: z.string().optional().describe("Material disponible"),
        fecha_inicio: z.string().optional().describe("YYYY-MM-DD"),
        atletas: z.string().optional().describe("Nombres de los atletas a los que se programará"),
      },
    },
    (args) => {
      const extra = [
        args.nivel && `- Nivel: ${args.nivel}`,
        args.equipamiento && `- Equipamiento: ${args.equipamiento}`,
        args.fecha_inicio && `- Fecha de inicio: ${args.fecha_inicio}`,
        args.atletas && `- Atletas: ${args.atletas}`,
      ].filter(Boolean)
      const text = [
        "Quiero planificar un mesociclo en Atleta.",
        `- Objetivo: ${args.objetivo}`,
        `- Semanas: ${args.semanas}`,
        `- Días por semana: ${args.dias_por_semana}`,
        ...extra,
        "",
        "Sigue este flujo con las herramientas de Atleta:",
        "1. whoami: confirma el equipo y la fecha de hoy (UTC).",
        "2. list_athletes: identifica a los atletas (ids) si hay que programar.",
        "3. search_exercises (y list_routines para reutilizar rutinas existentes): elige ejercicios adecuados al nivel y al equipamiento.",
        "4. Propón la estructura (semanas, enfoque de cada una, días y rutinas con series, repeticiones, carga y descanso) y espera mi confirmación.",
        "5. create_plan con las rutinas nuevas en routines[] (key, name, content) y los entrenamientos en workouts[] referenciándolas por routineKey; " +
          "usa weekMeta para nombrar cada semana (p. ej. acumulación, intensificación, descarga).",
        "6. schedule_plan con dryRun: true y muéstrame las fechas resultantes y lo que se omite (skipped).",
        "7. Solo si confirmo, schedule_plan sin dryRun.",
        "",
        `${CALENDAR_RULES} No guardes, asignes ni archives nada sin mi confirmación.`,
      ].join("\n")
      return { messages: [{ role: "user", content: { type: "text", text } }] }
    },
  )
}
