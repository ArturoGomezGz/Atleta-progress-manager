// Entrada de los planes de entrenamiento (router plans.* y herramientas MCP de planes).
// Módulo puro (solo zod): los schemas se comparten entre el router, que valida con las
// reglas cruzadas (superRefine), y las herramientas MCP, que publican el mismo shape.
// La lógica con base de datos vive en training-plans.ts. Ver docs/mcp.md.

import { z } from "zod"
import { routineContentInputSchema } from "./routine-content-input"

// ─── Límites v1 ────────────────────────────────────────────────────────────────

export const MAX_PLAN_WEEKS = 16
/** Huecos (entrenamientos) por plan: 16 semanas × 7 días. */
export const MAX_PLAN_WORKOUTS = 112
/** Rutinas nuevas que se pueden crear inline en una sola llamada. */
export const MAX_PLAN_INLINE_ROUTINES = 30
export const MAX_SCHEDULE_ATHLETES = 50
/** Sesiones de atleta (huecos programados × atletas) por aplicación del plan. */
export const MAX_SCHEDULE_SESSIONS = 200

export const MAX_PLAN_NAME_CHARS = 120
export const MAX_PLAN_DESCRIPTION_CHARS = 2000
export const MAX_PLAN_GOAL_CHARS = 300
export const MAX_WEEK_NAME_CHARS = 60
export const MAX_WEEK_FOCUS_CHARS = 120
export const MAX_WEEK_NOTES_CHARS = 500
export const MAX_WORKOUT_NOTES_CHARS = 300
export const MAX_ROUTINE_KEY_CHARS = 40

// ─── Piezas ───────────────────────────────────────────────────────────────────

const week = z.number().int().min(1).max(MAX_PLAN_WEEKS)
const weekday = z.number().int().min(1).max(7).describe("Día ISO: 1 = lunes … 7 = domingo")
const routineKey = z.string().trim().min(1).max(MAX_ROUTINE_KEY_CHARS)

export const planStatusSchema = z.enum(["draft", "active", "archived"])

export const planWeekMetaInputSchema = z
  .object({
    week,
    name: z.string().trim().max(MAX_WEEK_NAME_CHARS).nullable().optional(),
    focus: z.string().trim().max(MAX_WEEK_FOCUS_CHARS).nullable().optional(),
    notes: z.string().trim().max(MAX_WEEK_NOTES_CHARS).nullable().optional(),
  })
  .strict()

/** Rutina nueva creada junto con el plan; los huecos la referencian por `key`. */
export const planInlineRoutineInputSchema = z
  .object({
    key: routineKey.describe("Clave local para referenciarla desde workouts[].routineKey"),
    name: z.string().trim().min(1).max(MAX_PLAN_NAME_CHARS),
    content: routineContentInputSchema,
  })
  .strict()

/** Hueco del plan: semana + día + rutina (por id existente o por key de `routines`). */
export const planWorkoutInputSchema = z
  .object({
    week,
    weekday,
    routineId: z.string().uuid().optional(),
    routineKey: routineKey.optional(),
    notes: z.string().trim().max(MAX_WORKOUT_NOTES_CHARS).optional(),
  })
  .strict()
  .superRefine((w, ctx) => {
    if ((w.routineId === undefined) === (w.routineKey === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Indica exactamente uno de routineId o routineKey" })
    }
  })

export type PlanWeekMetaInput = z.infer<typeof planWeekMetaInputSchema>
export type PlanInlineRoutineInput = z.infer<typeof planInlineRoutineInputSchema>
export type PlanWorkoutInput = z.infer<typeof planWorkoutInputSchema>

const weekMetaList = z.array(planWeekMetaInputSchema).max(MAX_PLAN_WEEKS)
const routineList = z.array(planInlineRoutineInputSchema).max(MAX_PLAN_INLINE_ROUTINES)
const workoutList = z.array(planWorkoutInputSchema).max(MAX_PLAN_WORKOUTS)

// Reglas cruzadas comunes a create y update
function checkKeysAndWeekMeta(
  v: { routines?: PlanInlineRoutineInput[]; weekMeta?: PlanWeekMetaInput[]; workoutLists: [string, PlanWorkoutInput[] | undefined][] },
  ctx: z.RefinementCtx,
) {
  const keys = new Set<string>()
  for (const [i, r] of (v.routines ?? []).entries()) {
    if (keys.has(r.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["routines", i, "key"], message: `La key "${r.key}" está repetida` })
    keys.add(r.key)
  }
  for (const [field, list] of v.workoutLists) {
    for (const [i, w] of (list ?? []).entries()) {
      if (w.routineKey !== undefined && !keys.has(w.routineKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field, i, "routineKey"],
          message: `No hay ninguna rutina con key "${w.routineKey}" en routines`,
        })
      }
    }
  }
  const weeks = new Set<number>()
  for (const [i, m] of (v.weekMeta ?? []).entries()) {
    if (weeks.has(m.week)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weekMeta", i, "week"], message: `La semana ${m.week} está repetida` })
    weeks.add(m.week)
  }
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

/** Shape de create (sin teamId: el router lo exige y la herramienta MCP lo resuelve). */
export const planCreateShape = {
  name: z.string().trim().min(1).max(MAX_PLAN_NAME_CHARS),
  description: z.string().trim().max(MAX_PLAN_DESCRIPTION_CHARS).optional(),
  goal: z.string().trim().max(MAX_PLAN_GOAL_CHARS).optional(),
  weeks: week.describe(`Número de semanas (1..${MAX_PLAN_WEEKS})`),
  weekMeta: weekMetaList.optional(),
  routines: routineList.optional(),
  workouts: workoutList,
}

type PlanCreateFields = z.infer<z.ZodObject<typeof planCreateShape>>

export function checkPlanCreate(v: PlanCreateFields, ctx: z.RefinementCtx) {
  checkKeysAndWeekMeta({ routines: v.routines, weekMeta: v.weekMeta, workoutLists: [["workouts", v.workouts]] }, ctx)
  for (const [i, w] of v.workouts.entries()) {
    if (w.week > v.weeks) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["workouts", i, "week"], message: `La semana ${w.week} excede las ${v.weeks} del plan` })
  }
  for (const [i, m] of (v.weekMeta ?? []).entries()) {
    if (m.week > v.weeks) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weekMeta", i, "week"], message: `La semana ${m.week} excede las ${v.weeks} del plan` })
  }
}

export const planCreateInputSchema = z
  .object({ teamId: z.string().uuid(), ...planCreateShape })
  .strict()
  .superRefine(checkPlanCreate)

export const planUpdateShape = {
  planId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).describe("updatedAt que devolvió la última lectura o escritura del plan"),
  name: z.string().trim().min(1).max(MAX_PLAN_NAME_CHARS).optional(),
  description: z.string().trim().max(MAX_PLAN_DESCRIPTION_CHARS).nullable().optional(),
  goal: z.string().trim().max(MAX_PLAN_GOAL_CHARS).nullable().optional(),
  weeks: week.optional(),
  status: planStatusSchema.optional(),
  weekMeta: weekMetaList.optional().describe("Cambia nombre/enfoque/notas de esas semanas (null borra el campo)"),
  routines: routineList.optional(),
  addWorkouts: workoutList.optional(),
  removeWorkoutIds: z.array(z.string().uuid()).max(MAX_PLAN_WORKOUTS).optional(),
  replaceWorkouts: workoutList.optional().describe("Reemplaza TODOS los huecos del plan (no combina con addWorkouts/removeWorkoutIds)"),
}

type PlanUpdateFields = z.infer<z.ZodObject<typeof planUpdateShape>>

export function checkPlanUpdate(v: PlanUpdateFields, ctx: z.RefinementCtx) {
  if (v.replaceWorkouts && (v.addWorkouts || v.removeWorkoutIds)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["replaceWorkouts"], message: "replaceWorkouts no se combina con addWorkouts ni removeWorkoutIds" })
  }
  const changes = (["name", "description", "goal", "weeks", "status", "weekMeta", "addWorkouts", "removeWorkoutIds", "replaceWorkouts"] as const)
    .filter((k) => v[k] !== undefined)
  if (changes.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "No hay cambios: indica al menos un campo a modificar" })
  checkKeysAndWeekMeta(
    { routines: v.routines, weekMeta: v.weekMeta, workoutLists: [["addWorkouts", v.addWorkouts], ["replaceWorkouts", v.replaceWorkouts]] },
    ctx,
  )
}

export const planUpdateInputSchema = z.object(planUpdateShape).strict().superRefine(checkPlanUpdate)

export const planDuplicateShape = {
  planId: z.string().uuid(),
  name: z.string().trim().min(1).max(MAX_PLAN_NAME_CHARS).optional(),
  copyRoutines: z.boolean().default(false).describe("Si es true, también duplica las rutinas del plan y la copia apunta a ellas"),
}
export const planDuplicateInputSchema = z.object(planDuplicateShape).strict()

export const planScheduleShape = {
  planId: z.string().uuid(),
  athleteIds: z.array(z.string().min(1)).min(1).max(MAX_SCHEDULE_ATHLETES),
  startDate: z.string().date().describe("YYYY-MM-DD; la semana 1 es la semana (lunes a domingo) que la contiene"),
  dryRun: z.boolean().default(false).describe("true = solo calcula las fechas, no guarda nada"),
}
export const planScheduleInputSchema = z.object(planScheduleShape).strict()

export const planCancelAssignmentShape = {
  assignmentId: z.string().uuid(),
  fromDate: z.string().date().optional().describe("Solo cancela las sesiones con fecha igual o posterior (YYYY-MM-DD)"),
}
export const planCancelAssignmentInputSchema = z.object(planCancelAssignmentShape).strict()

export type PlanCreateInput = z.infer<typeof planCreateInputSchema>
export type PlanUpdateInput = z.infer<typeof planUpdateInputSchema>
export type PlanDuplicateInput = z.infer<typeof planDuplicateInputSchema>
export type PlanScheduleInput = z.infer<typeof planScheduleInputSchema>
export type PlanCancelAssignmentInput = z.infer<typeof planCancelAssignmentInputSchema>
