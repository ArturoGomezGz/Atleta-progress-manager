// Herramientas MCP de planes de entrenamiento multi-semana (flag `training_plans`), el
// prompt `planificar_mesociclo`, la plantilla de resource atleta://planes/{planId} y el tipo
// "plan:<uuid>" de search/fetch. Todo llama al router plans.* con el caller del usuario
// (mismas reglas de rol y flag que la web). Ver docs/mcp.md, "Planes".

import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { normalizeText } from "../../services/ai-routine-editor/avoid"
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
import { McpToolError } from "../errors"
import { toResourceError } from "../resources"
import { isToolAvailable, registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"
import { addSearchFetchProvider, webUrl, type FetchResult, type SearchResult } from "./search-fetch"

const FEATURE = "training_plans" as const
const teamIdInput = z.string().uuid().optional().describe("Equipo; si se omite, el único donde eres coach")

const CALENDAR_RULES =
  "Calendario: weekday ISO (1 = lunes … 7 = domingo); la semana 1 es la semana lunes–domingo que contiene startDate; " +
  "fecha = lunes de esa semana + (semana − 1)·7 + (weekday − 1). Los huecos antes de startDate, antes de hoy (UTC) o sin rutina se omiten y se reportan en skipped."

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
    run: (args, c) => c.caller.plans.update(args),
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
  registerPlanDocuments(server, ctx)
}

// ─── search / fetch y resource atleta://planes/{planId} ──────────────────────

const MAX_TEAMS_SEARCHED = 10
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
const STATUS_LABEL: Record<string, string> = { draft: "borrador", active: "activo", archived: "archivado", cancelled: "cancelada" }

type PlanView = Awaited<ReturnType<McpToolContext["caller"]["plans"]["get"]>>

const planUrl = (teamId: string) => `${webUrl()}/teams/${teamId}`

/** Planes no archivados de los equipos del usuario cuyo nombre u objetivo contiene la consulta. */
async function searchPlans(query: string, ctx: McpToolContext): Promise<SearchResult[]> {
  const needle = normalizeText(query)
  const teams = (await ctx.caller.teams.list()).slice(0, MAX_TEAMS_SEARCHED)
  const perTeam = await Promise.all(
    teams.map(async (t) => {
      const { plans } = await ctx.caller.plans.list({ teamId: t.team.id, includeArchived: false })
      return plans
        .filter((p) => !needle || normalizeText(`${p.name} ${p.goal ?? ""}`).includes(needle))
        .map((p) => ({
          id: `plan:${p.planId}`,
          title: teams.length > 1 ? `${p.name} — ${t.team.name}` : p.name,
          url: planUrl(t.team.id),
          updatedAt: Date.parse(p.updatedAt),
        }))
    }),
  )
  return perTeam.flat().sort((a, b) => b.updatedAt - a.updatedAt).map(({ updatedAt: _u, ...r }) => r)
}

/** Texto legible de un plan (semanas, días, rutinas y asignaciones) para fetch. */
function planText(p: PlanView): string {
  const lines = [`# ${p.name}`, ""]
  if (p.goal) lines.push(`Objetivo: ${p.goal}`)
  lines.push(`${p.weeks} semana${p.weeks === 1 ? "" : "s"} · estado: ${STATUS_LABEL[p.status] ?? p.status}`)
  if (p.description) lines.push("", p.description)
  for (const w of p.schedule) {
    const title = [w.name, w.focus].filter(Boolean).join(" — ")
    lines.push("", `## Semana ${w.week}${title ? `: ${title}` : ""}`)
    if (w.notes) lines.push(w.notes)
    if (w.days.length === 0) lines.push("(sin entrenamientos)")
    for (const d of w.days) {
      const workouts = d.workouts.map((x) => `${x.routineName ?? "(rutina eliminada)"}${x.notes ? ` (${x.notes})` : ""}`)
      lines.push(`- ${WEEKDAYS[d.weekday - 1] ?? d.weekday}: ${workouts.join("; ")}`)
    }
  }
  if (p.assignments.length > 0) {
    lines.push("", "## Asignaciones")
    for (const a of p.assignments) {
      const athletes = a.athletes.map((x) => x.name).join(", ") || "—"
      lines.push(`- Desde ${a.startDate} (${STATUS_LABEL[a.status] ?? a.status}): ${athletes}; ${a.sessions.completed}/${a.sessions.total} sesiones completadas`)
    }
  }
  return lines.join("\n")
}

async function fetchPlan(id: string, ctx: McpToolContext): Promise<FetchResult> {
  const p = await ctx.caller.plans.get({ planId: id })
  return {
    id: `plan:${p.planId}`,
    title: p.name,
    text: planText(p),
    url: planUrl(p.teamId),
    metadata: { type: "plan", teamId: p.teamId, status: p.status, weeks: p.weeks, updatedAt: p.updatedAt },
  }
}

function registerPlanDocuments(server: McpServer, ctx: McpToolContext) {
  if (!isToolAvailable(ctx, { scope: "atleta:read", feature: FEATURE })) return

  addSearchFetchProvider(server, { kind: "plan", search: searchPlans, fetch: fetchPlan })

  server.registerResource(
    "plan",
    new ResourceTemplate("atleta://planes/{planId}", { list: undefined }),
    { title: "Plan de entrenamiento", description: "Un plan por id, con el mismo JSON que get_plan.", mimeType: "application/json" },
    async (uri, variables) => {
      const planId = String(Array.isArray(variables.planId) ? variables.planId[0] : variables.planId)
      try {
        const plan = await ctx.caller.plans.get({ planId })
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(plan) }] }
      } catch (err) {
        throw toResourceError(err, ctx)
      }
    },
  )
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
