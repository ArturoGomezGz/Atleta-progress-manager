import type { RoutineContent, RoutineExerciseContent, RoutineSet } from "@atleta/db/schema"

export type FlatExercise = RoutineExerciseContent & {
  blockId: string | null
  blockName: string | null
  rounds: number
  roundNumber: number | null
}

/**
 * Aplana el contenido de una rutina en el orden en que el atleta lo ejecuta.
 * La posición en esta lista es el `order` de session_exercise (y el
 * `exercise_order` de un entrenamiento de invitado).
 *
 * Los circuitos se expanden ronda por ronda, alternando entre sus ejercicios
 * (A, B, A, B, …) en vez de agrupar todas las rondas de un mismo ejercicio
 * seguidas — así el atleta hace una vuelta completa del circuito antes de
 * repetirla, en vez de repetir un solo ejercicio varias veces.
 *
 * El `restSeconds` de cada entrada ya queda resuelto aquí: para la última
 * entrada de una ronda (salvo la última ronda) se usa el descanso "entre
 * rondas" del bloque si está definido; para el resto, el descanso propio
 * del ejercicio.
 */
export function flattenContent(content: RoutineContent | null | undefined): FlatExercise[] {
  return [...(content?.items ?? [])]
    .sort((a, b) => a.order - b.order)
    .flatMap<FlatExercise>((item) => {
      if (item.type === "exercise") {
        return [{ ...item, blockId: null, blockName: null, rounds: 1, roundNumber: null }]
      }

      const sortedExercises = [...item.exercises].sort((a, b) => a.order - b.order)
      const blockName = item.name ?? "Circuito"
      const out: FlatExercise[] = []

      for (let round = 1; round <= item.rounds; round++) {
        sortedExercises.forEach((ex, i) => {
          const isLastInRound = i === sortedExercises.length - 1
          const isLastRound = round === item.rounds
          const restSeconds =
            isLastInRound && !isLastRound && item.restBetweenRoundsSeconds != null
              ? item.restBetweenRoundsSeconds
              : ex.restSeconds

          out.push({ ...ex, blockId: item.id, blockName, rounds: item.rounds, roundNumber: round, restSeconds })
        })
      }

      return out
    })
}

/**
 * Objetivos de una serie tal como se guardan en `session_set_target`.
 * Cada entrada de un circuito ya representa una sola ronda (ver `flattenContent`).
 */
export function targetsForExercise(sets: RoutineSet[]) {
  return sets.map((s, i) => ({
    setNumber: i + 1,
    setType: s.setType,
    targetReps: s.setType === "time" ? null : s.targetReps ?? null,
    targetDurationSeconds: s.setType === "time" ? s.targetDurationSeconds ?? null : null,
    targetPercent: s.loadType === "percent_rm" && s.loadValue != null ? String(s.loadValue) : null,
  }))
}
