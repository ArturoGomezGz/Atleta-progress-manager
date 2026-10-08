// Comparación entre la rutina actual del editor y la propuesta de la IA (routines.tweakWithAI).
// Se compara por id (estable entre ambos contenidos) y `changes[]` del backend solo aporta texto:
// trae un registro por operación y puede incluir alta + baja del mismo ítem.
import type { RoutineContent, RoutineExerciseContent, RoutineItemBlock, RoutineSet } from "@atleta/db/schema"

export type AiChangeRecord = { itemId: string; summary: string }

/** Resumen corto de las series de un ejercicio: "4 × 6 reps", "3 × 45s", "3 series". */
export function setsSummary(sets: RoutineSet[]): string {
  const n = sets.length
  if (n === 0) return "Sin series"
  const first = sets[0]
  const effort = (s: RoutineSet) =>
    s.setType === "time" ? (s.targetDurationSeconds ? `${s.targetDurationSeconds}s` : "tiempo libre") : (s.targetReps ? `${s.targetReps}` : "libre")
  const allSame = sets.every((s) => effort(s) === effort(first) && s.setType === first.setType)
  if (!allSame) return `${n} serie${n !== 1 ? "s" : ""}`
  return first.setType === "time" ? `${n} × ${effort(first)}` : `${n} × ${effort(first)} reps`
}

// ─── Aplanado ────────────────────────────────────────────────────────────────

type Flat =
  | { kind: "exercise"; id: string; parentId: string | null; index: number; ex: RoutineExerciseContent }
  | { kind: "block"; id: string; parentId: null; index: number; block: RoutineItemBlock }

function flatten(content: RoutineContent): Map<string, Flat> {
  const out = new Map<string, Flat>()
  const items = [...content.items].sort((a, b) => a.order - b.order)
  items.forEach((it, index) => {
    if (it.type === "exercise") {
      const { type: _t, ...ex } = it
      out.set(it.id, { kind: "exercise", id: it.id, parentId: null, index, ex })
    } else {
      out.set(it.id, { kind: "block", id: it.id, parentId: null, index, block: it })
      ;[...it.exercises].sort((a, b) => a.order - b.order).forEach((ex, i) => {
        out.set(ex.id, { kind: "exercise", id: ex.id, parentId: it.id, index: i, ex })
      })
    }
  })
  return out
}

/** Ids de `ids` (ya en orden) que NO forman parte de la subsecuencia creciente más larga de `pos`. */
function outOfOrder(ids: string[], pos: Map<string, number>): Set<string> {
  const seq = ids.map((id) => pos.get(id) ?? 0)
  const n = seq.length
  const len = new Array<number>(n).fill(1)
  const prev = new Array<number>(n).fill(-1)
  let best = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) if (seq[j] < seq[i] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j }
    if (len[i] > len[best]) best = i
  }
  const keep = new Set<string>()
  for (let k = n ? best : -1; k >= 0; k = prev[k]) keep.add(ids[k])
  return new Set(ids.filter((id) => !keep.has(id)))
}

// ─── Duración estimada ───────────────────────────────────────────────────────

const REP_SECONDS = 40

function exerciseSeconds(ex: RoutineExerciseContent): number {
  const work = ex.sets.reduce((t, s) => t + (s.setType === "time" ? (s.targetDurationSeconds ?? 30) : REP_SECONDS), 0)
  return work + ex.sets.length * (ex.restSeconds ?? 0)
}

/** Estimación gruesa en minutos (≈40 s por serie de repeticiones + descansos); null si no hay nada que medir. */
export function estimateMinutes(content: RoutineContent): number | null {
  let seconds = 0
  for (const it of content.items) {
    if (it.type === "exercise") seconds += exerciseSeconds(it)
    else {
      const round = it.exercises.reduce((t, e) => t + exerciseSeconds(e), 0)
      seconds += round * it.rounds + (it.restBetweenRoundsSeconds ?? 0) * Math.max(0, it.rounds - 1)
    }
  }
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null
}

// ─── Diff ────────────────────────────────────────────────────────────────────

export type ItemPreview = {
  removed?: boolean
  moved?: boolean
  name?: { before: string; after: string }
  sets?: { before: string; after: string }
  rest?: { before: number | null; after: number | null }
  /** Circuitos */
  rounds?: { before: number; after: number }
  blockName?: { before: string; after: string }
}

export type DiffEntry = {
  id: string
  type: "added" | "removed" | "modified" | "moved"
  title: string
  /** Frases del backend para este ítem (puede estar vacía si el cambio no vino en `changes`). */
  summary: string
  before: string | null
  after: string | null
}

export type RoutineDiff = {
  entries: DiffEntry[]
  /** Ids con algún cambio visible en las tarjetas del editor (modificados, movidos o eliminados). */
  preview: Map<string, ItemPreview>
  /** Todos los ids que cambian, incluidos los nuevos. */
  changedIds: string[]
  minutesBefore: number | null
  minutesAfter: number | null
}

export function diffRoutine(
  before: RoutineContent,
  after: RoutineContent,
  nameOf: (exerciseId: string) => string,
  changes: AiChangeRecord[],
): RoutineDiff {
  const a = flatten(before)
  const b = flatten(after)
  const entries: DiffEntry[] = []
  const preview = new Map<string, ItemPreview>()
  const changedIds: string[] = []

  const summaries = new Map<string, string[]>()
  for (const c of changes) {
    const list = summaries.get(c.itemId) ?? []
    if (c.summary && !list.includes(c.summary)) list.push(c.summary)
    summaries.set(c.itemId, list)
  }
  const sumOf = (id: string) => (summaries.get(id) ?? []).join(" ")

  const describe = (f: Flat): string => {
    if (f.kind === "block") return `Circuito ${f.block.name || ""} · ${f.block.rounds} vueltas`.replace("  ", " ")
    const rest = f.ex.restSeconds ? ` · descanso ${f.ex.restSeconds}s` : ""
    return `${nameOf(f.ex.exerciseId)} · ${setsSummary(f.ex.sets)}${rest}`
  }
  const titleOf = (f: Flat) => (f.kind === "block" ? f.block.name || "Circuito" : nameOf(f.ex.exerciseId))

  // Movimientos: cambió de contenedor, o salió del orden relativo que conservan los demás.
  const movedIds = new Set<string>()
  const containers = new Set<string | null>([null, ...[...b.values()].map((f) => f.parentId)])
  for (const parent of containers) {
    const common = [...b.values()].filter((f) => f.parentId === parent && a.get(f.id)?.parentId === parent)
    const inNewOrder = common.sort((x, y) => x.index - y.index).map((f) => f.id)
    const oldPos = new Map(inNewOrder.map((id) => [id, a.get(id)!.index]))
    for (const id of outOfOrder(inNewOrder, oldPos)) movedIds.add(id)
  }
  for (const f of b.values()) {
    const old = a.get(f.id)
    if (old && old.parentId !== f.parentId) movedIds.add(f.id)
  }

  for (const [id, old] of a) {
    const now = b.get(id)
    if (!now) {
      entries.push({ id, type: "removed", title: titleOf(old), summary: sumOf(id), before: describe(old), after: null })
      preview.set(id, { removed: true })
      changedIds.push(id)
      continue
    }
    const p: ItemPreview = {}
    if (old.kind === "exercise" && now.kind === "exercise") {
      const n0 = nameOf(old.ex.exerciseId), n1 = nameOf(now.ex.exerciseId)
      if (old.ex.exerciseId !== now.ex.exerciseId) p.name = { before: n0, after: n1 }
      const s0 = setsSummary(old.ex.sets), s1 = setsSummary(now.ex.sets)
      if (JSON.stringify(old.ex.sets) !== JSON.stringify(now.ex.sets)) p.sets = { before: s0, after: s1 !== s0 ? s1 : `${s1} (con otras cargas)` }
      if ((old.ex.restSeconds ?? null) !== (now.ex.restSeconds ?? null)) p.rest = { before: old.ex.restSeconds ?? null, after: now.ex.restSeconds ?? null }
    } else if (old.kind === "block" && now.kind === "block") {
      if (old.block.rounds !== now.block.rounds) p.rounds = { before: old.block.rounds, after: now.block.rounds }
      if ((old.block.name ?? "") !== (now.block.name ?? "")) p.blockName = { before: old.block.name || "Circuito", after: now.block.name || "Circuito" }
      if ((old.block.restBetweenRoundsSeconds ?? null) !== (now.block.restBetweenRoundsSeconds ?? null)) p.rest = { before: old.block.restBetweenRoundsSeconds ?? null, after: now.block.restBetweenRoundsSeconds ?? null }
    }
    const fieldsChanged = old.kind === "exercise" && now.kind === "exercise"
      ? JSON.stringify({ ...old.ex, order: 0, sets: old.ex.sets }) !== JSON.stringify({ ...now.ex, order: 0, sets: now.ex.sets })
      : old.kind === "block" && now.kind === "block"
        ? JSON.stringify({ ...old.block, order: 0, exercises: 0 }) !== JSON.stringify({ ...now.block, order: 0, exercises: 0 })
        : false
    const moved = movedIds.has(id)
    if (moved) p.moved = true
    if (!fieldsChanged && !moved) continue
    changedIds.push(id)
    preview.set(id, p)
    if (fieldsChanged) {
      entries.push({ id, type: "modified", title: titleOf(now), summary: sumOf(id), before: describe(old), after: describe(now) })
    } else {
      const where = (f: Flat) => `Posición ${f.index + 1}${f.parentId ? ` en ${titleOf(a.get(f.parentId) ?? (b.get(f.parentId) as Flat))}` : ""}`
      entries.push({ id, type: "moved", title: titleOf(now), summary: sumOf(id), before: where(old), after: where(now) })
    }
  }
  for (const [id, now] of b) {
    if (a.has(id)) continue
    changedIds.push(id)
    entries.push({ id, type: "added", title: titleOf(now), summary: sumOf(id), before: null, after: describe(now) })
  }

  return { entries, preview, changedIds, minutesBefore: estimateMinutes(before), minutesAfter: estimateMinutes(after) }
}
