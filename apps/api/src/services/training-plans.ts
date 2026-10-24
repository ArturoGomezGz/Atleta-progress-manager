// Planes de entrenamiento multi-semana (flag `training_plans`): lógica con base de datos
// que usan el router plans.* y, a través de él, las herramientas MCP de planes.
//
// Modelo (ver docs/mcp.md, "Planes de entrenamiento"): training_plan → training_plan_week
// (una fila por semana) → training_plan_workout (huecos semana + día ISO + posición, cada
// uno con una rutina). Programar un plan crea un training_plan_assignment y, por cada
// hueco con fecha válida, un training_session normal con createAssignedSessions (mismo
// snapshot de contenido que sessions.create). Editar el plan o sus rutinas después NO
// cambia lo ya programado.
//
// Cada función recibe al usuario que actúa y aplica assertCoach/assertMember; el flag lo
// exige el router (featureProcedure("training_plans")).

import { db } from "@atleta/db/client"
import {
  athleteSession,
  routine,
  trainingPlan,
  trainingPlanAssignment,
  trainingPlanWeek,
  trainingPlanWorkout,
  trainingSession,
  user,
  type RoutineContent,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm"
import { assertFeature } from "../lib/features"
import { ErrorDetails } from "../mcp/errors"
import { assertCoach, assertMember } from "../routers/teams"
import { assertExercisesVisible } from "./exercise-visibility"
import { computePlanCalendar, type PlanCalendarSkip } from "./plan-calendar"
import { normalizeRoutineContent } from "./routine-content-input"
import { flattenContent } from "./routine-content"
import { assertAssignableAthletes, createAssignedSessions, type Tx } from "./session-assign"
import {
  MAX_PLAN_WORKOUTS,
  MAX_SCHEDULE_SESSIONS,
  type PlanCancelAssignmentInput,
  type PlanCreateInput,
  type PlanDuplicateInput,
  type PlanInlineRoutineInput,
  type PlanScheduleInput,
  type PlanUpdateInput,
  type PlanWeekMetaInput,
  type PlanWorkoutInput,
} from "./training-plan-input"

export * from "./training-plan-input"

export type PlanActor = { id: string; email: string }

type PlanRow = typeof trainingPlan.$inferSelect
type WorkoutRow = typeof trainingPlanWorkout.$inferSelect
type RoutineRow = typeof routine.$inferSelect

const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message })

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadPlan(planId: string): Promise<PlanRow> {
  const [p] = await db.select().from(trainingPlan).where(eq(trainingPlan.id, planId)).limit(1)
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "No existe ese plan. Búscalo con list_plans." })
  return p
}

/** updatedAt nuevo, siempre posterior al anterior (la concurrencia optimista lo compara). */
function nextUpdatedAt(previous?: Date): Date {
  const now = new Date()
  return previous && now.getTime() <= previous.getTime() ? new Date(previous.getTime() + 1) : now
}

// Mismo criterio que routines.duplicate: ids nuevos para cada ítem/ejercicio, porque
// RoutineExerciseContent.id lo referencia athleteSetCompletion.routineExerciseId.
function cloneRoutineContent(content: RoutineContent): RoutineContent {
  return {
    ...content,
    items: content.items.map((item) =>
      item.type === "exercise"
        ? { ...item, id: crypto.randomUUID(), sets: item.sets.map((s) => ({ ...s })) }
        : {
            ...item,
            id: crypto.randomUUID(),
            exercises: item.exercises.map((e) => ({ ...e, id: crypto.randomUUID(), sets: e.sets.map((s) => ({ ...s })) })),
          },
    ),
  }
}

type PreparedRoutine = { key: string; name: string; content: RoutineContent }

/**
 * Normaliza el contenido de las rutinas inline y exige que sus ejercicios sean visibles
 * para quien edita (mismo criterio que routines.updateContent). Fuera de la transacción.
 */
async function prepareInlineRoutines(actor: PlanActor, teamId: string, routines: PlanInlineRoutineInput[] | undefined) {
  const prepared: PreparedRoutine[] = (routines ?? []).map((r) => ({ key: r.key, name: r.name, content: normalizeRoutineContent(r.content) }))
  const exerciseIds = prepared.flatMap((r) => flattenContent(r.content).map((e) => e.exerciseId))
  await assertExercisesVisible(exerciseIds, { userId: actor.id, teamId })
  return prepared
}

/** Una rutina usable en un plan: del mismo equipo, de entrenamiento y no archivada. */
function routineProblem(r: Pick<RoutineRow, "teamId" | "category" | "archivedAt"> | undefined, teamId: string): string | null {
  if (!r || r.teamId !== teamId) return "no existe en este equipo"
  if (r.category !== "training") return "es de evaluación (los planes solo admiten rutinas de entrenamiento)"
  if (r.archivedAt) return "está archivada (restáurala o usa otra)"
  return null
}

async function loadUsableRoutines(reader: Pick<Tx, "select">, teamId: string, routineIds: readonly string[]) {
  const unique = [...new Set(routineIds)]
  const rows = unique.length > 0 ? await reader.select().from(routine).where(inArray(routine.id, unique)) : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const problems = unique.flatMap((id) => {
    const problem = routineProblem(byId.get(id), teamId)
    return problem ? [`${id} ${problem}`] : []
  })
  if (problems.length > 0) throw badRequest(`Rutina no válida para el plan: ${problems.slice(0, 5).join("; ")}`)
  return byId
}

async function insertInlineRoutines(tx: Tx, actor: PlanActor, teamId: string, prepared: PreparedRoutine[]) {
  const keyToId = new Map<string, string>()
  if (prepared.length === 0) return { keyToId, created: [] as { key: string; routineId: string }[] }
  const now = new Date()
  const rows = await tx
    .insert(routine)
    .values(prepared.map((r) => ({ name: r.name, teamId, createdBy: actor.id, category: "training" as const, content: r.content, createdAt: now, updatedAt: now })))
    .returning({ id: routine.id })
  const created = prepared.map((r, i) => ({ key: r.key, routineId: rows[i]!.id }))
  for (const c of created) keyToId.set(c.key, c.routineId)
  return { keyToId, created }
}

const slotKey = (week: number, weekday: number) => `${week}:${weekday}`

/** Filas de huecos nuevos: posición = siguiente libre del mismo día, en orden de llegada. */
function workoutRows(
  planId: string,
  workouts: PlanWorkoutInput[],
  keyToId: Map<string, string>,
  nextPosition: Map<string, number> = new Map(),
) {
  const now = new Date()
  return workouts.map((w) => {
    const key = slotKey(w.week, w.weekday)
    const position = nextPosition.get(key) ?? 0
    nextPosition.set(key, position + 1)
    const routineId = w.routineId ?? keyToId.get(w.routineKey!)
    if (!routineId) throw badRequest(`No hay ninguna rutina con key "${w.routineKey}" en routines`)
    return { planId, weekNumber: w.week, weekday: w.weekday, position, routineId, notes: w.notes || null, createdAt: now }
  })
}

const metaValues = (m: PlanWeekMetaInput) => ({
  ...(m.name !== undefined && { name: m.name || null }),
  ...(m.focus !== undefined && { focus: m.focus || null }),
  ...(m.notes !== undefined && { notes: m.notes || null }),
})

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function listPlans(actor: PlanActor, input: { teamId: string; includeArchived?: boolean }) {
  await assertMember(actor.id, input.teamId)
  const conditions = [eq(trainingPlan.teamId, input.teamId)]
  if (!input.includeArchived) conditions.push(ne(trainingPlan.status, "archived"))

  const workoutCount = db
    .select({ planId: trainingPlanWorkout.planId, workouts: sql<number>`count(*)::int`.as("workouts") })
    .from(trainingPlanWorkout)
    .groupBy(trainingPlanWorkout.planId)
    .as("wc")
  const activeAssignments = db
    .select({ planId: trainingPlanAssignment.planId, active: sql<number>`count(*)::int`.as("active") })
    .from(trainingPlanAssignment)
    .where(eq(trainingPlanAssignment.status, "active"))
    .groupBy(trainingPlanAssignment.planId)
    .as("aa")

  const rows = await db
    .select({
      plan: trainingPlan,
      workoutCount: sql<number>`coalesce(${workoutCount.workouts}, 0)`,
      activeAssignments: sql<number>`coalesce(${activeAssignments.active}, 0)`,
    })
    .from(trainingPlan)
    .leftJoin(workoutCount, eq(workoutCount.planId, trainingPlan.id))
    .leftJoin(activeAssignments, eq(activeAssignments.planId, trainingPlan.id))
    .where(and(...conditions))
    .orderBy(desc(trainingPlan.updatedAt))

  return {
    teamId: input.teamId,
    plans: rows.map(({ plan, workoutCount, activeAssignments }) => ({
      planId: plan.id,
      name: plan.name,
      goal: plan.goal,
      weeks: plan.weeksCount,
      status: plan.status,
      workoutCount: Number(workoutCount),
      activeAssignments: Number(activeAssignments),
      updatedAt: plan.updatedAt.toISOString(),
    })),
  }
}

export async function getPlan(actor: PlanActor, input: { planId: string }) {
  const plan = await loadPlan(input.planId)
  const member = await assertMember(actor.id, plan.teamId)

  const [weeks, workouts] = await Promise.all([
    db.select().from(trainingPlanWeek).where(eq(trainingPlanWeek.planId, plan.id)).orderBy(asc(trainingPlanWeek.weekNumber)),
    db
      .select({ workout: trainingPlanWorkout, routineName: routine.name })
      .from(trainingPlanWorkout)
      .leftJoin(routine, eq(trainingPlanWorkout.routineId, routine.id))
      .where(eq(trainingPlanWorkout.planId, plan.id))
      .orderBy(asc(trainingPlanWorkout.weekNumber), asc(trainingPlanWorkout.weekday), asc(trainingPlanWorkout.position)),
  ])

  const schedule = weeks.map((w) => {
    const days = new Map<number, { workoutId: string; position: number; routineId: string | null; routineName: string | null; notes: string | null }[]>()
    for (const { workout, routineName } of workouts) {
      if (workout.weekNumber !== w.weekNumber) continue
      const list = days.get(workout.weekday) ?? []
      list.push({ workoutId: workout.id, position: workout.position, routineId: workout.routineId, routineName: routineName ?? null, notes: workout.notes })
      days.set(workout.weekday, list)
    }
    return {
      week: w.weekNumber,
      name: w.name,
      focus: w.focus,
      notes: w.notes,
      days: [...days.entries()].map(([weekday, list]) => ({ weekday, workouts: list })),
    }
  })

  return {
    planId: plan.id,
    teamId: plan.teamId,
    name: plan.name,
    description: plan.description,
    goal: plan.goal,
    weeks: plan.weeksCount,
    status: plan.status,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    schedule,
    // Las asignaciones (y sus atletas) solo las ve el coach
    assignments: member.role === "coach" ? await assignmentsOf(plan.id) : [],
  }
}

async function assignmentsOf(planId: string) {
  const assignments = await db
    .select()
    .from(trainingPlanAssignment)
    .where(eq(trainingPlanAssignment.planId, planId))
    .orderBy(desc(trainingPlanAssignment.createdAt))
  if (assignments.length === 0) return []

  const ids = assignments.map((a) => a.id)
  const [sessions, athletes] = await Promise.all([
    db
      .select({ id: trainingSession.id, assignmentId: trainingSession.planAssignmentId, status: trainingSession.status })
      .from(trainingSession)
      .where(inArray(trainingSession.planAssignmentId, ids)),
    db
      .select({ sessionId: athleteSession.sessionId, assignmentId: trainingSession.planAssignmentId, athleteId: athleteSession.athleteId, name: user.name, status: athleteSession.status })
      .from(athleteSession)
      .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
      .innerJoin(user, eq(athleteSession.athleteId, user.id))
      .where(inArray(trainingSession.planAssignmentId, ids))
      .orderBy(asc(user.name)),
  ])

  // Una sesión cuenta como completada si la cerró el coach o si todos sus atletas activos la terminaron
  const athletesBySession = new Map<string, string[]>()
  for (const a of athletes) {
    if (a.status === "cancelled") continue
    athletesBySession.set(a.sessionId, [...(athletesBySession.get(a.sessionId) ?? []), a.status])
  }

  return assignments.map((a) => {
    const own = sessions.filter((s) => s.assignmentId === a.id)
    const cancelled = own.filter((s) => s.status === "cancelled").length
    const completed = own.filter((s) => {
      if (s.status === "completed") return true
      if (s.status === "cancelled") return false
      const statuses = athletesBySession.get(s.id) ?? []
      return statuses.length > 0 && statuses.every((st) => st === "completed")
    }).length
    const seen = new Map<string, { athleteId: string; name: string }>()
    for (const at of athletes) if (at.assignmentId === a.id && !seen.has(at.athleteId)) seen.set(at.athleteId, { athleteId: at.athleteId, name: at.name })
    return {
      assignmentId: a.id,
      startDate: a.startDate,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      cancelledAt: a.cancelledAt?.toISOString() ?? null,
      athletes: [...seen.values()],
      sessions: { total: own.length, completed, cancelled },
    }
  })
}

// ─── Escritura ────────────────────────────────────────────────────────────────

export async function createPlan(actor: PlanActor, input: PlanCreateInput) {
  await assertCoach(actor.id, input.teamId)
  const prepared = await prepareInlineRoutines(actor, input.teamId, input.routines)
  await loadUsableRoutines(db, input.teamId, input.workouts.flatMap((w) => (w.routineId ? [w.routineId] : [])))

  return db.transaction(async (tx) => {
    const now = new Date()
    const [plan] = await tx
      .insert(trainingPlan)
      .values({
        teamId: input.teamId,
        createdBy: actor.id,
        name: input.name,
        description: input.description || null,
        goal: input.goal || null,
        weeksCount: input.weeks,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const meta = new Map((input.weekMeta ?? []).map((m) => [m.week, m]))
    await tx.insert(trainingPlanWeek).values(
      Array.from({ length: input.weeks }, (_, i) => {
        const m = meta.get(i + 1)
        return { planId: plan!.id, weekNumber: i + 1, name: m?.name || null, focus: m?.focus || null, notes: m?.notes || null }
      }),
    )

    const { keyToId, created } = await insertInlineRoutines(tx, actor, input.teamId, prepared)
    const rows = workoutRows(plan!.id, input.workouts, keyToId)
    if (rows.length > 0) await tx.insert(trainingPlanWorkout).values(rows)

    return { planId: plan!.id, updatedAt: plan!.updatedAt.toISOString(), createdRoutines: created, workoutCount: rows.length }
  })
}

export async function updatePlan(actor: PlanActor, input: PlanUpdateInput) {
  const current = await loadPlan(input.planId)
  await assertCoach(actor.id, current.teamId)
  const teamId = current.teamId
  const prepared = await prepareInlineRoutines(actor, teamId, input.routines)
  const incoming = [...(input.addWorkouts ?? []), ...(input.replaceWorkouts ?? [])]
  await loadUsableRoutines(db, teamId, incoming.flatMap((w) => (w.routineId ? [w.routineId] : [])))

  return db.transaction(async (tx) => {
    const [plan] = await tx.select().from(trainingPlan).where(eq(trainingPlan.id, input.planId)).for("update")
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "No existe ese plan. Búscalo con list_plans." })
    if (plan.updatedAt.getTime() !== Date.parse(input.expectedUpdatedAt)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "El plan cambió desde que lo leíste.",
        cause: new ErrorDetails({ updatedAt: plan.updatedAt.toISOString() }),
      })
    }

    const existing = await tx.select().from(trainingPlanWorkout).where(eq(trainingPlanWorkout.planId, plan.id))
    const existingIds = new Set(existing.map((w) => w.id))
    const removeIds = new Set(input.removeWorkoutIds ?? [])
    const unknown = [...removeIds].filter((id) => !existingIds.has(id))
    if (unknown.length > 0) throw badRequest(`Estos huecos no son del plan: ${unknown.slice(0, 5).join(", ")}. Consulta los ids con get_plan.`)

    const kept: WorkoutRow[] = input.replaceWorkouts ? [] : existing.filter((w) => !removeIds.has(w.id))
    const added = input.replaceWorkouts ?? input.addWorkouts ?? []
    const weeks = input.weeks ?? plan.weeksCount

    if (kept.length + added.length > MAX_PLAN_WORKOUTS) throw badRequest(`Un plan admite como máximo ${MAX_PLAN_WORKOUTS} entrenamientos`)
    const outside = [...kept.map((w) => w.weekNumber), ...added.map((w) => w.week), ...(input.weekMeta ?? []).map((m) => m.week)]
      .filter((w) => w > weeks)
    if (outside.length > 0) {
      throw badRequest(
        `El plan quedaría con ${weeks} semanas pero hay datos en la semana ${Math.max(...outside)}; ` +
          "quita esos huecos (removeWorkoutIds o replaceWorkouts) o aumenta weeks",
      )
    }

    // Semanas nuevas antes de insertar huecos (FK plan_id + week_number)
    if (weeks > plan.weeksCount) {
      await tx.insert(trainingPlanWeek).values(
        Array.from({ length: weeks - plan.weeksCount }, (_, i) => ({ planId: plan.id, weekNumber: plan.weeksCount + i + 1 })),
      )
    }

    if (input.replaceWorkouts) await tx.delete(trainingPlanWorkout).where(eq(trainingPlanWorkout.planId, plan.id))
    else if (removeIds.size > 0) await tx.delete(trainingPlanWorkout).where(inArray(trainingPlanWorkout.id, [...removeIds]))

    const { keyToId, created } = await insertInlineRoutines(tx, actor, teamId, prepared)
    const nextPosition = new Map<string, number>()
    for (const w of kept) {
      const key = slotKey(w.weekNumber, w.weekday)
      nextPosition.set(key, Math.max(nextPosition.get(key) ?? 0, w.position + 1))
    }
    const rows = workoutRows(plan.id, added, keyToId, nextPosition)
    if (rows.length > 0) await tx.insert(trainingPlanWorkout).values(rows)

    // Reducir semanas solo cuando ya no quedan huecos fuera (verificado arriba)
    if (weeks < plan.weeksCount) {
      await tx.delete(trainingPlanWeek).where(and(eq(trainingPlanWeek.planId, plan.id), sql`${trainingPlanWeek.weekNumber} > ${weeks}`))
    }

    for (const m of input.weekMeta ?? []) {
      const values = metaValues(m)
      if (Object.keys(values).length === 0) continue
      await tx.update(trainingPlanWeek).set(values).where(and(eq(trainingPlanWeek.planId, plan.id), eq(trainingPlanWeek.weekNumber, m.week)))
    }

    const updatedAt = nextUpdatedAt(plan.updatedAt)
    await tx
      .update(trainingPlan)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.goal !== undefined && { goal: input.goal || null }),
        ...(input.status !== undefined && { status: input.status }),
        weeksCount: weeks,
        updatedAt,
      })
      .where(eq(trainingPlan.id, plan.id))

    return { planId: plan.id, updatedAt: updatedAt.toISOString(), createdRoutines: created, workoutCount: kept.length + rows.length }
  })
}

export async function duplicatePlan(actor: PlanActor, input: PlanDuplicateInput) {
  const source = await loadPlan(input.planId)
  await assertCoach(actor.id, source.teamId)

  return db.transaction(async (tx) => {
    const [weeks, workouts] = await Promise.all([
      tx.select().from(trainingPlanWeek).where(eq(trainingPlanWeek.planId, source.id)),
      tx.select().from(trainingPlanWorkout).where(eq(trainingPlanWorkout.planId, source.id)),
    ])

    // copyRoutines: una copia de cada rutina distinta del plan; la copia del plan apunta a ellas
    const routineMap = new Map<string, string>()
    const createdRoutines: { sourceRoutineId: string; routineId: string; name: string }[] = []
    if (input.copyRoutines) {
      const ids = [...new Set(workouts.flatMap((w) => (w.routineId ? [w.routineId] : [])))]
      const originals = ids.length > 0 ? await tx.select().from(routine).where(inArray(routine.id, ids)) : []
      const now = new Date()
      for (const r of originals) {
        const name = `${r.name} (copia)`
        const [copy] = await tx
          .insert(routine)
          .values({ name, teamId: r.teamId, createdBy: actor.id, category: r.category, content: cloneRoutineContent(r.content), createdAt: now, updatedAt: now })
          .returning({ id: routine.id })
        routineMap.set(r.id, copy!.id)
        createdRoutines.push({ sourceRoutineId: r.id, routineId: copy!.id, name })
      }
    }

    const now = new Date()
    const [plan] = await tx
      .insert(trainingPlan)
      .values({
        teamId: source.teamId,
        createdBy: actor.id,
        name: input.name ?? `${source.name} (copia)`,
        description: source.description,
        goal: source.goal,
        weeksCount: source.weeksCount,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (weeks.length > 0) {
      await tx.insert(trainingPlanWeek).values(weeks.map((w) => ({ planId: plan!.id, weekNumber: w.weekNumber, name: w.name, focus: w.focus, notes: w.notes })))
    }
    if (workouts.length > 0) {
      await tx.insert(trainingPlanWorkout).values(
        workouts.map((w) => ({
          planId: plan!.id,
          weekNumber: w.weekNumber,
          weekday: w.weekday,
          position: w.position,
          routineId: w.routineId ? (routineMap.get(w.routineId) ?? w.routineId) : null,
          notes: w.notes,
          createdAt: now,
        })),
      )
    }
    return { planId: plan!.id, name: plan!.name, updatedAt: plan!.updatedAt.toISOString(), workoutCount: workouts.length, createdRoutines }
  })
}

export type ScheduledPlanSession = {
  date: string
  week: number
  weekday: number
  position: number
  workoutId: string
  routineId: string
  routineName: string
  sessionId?: string
  status?: "scheduled" | "active"
}

/**
 * Aplica el plan a atletas desde `startDate`. Con `dryRun` solo calcula (no escribe);
 * si no, crea en una transacción la asignación y una sesión por hueco programable.
 */
export async function schedulePlan(actor: PlanActor, input: PlanScheduleInput, opts: { today: string }) {
  const plan = await loadPlan(input.planId)
  await assertCoach(actor.id, plan.teamId)
  if (plan.status === "archived") throw badRequest("El plan está archivado; cambia su estado con update_plan para poder programarlo")

  const athleteIds = [...new Set(input.athleteIds)]
  await assertAssignableAthletes(db, plan.teamId, athleteIds)

  const workouts = await db.select().from(trainingPlanWorkout).where(eq(trainingPlanWorkout.planId, plan.id))
  const { entries, skipped } = computePlanCalendar({ startDate: input.startDate, today: opts.today, workouts })
  const routines = await loadUsableRoutines(db, plan.teamId, entries.map((e) => e.routineId))

  const total = entries.length * athleteIds.length
  if (total > MAX_SCHEDULE_SESSIONS) {
    throw badRequest(
      `Se crearían ${total} sesiones de atleta (${entries.length} entrenamientos × ${athleteIds.length} atletas); ` +
        `el máximo por aplicación es ${MAX_SCHEDULE_SESSIONS}. Programa a menos atletas a la vez.`,
    )
  }

  const sessions: ScheduledPlanSession[] = entries.map((e) => ({
    date: e.date,
    week: e.week,
    weekday: e.weekday,
    position: e.position,
    workoutId: e.workoutId,
    routineId: e.routineId,
    routineName: routines.get(e.routineId)!.name,
  }))
  const result = (assignmentId: string | null, list: ScheduledPlanSession[], skippedList: PlanCalendarSkip[]) => ({
    assignmentId,
    dryRun: input.dryRun,
    startDate: input.startDate,
    athleteIds,
    sessions: list,
    skipped: skippedList,
  })

  if (input.dryRun) return result(null, sessions, skipped)

  if (entries.length === 0) {
    throw badRequest("Ningún entrenamiento del plan cae en una fecha programable (desde la fecha de inicio y desde hoy). Revisa startDate con dryRun.")
  }
  // Ya lo exige training_plans (REQUIRES), pero las fechas futuras son justo lo que protege el flag
  if (entries.some((e) => e.date > opts.today)) assertFeature(actor, "scheduled_sessions")

  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .insert(trainingPlanAssignment)
      .values({ planId: plan.id, teamId: plan.teamId, assignedBy: actor.id, startDate: input.startDate })
      .returning()

    // Una llamada a createAssignedSessions por rutina (mismo snapshot que sessions.create)
    const byRoutine = new Map<string, number[]>()
    entries.forEach((e, i) => byRoutine.set(e.routineId, [...(byRoutine.get(e.routineId) ?? []), i]))
    const out = [...sessions]
    for (const [routineId, indexes] of byRoutine) {
      const created = await createAssignedSessions(tx, {
        routine: routines.get(routineId)!,
        teamId: plan.teamId,
        athleteIds,
        dates: indexes.map((i) => entries[i]!.date),
        startedBy: actor.id,
        planAssignmentId: assignment!.id,
        planWorkoutIds: indexes.map((i) => entries[i]!.workoutId),
        today: opts.today,
      })
      created.forEach((s, j) => {
        const i = indexes[j]!
        out[i] = { ...out[i]!, sessionId: s.id, status: s.status === "scheduled" ? "scheduled" : "active" }
      })
    }
    return result(assignment!.id, out, skipped)
  })
}

/**
 * Cancela las sesiones de una asignación que todavía no empezó ningún atleta (desde
 * `fromDate` si se indica). Las iniciadas o completadas se conservan. Sin `fromDate` la
 * asignación queda cancelada.
 */
export async function cancelPlanAssignment(actor: PlanActor, input: PlanCancelAssignmentInput) {
  const [assignment] = await db.select().from(trainingPlanAssignment).where(eq(trainingPlanAssignment.id, input.assignmentId)).limit(1)
  if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "No existe esa asignación de plan. Consulta las asignaciones con get_plan." })
  await assertCoach(actor.id, assignment.teamId)

  return db.transaction(async (tx) => {
    const sessions = await tx
      .select({ id: trainingSession.id, scheduledDate: trainingSession.scheduledDate, status: trainingSession.status })
      .from(trainingSession)
      .where(eq(trainingSession.planAssignmentId, assignment.id))
      .for("update")
    const started = new Set(
      sessions.length === 0
        ? []
        : (
            await tx
              .select({ sessionId: athleteSession.sessionId })
              .from(athleteSession)
              .where(and(inArray(athleteSession.sessionId, sessions.map((s) => s.id)), inArray(athleteSession.status, ["active", "completed"])))
          ).map((r) => r.sessionId),
    )

    const open = sessions.filter((s) => s.status !== "cancelled")
    const toCancel = open.filter(
      (s) => s.status !== "completed" && !started.has(s.id) && (!input.fromDate || (s.scheduledDate !== null && s.scheduledDate >= input.fromDate)),
    )
    if (toCancel.length > 0) {
      await tx.update(trainingSession).set({ status: "cancelled" }).where(inArray(trainingSession.id, toCancel.map((s) => s.id)))
    }

    let status = assignment.status
    if (!input.fromDate && status !== "cancelled") {
      status = "cancelled"
      await tx.update(trainingPlanAssignment).set({ status, cancelledAt: new Date() }).where(eq(trainingPlanAssignment.id, assignment.id))
    }
    return { assignmentId: assignment.id, status, cancelledSessions: toCancel.length, keptSessions: open.length - toCancel.length }
  })
}
