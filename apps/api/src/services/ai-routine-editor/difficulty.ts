// Planificadores deterministas de dificultad y descanso (sin LLM, sin DB). Producen operaciones de
// edición que se aplican con la capa pura de ai-routine-edits.ts. Pasos pequeños y acotados:
// una sola palanca por pasada (volumen, intensidad o descanso), nunca dos a la vez.

import type { RoutineContent, RoutineExerciseContent, RoutineSet } from "@atleta/db/schema"
import type { EditOp, SetInput } from "../ai-routine-edits"

export type Direction = "up" | "down"
export type Knob = "volume" | "intensity" | "rest"

// Límites (ver docs/ia-generacion-rutinas.md §1.4 y §5)
export const RPE_STEP = 1
export const RPE_MAX_UP = 9
export const RPE_MAX_UP_WHEN_CROWDED = 8.5
export const RPE_MIN = 5
export const MAX_RPE_AT_OR_ABOVE_9 = 2
export const PERCENT_RM_STEP = 5
export const PERCENT_RM_MAX_UP = 95
export const PERCENT_RM_MIN = 40
export const SETS_MAX_UP = 6
export const SETS_MIN_DOWN = 2
export const ROUNDS_MAX_UP = 8
export const ROUNDS_MIN_DOWN = 2
export const REST_STEP = 15
export const REST_MIN = 15
export const REST_MAX = 600
/** Al hacer la rutina más fácil con la palanca de descanso no se sube de aquí. */
export const REST_MAX_WHEN_EASING = 180
/** Al hacerla más difícil con la palanca de descanso no se baja de aquí. */
export const REST_MIN_WHEN_HARDENING = 30

type Located = { ex: RoutineExerciseContent; blockId: string | null }

/** Ids permitidos: los pedidos más los ejercicios de los bloques pedidos. null = toda la rutina. */
export function expandTargets(content: RoutineContent, ids: readonly string[] | undefined): Set<string> | null {
  if (!ids || ids.length === 0) return null
  const out = new Set(ids)
  for (const it of content.items) if (it.type === "block" && out.has(it.id)) for (const e of it.exercises) out.add(e.id)
  return out
}

function exercisesOf(content: RoutineContent): Located[] {
  return [...content.items].sort((a, b) => a.order - b.order).flatMap((it): Located[] =>
    it.type === "exercise"
      ? [{ ex: it, blockId: null }]
      : [...it.exercises].sort((a, b) => a.order - b.order).map((ex) => ({ ex, blockId: it.id })),
  )
}

/** Series que la capa de edición sabe reescribir (reps o tiempo). Un ejercicio con otras no se toca. */
function editable(ex: RoutineExerciseContent): boolean {
  return ex.sets.every((s) => s.setType === "reps" || s.setType === "time")
}

function toInput(s: RoutineSet): SetInput {
  return {
    setType: s.setType as "reps" | "time",
    ...(s.targetReps ? { targetReps: s.targetReps } : {}),
    ...(s.targetDurationSeconds ? { targetDurationSeconds: s.targetDurationSeconds } : {}),
    ...(s.loadType && s.loadValue != null ? { loadType: s.loadType, loadValue: s.loadValue } : {}),
  }
}

function sameSets(a: SetInput[], b: SetInput[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ─── Intensidad ──────────────────────────────────────────────────────────────

function intensityOps(content: RoutineContent, dir: Direction, scope: Set<string> | null): EditOp[] {
  const all = exercisesOf(content)
  const atHighRpe = (ex: RoutineExerciseContent) => ex.sets.some((s) => s.loadType === "rpe" && (s.loadValue ?? 0) >= 9)
  let crowded = all.filter((l) => atHighRpe(l.ex)).length

  const ops: EditOp[] = []
  for (const { ex } of all) {
    if ((scope && !scope.has(ex.id)) || !editable(ex)) continue
    const before = ex.sets.map(toInput)
    const wasHigh = atHighRpe(ex)
    const roomAtTop = wasHigh || crowded < MAX_RPE_AT_OR_ABOVE_9
    const cap = roomAtTop ? RPE_MAX_UP : RPE_MAX_UP_WHEN_CROWDED

    const after = before.map((s): SetInput => {
      if (s.loadValue == null) return s // peso corporal o sin carga: no hay intensidad que mover
      if (s.loadType === "rpe") {
        // Subir nunca baja un valor que ya pasaba el tope; bajar nunca sube uno que ya estaba bajo el piso
        const next = dir === "up" ? Math.max(s.loadValue, Math.min(s.loadValue + RPE_STEP, cap)) : Math.min(s.loadValue, Math.max(RPE_MIN, s.loadValue - RPE_STEP))
        return { ...s, loadValue: next }
      }
      if (s.loadType === "percent_rm") {
        const next = dir === "up" ? Math.max(s.loadValue, Math.min(PERCENT_RM_MAX_UP, s.loadValue + PERCENT_RM_STEP)) : Math.min(s.loadValue, Math.max(PERCENT_RM_MIN, s.loadValue - PERCENT_RM_STEP))
        return { ...s, loadValue: next }
      }
      return s // fixed_kg: nunca se inventan pesos
    })

    if (sameSets(before, after)) continue
    if (!wasHigh && after.some((s) => s.loadType === "rpe" && (s.loadValue ?? 0) >= 9)) crowded++
    ops.push({ op: "update_sets", itemId: ex.id, sets: after })
  }
  return ops
}

// ─── Volumen ─────────────────────────────────────────────────────────────────

function volumeOps(content: RoutineContent, dir: Direction, scope: Set<string> | null): EditOp[] {
  const ops: EditOp[] = []
  for (const it of [...content.items].sort((a, b) => a.order - b.order)) {
    if (scope && !scope.has(it.id)) continue
    if (it.type === "block") {
      const rounds = dir === "up" ? Math.min(ROUNDS_MAX_UP, it.rounds + 1) : Math.max(ROUNDS_MIN_DOWN, it.rounds - 1)
      if ((dir === "up" && rounds > it.rounds) || (dir === "down" && rounds < it.rounds)) ops.push({ op: "update_block", itemId: it.id, rounds })
      continue
    }
    if (!editable(it)) continue
    const sets = it.sets.map(toInput)
    if (dir === "up" && sets.length < SETS_MAX_UP) ops.push({ op: "update_sets", itemId: it.id, sets: [...sets, sets[sets.length - 1]!] })
    if (dir === "down" && sets.length > SETS_MIN_DOWN) ops.push({ op: "update_sets", itemId: it.id, sets: sets.slice(0, -1) })
  }
  return ops
}

// ─── Descanso ────────────────────────────────────────────────────────────────

/** Mueve el descanso existente de cada ejercicio/bloque en `scope`; con `absolute` lo fija en ese valor. */
export function restOps(content: RoutineContent, opts: { more: boolean; scope: Set<string> | null; absolute?: number; min?: number; max?: number }): EditOp[] {
  const min = opts.min ?? REST_MIN
  const max = opts.max ?? REST_MAX
  // Nunca mueve un valor en sentido contrario al pedido: si el tope/piso ya quedó del lado "equivocado"
  // (p. ej. 15 s al endurecer con piso 30, o 590 s al facilitar con tope 180), el valor se deja igual.
  const step = (v: number) => (opts.more ? (v >= max ? v : Math.min(max, v + REST_STEP)) : v <= min ? v : Math.max(min, v - REST_STEP))
  const ops: EditOp[] = []
  for (const it of [...content.items].sort((a, b) => a.order - b.order)) {
    if (it.type === "exercise") {
      pushRest(ops, it, opts, step)
    } else {
      if (!opts.scope || opts.scope.has(it.id)) {
        const cur = it.restBetweenRoundsSeconds
        const next = opts.absolute ?? (cur != null ? step(cur) : null)
        if (next != null && next !== cur) ops.push({ op: "update_block", itemId: it.id, restBetweenRoundsSeconds: next })
      }
      for (const e of it.exercises) pushRest(ops, e, opts, step)
    }
  }
  return ops
}

function pushRest(ops: EditOp[], ex: RoutineExerciseContent, opts: { scope: Set<string> | null; absolute?: number }, step: (v: number) => number) {
  if (opts.scope && !opts.scope.has(ex.id)) return
  const cur = ex.restSeconds
  const next = opts.absolute ?? (cur != null ? step(cur) : null)
  if (next != null && next !== cur) ops.push({ op: "update_item_fields", itemId: ex.id, restSeconds: next })
}

// ─── Planificación ───────────────────────────────────────────────────────────

const AUTO_ORDER: Knob[] = ["intensity", "volume", "rest"]

function planKnob(content: RoutineContent, dir: Direction, knob: Knob, scope: Set<string> | null): EditOp[] {
  if (knob === "intensity") return intensityOps(content, dir, scope)
  if (knob === "volume") return volumeOps(content, dir, scope)
  // Más difícil = menos descanso; más fácil = más descanso
  return dir === "up"
    ? restOps(content, { more: false, scope, min: REST_MIN_WHEN_HARDENING })
    : restOps(content, { more: true, scope, max: REST_MAX_WHEN_EASING })
}

/** Elige la palanca (la pedida, o la primera que tenga margen) y devuelve las operaciones. */
export function planDifficulty(content: RoutineContent, opts: { direction: Direction; knob?: Knob | null; targetIds?: readonly string[] }): { knob: Knob | null; ops: EditOp[] } {
  const scope = expandTargets(content, opts.targetIds)
  const order = opts.knob ? [opts.knob] : AUTO_ORDER
  for (const knob of order) {
    const ops = planKnob(content, opts.direction, knob, scope)
    if (ops.length) return { knob, ops }
  }
  return { knob: opts.knob ?? null, ops: [] }
}

export const KNOB_LABEL: Record<Knob, string> = { intensity: "la intensidad", volume: "el volumen", rest: "los descansos" }
