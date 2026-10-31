// Calendario del atleta (sessions.myCalendar): forma del item y reglas de fecha/orden, puras.

import type { RoutineKind } from "./routine-kind"
import type { SessionLockReason } from "./session-rules"

export const MAX_CALENDAR_DAYS = 62

/** Un entrenamiento o evaluación del atleta en el calendario. Tipo de salida de `sessions.myCalendar` (por inferencia de tRPC). */
export type MyCalendarItem = {
  sessionId: string
  teamId: string
  teamName: string
  routineName: string | null
  category: "evaluation" | "training" | null
  kind: RoutineKind | null
  /** Orden dentro del día (0 = primero). */
  position: number
  /** Fecha en que se muestra (YYYY-MM-DD); ver `calendarDate`. */
  scheduledDate: string
  /** Hora sugerida "HH:MM", solo informativa. */
  scheduledTime: string | null
  /** Estado del atleta (no el agregado de la sesión). */
  status: "scheduled" | "active" | "completed" | "cancelled"
  completedAt: string | null
  exerciseCount: number
  locked: boolean
  lockReason: SessionLockReason | null
}

const utcDay = (d: Date) => d.toISOString().split("T")[0]!

/**
 * Día en que se muestra una sesión:
 *  - con `scheduledDate`, ese día;
 *  - sin fecha ("Ahora") y todavía pendiente (scheduled/active del atleta): HOY, para que siga a la vista
 *    hasta que se haga;
 *  - sin fecha y ya terminada o cancelada: el día en que se creó (startedAt, UTC), como en `sessions.list`.
 */
export function calendarDate(s: {
  scheduledDate: string | null
  startedAt: Date
  athleteStatus: "scheduled" | "active" | "completed" | "cancelled"
  today: string
}): string {
  if (s.scheduledDate) return s.scheduledDate
  const pending = s.athleteStatus === "scheduled" || s.athleteStatus === "active"
  return pending ? s.today : utcDay(s.startedAt)
}

/** Fecha asc, luego position asc, luego hora sugerida (sin hora al final). */
export function compareCalendarItems(a: MyCalendarItem, b: MyCalendarItem): number {
  if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate < b.scheduledDate ? -1 : 1
  if (a.position !== b.position) return a.position - b.position
  if (a.scheduledTime !== b.scheduledTime) {
    if (a.scheduledTime === null) return 1
    if (b.scheduledTime === null) return -1
    return a.scheduledTime < b.scheduledTime ? -1 : 1
  }
  return 0
}
