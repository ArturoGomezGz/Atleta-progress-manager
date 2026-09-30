// Lógica del ejecutor, la misma que usa la web en
// apps/web/src/components/workout-runner.tsx (qué serie sigue, circuitos, peso por %RM).
import type { RouterOutputs } from "@/lib/trpc"

export type WorkoutProgress = RouterOutputs["sessions"]["myProgress"]
export type WorkoutExercise = WorkoutProgress["exercises"][number]
export type WorkoutTarget = WorkoutExercise["targets"][number]
export type WorkoutSet = WorkoutExercise["sets"][number]

// Descanso usado cuando el ejercicio no trae uno propio definido por el entrenador.
export const DEFAULT_REST_SECONDS = 90

export const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function calcWeight(targetPercent: string | null, rmLbs: string | null | undefined): string {
  if (!targetPercent || !rmLbs) return ""
  const raw = Number(rmLbs) * Number(targetPercent) / 100
  return (Math.ceil(raw * 2) / 2).toFixed(1)
}

export function findCurrentPosition(exercises: WorkoutExercise[]) {
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei]
    for (const target of ex.targets) {
      const done = ex.sets.some((s) => s.sessionSetTargetId === target.id)
      if (!done) return { exercise: ex, target, exerciseIdx: ei }
    }
  }
  return null
}

export const totalSets = (exercises: WorkoutExercise[]) => exercises.reduce((s, ex) => s + ex.targets.length, 0)
export const doneSets = (exercises: WorkoutExercise[]) =>
  exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.sessionSetTargetId !== null).length, 0)
export const doneFor = (ex: WorkoutExercise) => ex.sets.filter((r) => r.sessionSetTargetId !== null).length

export type PreviewItem =
  | { kind: "exercise"; exercise: WorkoutExercise }
  | { kind: "circuit"; blockId: string; blockName: string; rounds: number; exercises: WorkoutExercise[]; allExercises: WorkoutExercise[] }

/**
 * Agrupa las rondas de un mismo circuito en una sola entrada: la sesión trae cada
 * circuito expandido ronda por ronda (A, B, A, B, …). Para mostrarlo nos quedamos
 * con los ejercicios de la primera ronda y guardamos todas en `allExercises` para
 * calcular el progreso.
 */
export function groupForPreview(exercises: WorkoutExercise[]): PreviewItem[] {
  const items: PreviewItem[] = []
  for (const ex of exercises) {
    const prev = items[items.length - 1]
    if (ex.blockId && prev?.kind === "circuit" && prev.blockId === ex.blockId) {
      prev.allExercises.push(ex)
      if (ex.roundNumber === 1) prev.exercises.push(ex)
      continue
    }
    if (ex.blockId) {
      items.push({
        kind: "circuit",
        blockId: ex.blockId,
        blockName: ex.blockName ?? "Circuito",
        rounds: ex.rounds,
        exercises: ex.roundNumber === 1 ? [ex] : [],
        allExercises: [ex],
      })
      continue
    }
    items.push({ kind: "exercise", exercise: ex })
  }
  return items
}

/** "3:05" o "45" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : String(s)
}
