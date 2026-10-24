// Asignar una rutina a atletas: lógica transaccional compartida por sessions.create,
// sessions.createMany y la programación de planes (plans.schedule).
//
// Cada sesión guarda un snapshot del contenido de la rutina (training_session.content,
// session_exercise y session_set_target): editar la rutina después NO cambia lo ya
// asignado. Los asserts de rol y de flags los hace quien llama.

import { db } from "@atleta/db/client"
import { athleteSession, routine, sessionExercise, sessionSetTarget, teamMember, trainingSession } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, or } from "drizzle-orm"
import { flattenContent, targetsForExercise } from "./routine-content"

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Reader = Pick<Tx, "select">
type Writer = Pick<Tx, "insert">

/** "Hoy" en UTC (YYYY-MM-DD), el mismo criterio que usa sessions.create desde siempre. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().split("T")[0]!
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

  // Aplanar ejercicios del content (ejercicios individuales + ejercicios dentro de circuitos)
  const allExercises = flattenContent(a.routine.content)
  // En entrenamiento el atleta activa su propia sesión; en evaluación el coach controla todo
  const athleteInitialStatus = a.routine.category === "training" ? ("scheduled" as const) : ("active" as const)

  const sessions: (typeof trainingSession.$inferSelect)[] = []
  for (const [i, date] of a.dates.entries()) {
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
    sessions.push(session!)
  }
  return sessions
}
