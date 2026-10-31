// Reglas para iniciar un entrenamiento: no antes de su fecha, en orden dentro del día y de a uno.
//
//  - FUTURE / FUTURE_SESSION: la fecha programada es posterior a "hoy" del atleta (ver resolveAthleteToday).
//  - PREVIOUS_STEP_PENDING: solo entrenamientos. Hay otra sesión de entrenamiento del MISMO atleta y la
//    MISMA scheduledDate con position menor cuyo athlete_session no está completed ni cancelled
//    (se usa el estado por atleta, no el de la sesión). Una sesión que el coach canceló
//    (training_session.status = cancelled) no bloquea. Posiciones iguales no se bloquean entre sí, y las
//    sesiones sin fecha ("Ahora") no forman secuencia.
//  - ANOTHER_ACTIVE: solo entrenamientos. El atleta ya tiene otra sesión de entrenamiento en curso (en
//    cualquier equipo) del día de hoy o del día de la sesión que quiere iniciar. Una sesión que se quedó
//    "en curso" de un día anterior no bloquea.
//  - Las evaluaciones no participan en secuencias, pero tampoco se inician antes de su fecha.

import { db } from "@atleta/db/client"
import { athleteSession, routine, trainingSession } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, inArray, ne, sql } from "drizzle-orm"
import { ErrorDetails } from "../mcp/errors"

export type SessionLockReason = "FUTURE" | "PREVIOUS_STEP_PENDING" | "ANOTHER_ACTIVE"
/** Motivo estable de un rechazo al iniciar (`error.data.reason` en tRPC). */
export type SessionStartRefusal = "FUTURE_SESSION" | "PREVIOUS_STEP_PENDING" | "ANOTHER_ACTIVE"

const REFUSAL: Record<SessionLockReason, { reason: SessionStartRefusal; message: string }> = {
  FUTURE: { reason: "FUTURE_SESSION", message: "Este entrenamiento es de una fecha futura; aún no puedes iniciarlo." },
  PREVIOUS_STEP_PENDING: {
    reason: "PREVIOUS_STEP_PENDING",
    message: "Antes debes completar (o saltar) el entrenamiento anterior de este día.",
  },
  ANOTHER_ACTIVE: { reason: "ANOTHER_ACTIVE", message: "Ya tienes otro entrenamiento en curso; termínalo antes de iniciar este." },
}

export function startRefusalError(lock: SessionLockReason): TRPCError {
  const { reason, message } = REFUSAL[lock]
  return new TRPCError({ code: "BAD_REQUEST", message, cause: new ErrorDetails({ reason }) })
}

/** Una sesión del atleta que podría estar bloqueada. */
export type LockCandidate = {
  sessionId: string
  scheduledDate: string | null
  position: number
  /** false = evaluación (solo se comprueba la fecha). */
  isTraining: boolean
  /** Todavía no iniciada por quien la inicia (entrenamiento: athlete_session "scheduled"; evaluación: sesión "scheduled"). */
  pending: boolean
}

const utcDate = (d: Date | null | undefined) => (d ? d.toISOString().split("T")[0]! : null)

/**
 * Motivo de bloqueo (o null) de cada sesión pendiente del atleta, con pocas consultas
 * (una de hermanas del mismo día y una de sesiones en curso) sin importar cuántas filas haya.
 */
export async function computeSessionLocks(
  athleteId: string,
  candidates: LockCandidate[],
  today: string,
  reader: Pick<typeof db, "select"> = db,
): Promise<Map<string, SessionLockReason | null>> {
  const out = new Map<string, SessionLockReason | null>()
  const pendingTraining = candidates.filter((c) => c.pending && c.isTraining)

  // Hermanas: sesiones de entrenamiento del atleta en las fechas con algún paso pendiente
  const dates = [...new Set(pendingTraining.flatMap((c) => (c.scheduledDate && c.scheduledDate <= today ? [c.scheduledDate] : [])))]
  const siblings = dates.length === 0
    ? []
    : await reader
        .select({ sessionId: trainingSession.id, scheduledDate: trainingSession.scheduledDate, position: trainingSession.position, status: athleteSession.status })
        .from(athleteSession)
        .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
        .leftJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(and(
          eq(athleteSession.athleteId, athleteId),
          inArray(trainingSession.scheduledDate, dates),
          ne(trainingSession.status, "cancelled"),
          sql`coalesce(${routine.category}, 'training') = 'training'`,
        ))

  // Sesiones de entrenamiento en curso del atleta (suelen ser 0 o 1)
  const actives = pendingTraining.length === 0
    ? []
    : await reader
        .select({
          sessionId: trainingSession.id,
          scheduledDate: trainingSession.scheduledDate,
          startedAt: athleteSession.startedAt,
          sessionStartedAt: trainingSession.startedAt,
        })
        .from(athleteSession)
        .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
        .leftJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(and(
          eq(athleteSession.athleteId, athleteId),
          eq(athleteSession.status, "active"),
          ne(trainingSession.status, "cancelled"),
          sql`coalesce(${routine.category}, 'training') = 'training'`,
        ))
  const activeDays = actives.map((a) => ({ id: a.sessionId, day: a.scheduledDate ?? utcDate(a.startedAt) ?? utcDate(a.sessionStartedAt) }))

  for (const c of candidates) {
    if (!c.pending) { out.set(c.sessionId, null); continue }
    if (c.scheduledDate != null && c.scheduledDate > today) { out.set(c.sessionId, "FUTURE"); continue }
    if (!c.isTraining) { out.set(c.sessionId, null); continue }
    const blockedByPrevious = c.scheduledDate != null && siblings.some((s) =>
      s.scheduledDate === c.scheduledDate && s.sessionId !== c.sessionId && s.position < c.position &&
      s.status !== "completed" && s.status !== "cancelled")
    if (blockedByPrevious) { out.set(c.sessionId, "PREVIOUS_STEP_PENDING"); continue }
    const blockedByActive = activeDays.some((a) => a.id !== c.sessionId && (a.day === today || (c.scheduledDate != null && a.day === c.scheduledDate)))
    out.set(c.sessionId, blockedByActive ? "ANOTHER_ACTIVE" : null)
  }
  return out
}

/** Atajo para una sola sesión (activate, get, skip). */
export async function lockForSession(athleteId: string, candidate: LockCandidate, today: string): Promise<SessionLockReason | null> {
  return (await computeSessionLocks(athleteId, [candidate], today)).get(candidate.sessionId) ?? null
}
