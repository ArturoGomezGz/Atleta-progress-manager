// Plan del día: las sesiones de ENTRENAMIENTO de un equipo en un día que involucran a ciertos atletas,
// en el orden en que se harán (position asc). Lo usan `sessions.dayPlan` (para preguntarle al coach en qué
// parte del día va una rutina nueva) y la asignación (`insertIndex`, y el valor por defecto "al final").
//
// "Día" de una sesión: su `scheduledDate`; sin fecha ("Ahora") es HOY mientras el atleta no la termine y, ya
// hecha, el día UTC en que se creó (mismo criterio que `calendarDate`). Las evaluaciones no entran.

import { athleteSession, routine, trainingSession, user } from "@atleta/db/schema"
import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import type { RoutineKind } from "./routine-kind"
import type { Tx } from "./session-assign"

type Reader = Pick<Tx, "select">

export type DayPlanStatus = "pending" | "active" | "completed"

export type DayPlanEntry = {
  sessionId: string
  routineName: string
  kind: RoutineKind | null
  position: number
  athleteNames: string[]
  /** Agregado de los atletas consultados: completed si alguno la terminó, active si alguno la tiene en curso, si no pending. */
  status: DayPlanStatus
  /** Fecha guardada (null = "Ahora"); uso interno. */
  scheduledDate: string | null
}

const PENDING = ["scheduled", "active"] as const

export async function loadDayPlan(
  reader: Reader,
  a: { teamId: string; athleteIds: string[]; date: string; today: string },
): Promise<DayPlanEntry[]> {
  if (a.athleteIds.length === 0) return []
  const dayStart = new Date(`${a.date}T00:00:00.000Z`)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const isToday = a.date === a.today

  // Sin fecha: hoy mientras esté pendiente; terminada, el día en que se creó
  const undated = and(
    isNull(trainingSession.scheduledDate),
    or(
      isToday ? inArray(athleteSession.status, [...PENDING]) : undefined,
      and(
        sql`${trainingSession.startedAt} >= ${dayStart.toISOString()}::timestamptz`,
        sql`${trainingSession.startedAt} < ${dayEnd.toISOString()}::timestamptz`,
        isToday ? undefined : eq(athleteSession.status, "completed"),
      ),
    ),
  )

  const rows = await reader
    .select({
      sessionId: trainingSession.id,
      scheduledDate: trainingSession.scheduledDate,
      startedAt: trainingSession.startedAt,
      position: trainingSession.position,
      kind: trainingSession.kind,
      routineName: routine.name,
      athleteId: athleteSession.athleteId,
      athleteName: user.name,
      athleteStatus: athleteSession.status,
    })
    .from(athleteSession)
    .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
    .innerJoin(user, eq(athleteSession.athleteId, user.id))
    .leftJoin(routine, eq(trainingSession.routineId, routine.id))
    .where(and(
      eq(trainingSession.teamId, a.teamId),
      inArray(athleteSession.athleteId, a.athleteIds),
      ne(trainingSession.status, "cancelled"),
      ne(athleteSession.status, "cancelled"),
      sql`coalesce(${routine.category}, 'training') = 'training'`,
      or(eq(trainingSession.scheduledDate, a.date), undated),
    ))
    .orderBy(asc(trainingSession.position), asc(trainingSession.startedAt), asc(trainingSession.id))

  const bySession = new Map<string, DayPlanEntry & { startedAt: Date }>()
  for (const r of rows) {
    let e = bySession.get(r.sessionId)
    if (!e) {
      e = {
        sessionId: r.sessionId, routineName: r.routineName ?? "Entrenamiento", kind: r.kind, position: r.position,
        athleteNames: [], status: "pending", scheduledDate: r.scheduledDate, startedAt: r.startedAt,
      }
      bySession.set(r.sessionId, e)
    }
    e.athleteNames.push(r.athleteName)
    if (r.athleteStatus === "completed") e.status = "completed"
    else if (r.athleteStatus === "active" && e.status !== "completed") e.status = "active"
  }
  return [...bySession.values()].map(({ startedAt: _s, ...e }) => ({ ...e, athleteNames: e.athleteNames.sort((x, y) => x.localeCompare(y)) }))
}

/**
 * Hueco en `insertIndex` (0..n): valida que no quede antes de algo ya hecho o en curso y deja las posiciones
 * del día contiguas (0..n) con el hueco en `insertIndex`. Las sesiones sin fecha que siguen pendientes se
 * fijan a hoy para que el orden se respete (las "Ahora" no forman secuencia). Devuelve la posición libre.
 */
export async function openSlot(
  tx: Pick<Tx, "update">,
  plan: DayPlanEntry[],
  insertIndex: number,
  today: string,
): Promise<number> {
  if (!Number.isInteger(insertIndex) || insertIndex < 0 || insertIndex > plan.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Ese lugar no existe: el día tiene ${plan.length} rutina(s), elige un lugar entre 0 y ${plan.length}` })
  }
  if (plan.slice(insertIndex).some((s) => s.status !== "pending")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede asignar antes de una rutina que ya se completó o está en curso; elige un lugar posterior" })
  }
  for (const [i, s] of plan.entries()) {
    const position = i < insertIndex ? i : i + 1
    const pin = s.scheduledDate === null && s.status === "pending"
    if (position === s.position && !pin) continue
    await tx.update(trainingSession)
      .set({ position, ...(pin ? { scheduledDate: today } : {}) })
      .where(eq(trainingSession.id, s.sessionId))
  }
  return insertIndex
}
