// Asignar una rutina a atletas: lógica transaccional compartida por sessions.create,
// sessions.createMany y la programación de planes (plans.schedule).
//
// Cada sesión guarda un snapshot del contenido de la rutina (training_session.content,
// session_exercise y session_set_target): editar la rutina después NO cambia lo ya
// asignado. Los asserts de rol y de flags los hace quien llama.

import { db } from "@atleta/db/client"
import { athleteSession, routine, sessionExercise, sessionSetTarget, teamMember, trainingSession } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, or, sql } from "drizzle-orm"
import { flattenContent, targetsForExercise } from "./routine-content"
import { loadDayPlan, openSlot } from "./day-plan"
import { toHHMM, type RoutineKind } from "./routine-kind"

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Reader = Pick<Tx, "select">
type Writer = Pick<Tx, "insert" | "select" | "update" | "execute">

/** "Hoy" en UTC (YYYY-MM-DD), el mismo criterio que usa sessions.create desde siempre. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().split("T")[0]!
}

/**
 * "Hoy" del atleta (YYYY-MM-DD). El cliente manda la fecha local de su dispositivo (`localDate`); el
 * servidor la acepta solo si está a ±1 día de la fecha UTC (cubre todas las zonas horarias reales) y,
 * si no, usa UTC. Así un reloj mal puesto no abre días futuros.
 */
export function resolveAthleteToday(localDate?: string | null, now: Date = new Date()): string {
  const utc = todayUtc(now)
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return utc
  const diffDays = Math.abs(Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${utc}T00:00:00Z`)) / 86_400_000
  return Number.isFinite(diffDays) && diffDays <= 1 ? localDate : utc
}

/**
 * Solo atletas del equipo, o el propio coach si activó "entrenar en este equipo",
 * pueden ser asignados a una sesión.
 */
export async function assertAssignableAthletes(tx: Reader, teamId: string, athleteIds: string[]): Promise<void> {
  const eligible = await tx
    .select({ userId: teamMember.userId })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, teamId), or(eq(teamMember.role, "athlete"), eq(teamMember.selfAthlete, true))))
  const eligibleIds = new Set(eligible.map((m) => m.userId))
  const invalidIds = athleteIds.filter((id) => !eligibleIds.has(id))
  if (invalidIds.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Uno o más atletas seleccionados no pertenecen a este equipo" })
  }
}

export type AssignSessionsInput = {
  routine: typeof routine.$inferSelect
  teamId: string
  athleteIds: string[]
  /** Una sesión por elemento; null = sin fecha ("Ahora"). */
  dates: (string | null)[]
  startedBy: string
  planAssignmentId?: string
  /** Hueco del plan de cada fecha (mismo índice que `dates`). */
  planWorkoutIds?: (string | null)[]
  /** "Hoy" (YYYY-MM-DD): una fecha posterior deja la sesión programada. */
  today: string
  /** Tipo de la sesión; por defecto el de la rutina (null en evaluaciones). */
  kind?: RoutineKind
  /** Orden dentro del día (mismo índice que `dates`). Sin él (ni `position` ni `insertIndex`): al final del día. */
  positions?: number[]
  /** Un solo orden para todas las fechas (si no hay `positions`). */
  position?: number
  /**
   * Lugar en la lista del día (0..n, ver `loadDayPlan`): renumera las demás sesiones del día dejando el hueco.
   * Se evalúa por fecha. Excluyente con `position`/`positions`.
   */
  insertIndex?: number
  /** Hora sugerida "HH:MM", solo informativa. */
  scheduledTime?: string | null
}

/**
 * Crea una sesión por fecha con todos los atletas. Debe correr dentro de una
 * transacción (`db.transaction`). Devuelve las sesiones en el orden de `dates`.
 */
export async function createAssignedSessions(tx: Writer, a: AssignSessionsInput): Promise<(typeof trainingSession.$inferSelect)[]> {
  if (a.athleteIds.length === 0) throw new Error("createAssignedSessions requiere al menos un atleta")
  if (a.planWorkoutIds && a.planWorkoutIds.length !== a.dates.length) {
    throw new Error("planWorkoutIds debe tener la misma longitud que dates")
  }
  if (a.positions && a.positions.length !== a.dates.length) {
    throw new Error("positions debe tener la misma longitud que dates")
  }
  const isTraining = a.routine.category === "training"
  if (!isTraining && (a.kind !== undefined || a.position !== undefined || a.positions !== undefined || a.insertIndex !== undefined)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Las evaluaciones no tienen tipo ni orden dentro del día" })
  }
  if (a.insertIndex !== undefined && (a.position !== undefined || a.positions !== undefined)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Usa insertIndex o position, no los dos" })
  }
  // Evaluación: sin tipo ni orden. Entrenamiento: el pedido, o el de la rutina, o "main".
  const kind: RoutineKind | null = isTraining ? (a.kind ?? a.routine.kind ?? "main") : null

  // Aplanar ejercicios del content (ejercicios individuales + ejercicios dentro de circuitos)
  const allExercises = flattenContent(a.routine.content)
  // En entrenamiento el atleta activa su propia sesión; en evaluación el coach controla todo
  const athleteInitialStatus = a.routine.category === "training" ? ("scheduled" as const) : ("active" as const)

  const sessions: (typeof trainingSession.$inferSelect)[] = []
  for (const [i, originalDate] of a.dates.entries()) {
    let date = originalDate
    let position = 0
    if (isTraining) {
      const explicit = a.positions?.[i] ?? a.position
      if (explicit !== undefined) {
        position = explicit
      } else {
        // Orden dentro del día: el pedido (insertIndex) o, por defecto, al final. Se serializa por equipo y día.
        const day = date ?? a.today
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${a.teamId}:${day}`}))`)
        const plan = await loadDayPlan(tx, { teamId: a.teamId, athleteIds: a.athleteIds, date: day, today: a.today })
        if (a.insertIndex !== undefined) position = await openSlot(tx, plan, a.insertIndex, a.today)
        else position = plan.length === 0 ? 0 : Math.max(...plan.map((s) => s.position)) + 1
        // "Ahora" no forma secuencia: si el día ya tiene rutinas, la nueva se fija a hoy para que el orden se respete
        if (date === null && plan.length > 0) date = a.today
      }
    }
    const isScheduled = date != null && date > a.today
    const [session] = await tx
      .insert(trainingSession)
      .values({
        routineId: a.routine.id,
        teamId: a.teamId,
        startedBy: a.startedBy,
        scheduledDate: date,
        status: isScheduled ? "scheduled" : "active",
        content: a.routine.content,
        planAssignmentId: a.planAssignmentId ?? null,
        planWorkoutId: a.planWorkoutIds?.[i] ?? null,
        kind,
        position,
        scheduledTime: a.scheduledTime ?? null,
      })
      .returning()

    // Snapshot exercises + set targets desde el content JSON. Los ids se generan aquí
    // para insertar todo en dos sentencias (antes era un insert por ejercicio).
    if (allExercises.length > 0) {
      const rows = allExercises.map((ex, position) => ({
        id: crypto.randomUUID(),
        sessionId: session!.id,
        exerciseId: ex.exerciseId,
        order: position,
      }))
      await tx.insert(sessionExercise).values(rows)

      const targets = allExercises.flatMap((ex, position) =>
        targetsForExercise(ex.sets).map((t) => ({ ...t, sessionExerciseId: rows[position]!.id })),
      )
      if (targets.length > 0) await tx.insert(sessionSetTarget).values(targets)
    }

    await tx.insert(athleteSession).values(
      a.athleteIds.map((athleteId) => ({ sessionId: session!.id, athleteId, status: athleteInitialStatus })),
    )
    sessions.push({ ...session!, scheduledTime: toHHMM(session!.scheduledTime) })
  }
  return sessions
}
