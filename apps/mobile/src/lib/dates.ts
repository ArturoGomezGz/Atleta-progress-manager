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
