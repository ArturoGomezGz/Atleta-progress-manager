// Calendario de un plan de entrenamiento: convierte los huecos (semana + día) en fechas
// a partir de la fecha de inicio. Módulo puro, sin base de datos ni reloj.
//
// Reglas (ver docs/mcp.md, "Planes de entrenamiento"):
//   - weekday es ISO: 1 = lunes … 7 = domingo;
//   - la semana 1 es la semana (lunes a domingo) que contiene startDate;
//   - fecha de un hueco = lunesDe(startDate) + (semana − 1)·7 + (weekday − 1);
//   - se omiten (y se reportan en `skipped`) los huecos antes de startDate, los que caen
//     antes de hoy y los que no tienen rutina, en ese orden de prioridad.
// Todas las fechas son YYYY-MM-DD y se calculan en UTC (sin zona horaria).

export type PlanCalendarWorkout = {
  id: string
  weekNumber: number
  weekday: number
  position: number
  routineId: string | null
}

export type PlanCalendarEntry = {
  workoutId: string
  date: string
  routineId: string
  week: number
  weekday: number
  position: number
}

export type PlanSkipReason = "before_start" | "past" | "no_routine"

export type PlanCalendarSkip = {
  workoutId: string
  week: number
  weekday: number
  reason: PlanSkipReason
}

const DAY_MS = 86_400_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDate(value: string): Date {
  const d = new Date(`${value}T00:00:00Z`)
  if (!DATE_RE.test(value) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(`Fecha inválida: ${value}`)
  }
  return d
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD. */
export function isoWeekday(date: string): number {
  return ((parseDate(date).getUTCDay() + 6) % 7) + 1
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return format(new Date(parseDate(date).getTime() + days * DAY_MS))
}

/** Lunes de la semana (lunes a domingo) que contiene la fecha. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

/** Fecha de un hueco del plan (semana 1 = la semana de startDate). */
export function workoutDate(startDate: string, weekNumber: number, weekday: number): string {
  return addDays(mondayOf(startDate), (weekNumber - 1) * 7 + (weekday - 1))
}

/**
 * Fechas de los huecos de un plan aplicado desde `startDate`, con "hoy" = `today`.
 * `entries` sale ordenado por fecha y, dentro del mismo día, por `position`; `skipped`
 * en el mismo orden. Las comparaciones de fechas YYYY-MM-DD son lexicográficas.
 */
export function computePlanCalendar(a: {
  startDate: string
  today: string
  workouts: readonly PlanCalendarWorkout[]
}): { entries: PlanCalendarEntry[]; skipped: PlanCalendarSkip[] } {
  parseDate(a.today)
  const ordered = a.workouts
    .map((w) => ({ w, date: workoutDate(a.startDate, w.weekNumber, w.weekday) }))
    .sort((x, y) => (x.date === y.date ? x.w.position - y.w.position : x.date < y.date ? -1 : 1))

  const entries: PlanCalendarEntry[] = []
  const skipped: PlanCalendarSkip[] = []
  for (const { w, date } of ordered) {
    const reason: PlanSkipReason | null =
      date < a.startDate ? "before_start" : date < a.today ? "past" : w.routineId === null ? "no_routine" : null
    if (reason) {
      skipped.push({ workoutId: w.id, week: w.weekNumber, weekday: w.weekday, reason })
      continue
    }
    entries.push({ workoutId: w.id, date, routineId: w.routineId!, week: w.weekNumber, weekday: w.weekday, position: w.position })
  }
  return { entries, skipped }
}
