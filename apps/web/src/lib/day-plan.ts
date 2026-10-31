// Plan del día al asignar: qué ranuras se ofrecen y cuál se sugiere según el tipo de la rutina nueva.

import type { RoutineKind } from "./routine-kinds"

export type DayPlanItem = {
  sessionId: string
  routineName: string
  kind: RoutineKind | null
  athleteNames: string[]
  status: "pending" | "active" | "completed"
}

/**
 * Primera ranura disponible (0..n). No se ofrecen ranuras antes de algo ya completado o en curso:
 * la ranura i queda justo antes del elemento i, así que se puede desde el último elemento hecho + 1.
 */
export function firstOpenSlot(plan: DayPlanItem[]): number {
  let last = -1
  plan.forEach((p, i) => { if (p.status !== "pending") last = i })
  return last + 1
}

/**
 * Ranura sugerida: calentamiento al inicio, recuperación al final y principal después del último
 * calentamiento y antes de la primera recuperación (si hay principales, después de ellos). Siempre dentro de
 * las ranuras disponibles.
 */
export function suggestSlot(kind: RoutineKind, plan: DayPlanItem[]): number {
  const open = firstOpenSlot(plan)
  let slot: number
  if (kind === "warmup") slot = 0
  else if (kind === "recovery") slot = plan.length
  else {
    const afterWarmup = plan.reduce((acc, p, i) => (p.kind === "warmup" ? i + 1 : acc), 0)
    const firstRecovery = plan.findIndex((p) => p.kind === "recovery")
    const beforeRecovery = firstRecovery === -1 ? plan.length : firstRecovery
    slot = Math.max(afterWarmup, beforeRecovery)
  }
  return Math.min(Math.max(slot, open), plan.length)
}

/** Texto de una ranura de la lista. */
export function slotLabel(plan: DayPlanItem[], slot: number): string {
  if (slot === 0) return "Al inicio del día"
  if (slot === plan.length) return "Al final del día"
  return `Después de ${plan[slot - 1]!.routineName}`
}
