// Copia de apps/web/src/lib/workout-text.ts. Al portar el ejecutor, mover a un
// paquete compartido (packages/*) para que web y móvil no diverjan.
//
// Textos en lenguaje llano para el atleta (sin jerga: nada de "90s", "RPE" o "3-1-2-0" sin explicar).

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  const mins = m === 1 ? "1 minuto" : `${m} minutos`
  const secs = s === 1 ? "1 segundo" : `${s} segundos`
  if (m === 0) return secs
  if (s === 0) return mins
  return `${mins} ${secs}`
}

export type TargetLike = {
  setType?: string | null
  targetReps: number | null
  targetDurationSeconds?: number | null
}

export function isTimeTarget(t: TargetLike) {
  return t.setType === "time"
}

/** Sufijo de los ejercicios "Por cada lado" (unilaterales). */
export const PER_SIDE_SUFFIX = "por lado"

/** "10 repeticiones", "30 segundos" o "Las que puedas"; con `perSide`, "10 repeticiones por lado". */
export function describeTarget(t: TargetLike, perSide = false): string {
  const base = isTimeTarget(t)
    ? (t.targetDurationSeconds ? formatDuration(t.targetDurationSeconds) : "El tiempo que puedas")
    : t.targetReps == null
      ? "Las repeticiones que puedas"
      : t.targetReps === 1 ? "1 repetición" : `${t.targetReps} repeticiones`
  return perSide ? `${base} ${PER_SIDE_SUFFIX}` : base
}

/** Resumen del ejercicio: "3 series de 10 repeticiones" (o "... por lado" con `perSide`). */
export function summarizeTargets(targets: TargetLike[], perSide = false): string {
  const n = targets.length
  if (n === 0) return "Sin series"
  const series = n === 1 ? "1 serie" : `${n} series`
  const first = describeTarget(targets[0], perSide).toLowerCase()
  const allSame = targets.every((t) => describeTarget(t) === describeTarget(targets[0]))
  if (allSame) return `${series} de ${first}`
  return perSide ? `${series} ${PER_SIDE_SUFFIX}` : series
}

/** Pausa entre el lado 1 y el lado 2 en series por tiempo "Por cada lado". */
export const SIDE_SWITCH_SECONDS = 5

/** Tempo "3-1-2-0" → instrucciones legibles */
export function explainTempo(tempo: string): string | null {
  const parts = tempo.split(/[-–/ ]+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 4) return null
  const [down, pauseDown, up, pauseUp] = parts
  const sec = (v: string) => (v === "X" || v === "x" ? "rápido" : `${v} s`)
  return `Baja en ${sec(down)}, pausa ${sec(pauseDown)}, sube en ${sec(up)}, pausa ${sec(pauseUp)}`
}
