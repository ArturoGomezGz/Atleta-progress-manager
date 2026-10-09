// Vistas compactas de la rutina para el modelo (ids estables, nombres en vez de exerciseId). Puro.

import type { RoutineContent } from "@atleta/db/schema"

type ExerciseLike = { id: string; exerciseId: string; goal?: string; tempo?: string; restSeconds?: number; notes?: string; perSide?: boolean; sets: unknown[] }

function exerciseView(ex: ExerciseLike, names: Record<string, string>) {
  return {
    id: ex.id,
    exercise: names[ex.exerciseId] ?? "(ejercicio sin nombre)",
    goal: ex.goal,
    tempo: ex.tempo,
    restSeconds: ex.restSeconds,
    notes: ex.notes,
    perSide: ex.perSide || undefined,
    sets: ex.sets.map((s) => {
      const { setNumber: _n, ...rest } = s as Record<string, unknown>
      return rest
    }),
  }
}

/** Vista completa: ejercicios con series, descansos y notas. */
export function describeRoutineForModel(content: RoutineContent, names: Record<string, string>) {
  return [...content.items].sort((a, b) => a.order - b.order).map((item, position) =>
    item.type === "exercise"
      ? { position, type: "exercise", ...exerciseView(item as ExerciseLike, names) }
      : {
          position, type: "block", id: item.id, name: item.name, rounds: item.rounds,
          restBetweenRoundsSeconds: item.restBetweenRoundsSeconds,
          exercises: [...item.exercises].sort((a, b) => a.order - b.order).map((e, i) => ({ position: i, ...exerciseView(e as ExerciseLike, names) })),
        },
  )
}

/** Solo los ítems indicados (y los hijos de los bloques indicados), con detalle completo. */
export function describeItemsForModel(content: RoutineContent, ids: readonly string[], names: Record<string, string>): unknown[] {
  const wanted = new Set(ids)
  const out: unknown[] = []
  for (const it of describeRoutineForModel(content, names)) {
    if (wanted.has(it.id)) out.push(it)
    else if ("exercises" in it && Array.isArray(it.exercises)) {
      const inside = it.exercises.filter((e: { id: string }) => wanted.has(e.id))
      if (inside.length) out.push({ ...it, exercises: inside })
    }
  }
  return out
}

export type OutlineEntry = { id: string; name: string; block?: string }

/** Índice mínimo para el enrutador: id y nombre de cada ejercicio (y bloque). Sin series. */
export function outlineOf(content: RoutineContent, names: Record<string, string>): OutlineEntry[] {
  const nameOf = (exerciseId: string) => names[exerciseId] ?? "(ejercicio sin nombre)"
  return [...content.items].sort((a, b) => a.order - b.order).flatMap((it): OutlineEntry[] =>
    it.type === "exercise"
      ? [{ id: it.id, name: nameOf(it.exerciseId) }]
      : [
          { id: it.id, name: `Bloque ${it.name ?? "sin nombre"}` },
          ...[...it.exercises].sort((a, b) => a.order - b.order).map((e) => ({ id: e.id, name: nameOf(e.exerciseId), block: it.id })),
        ],
  )
}

export function exerciseIdsOf(content: RoutineContent): string[] {
  return [...new Set(content.items.flatMap((it) => (it.type === "exercise" ? [it.exerciseId] : it.exercises.map((e) => e.exerciseId))))]
}
