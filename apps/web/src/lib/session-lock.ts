export type LockReason = "FUTURE" | "PREVIOUS_STEP_PENDING" | "ANOTHER_ACTIVE"

/** Fecha local del navegador (YYYY-MM-DD), para que "hoy" coincida con lo que ve la persona. */
export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Motivo (en español) por el que no se puede empezar una sesión. */
export function lockMessage(reason: string | null | undefined, scheduledDate?: string | null): string | null {
  switch (reason) {
    case "FUTURE": {
      const d = scheduledDate ? new Date(scheduledDate + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }) : null
      return d ? `Podrás empezarlo el ${d}` : "Aún no es el día de este entrenamiento"
    }
    case "PREVIOUS_STEP_PENDING": return "Primero termina el bloque anterior"
    case "ANOTHER_ACTIVE": return "Termina o abandona el entrenamiento en curso"
    default: return null
  }
}
