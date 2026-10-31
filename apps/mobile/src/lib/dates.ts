const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Mismo criterio que "Mis rutinas" en web: Hoy / Mañana / fecha larga.
export function sessionDateLabel(scheduledDate: string | null, startedAt: string | Date) {
  const d = scheduledDate ? new Date(scheduledDate + "T12:00:00") : new Date(startedAt)
  const today = new Date()
  const tomorrow = new Date(Date.now() + 86_400_000)
  if (d.toDateString() === today.toDateString()) return "Hoy"
  if (d.toDateString() === tomorrow.toDateString()) return "Mañana"
  return capitalize(d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }))
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Fecha LOCAL del dispositivo como YYYY-MM-DD (la que la API espera como `localDate`). */
export function localDateISO(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Suma días a una fecha YYYY-MM-DD (calendario local, sin saltos por horario de verano). */
export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number)
  return localDateISO(new Date(y!, m! - 1, d! + days, 12))
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y!, m! - 1, d!, 12)
  return { weekday: WEEKDAYS[date.getDay()]!, day: d!, month: MONTHS[m! - 1]! }
}

/** "Sáb" */
export function weekdayShort(iso: string) {
  return capitalize(parts(iso).weekday.slice(0, 3))
}

/** "31" */
export function dayNumber(iso: string) {
  return String(parts(iso).day)
}

/** "Sábado, 31 de octubre" */
export function longDateLabel(iso: string) {
  const p = parts(iso)
  return `${capitalize(p.weekday)}, ${p.day} de ${p.month}`
}

/** "sábado 31 de octubre" (para frases: "Podrás empezarlo el ...") */
export function inlineDateLabel(iso: string) {
  const p = parts(iso)
  return `${p.weekday} ${p.day} de ${p.month}`
}

/** "Oct – Nov" para la cabecera de la tira de días. */
export function monthRangeLabel(fromIso: string, toIso: string) {
  const a = parts(fromIso).month.slice(0, 3)
  const b = parts(toIso).month.slice(0, 3)
  return a === b ? capitalize(a) : `${capitalize(a)} – ${capitalize(b)}`
}

/** "18:30" de un ISO UTC, en hora local. */
export function localTimeLabel(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
