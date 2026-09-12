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

/** "10 repeticiones", "30 segundos" o "Las que puedas" */
export function describeTarget(t: TargetLike): string {
  if (isTimeTarget(t)) return t.targetDurationSeconds ? formatDuration(t.targetDurationSeconds) : "El tiempo que puedas"
  if (t.targetReps == null) return "Las repeticiones que puedas"
  return t.targetReps === 1 ? "1 repetición" : `${t.targetReps} repeticiones`
}

/** Resumen del ejercicio: "3 series de 10 repeticiones" */
export function summarizeTargets(targets: TargetLike[]): string {
  const n = targets.length
  if (n === 0) return "Sin series"
  const series = n === 1 ? "1 serie" : `${n} series`
  const first = describeTarget(targets[0]).toLowerCase()
  const allSame = targets.every((t) => describeTarget(t) === describeTarget(targets[0]))
  return allSame ? `${series} de ${first}` : series
}

/** Tempo "3-1-2-0" → instrucciones legibles */
export function explainTempo(tempo: string): string | null {
  const parts = tempo.split(/[-–/ ]+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 4) return null
  const [down, pauseDown, up, pauseUp] = parts
  const sec = (v: string) => (v === "X" || v === "x" ? "rápido" : `${v} s`)
  return `Baja en ${sec(down)}, pausa ${sec(pauseDown)}, sube en ${sec(up)}, pausa ${sec(pauseUp)}`
}
