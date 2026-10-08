// Capa pura de ediciones sobre un RoutineContent (sin base de datos ni red).
// La usan las habilidades del AI Routine Editor (services/ai-routine-editor/): el modelo propone operaciones,
// aquí se aplican sobre una copia, se valida el resultado con el zod de la rutina y se
// devuelve el contenido nuevo más una lista de cambios legibles para mostrar un diff.
// Ver docs/ia-generacion-rutinas.md (sección "Refinamiento").

import type { RoutineContent, RoutineExerciseContent, RoutineItemBlock, RoutineSet } from "@atleta/db/schema"
import { z } from "zod"
import { routineContentSchema } from "./routine-content-schema"

export const EXERCISE_GOALS = ["strength", "hypertrophy", "endurance", "power", "cardio", "recovery"] as const

export const MAX_SETS_PER_EXERCISE = 12
export const MAX_ITEMS = 20
export const MAX_BLOCK_EXERCISES = 10
export const MAX_BLOCK_ROUNDS = 20

// ─── Operaciones ──────────────────────────────────────────────────────────────

const setInputSchema = z.object({
  setType:               z.enum(["reps", "time"]),
  targetReps:            z.number().int().positive().max(200).nullish(),
  targetDurationSeconds: z.number().int().positive().max(3600).nullish(),
  loadType:              z.enum(["rpe", "percent_rm", "fixed_kg"]).nullish(),
  loadValue:             z.number().positive().max(1000).nullish(),
})
export type SetInput = z.infer<typeof setInputSchema>

const setsInputSchema = z.array(setInputSchema).min(1).max(MAX_SETS_PER_EXERCISE)

const tempoSchema = z.string().regex(/^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i)
const idSchema = z.string().uuid()

export const editOpSchema = z.discriminatedUnion("op", [
  z.object({
    op:          z.literal("replace_exercise"),
    itemId:      idSchema,
    newExerciseId: idSchema,
    /** true (default): conserva series, descanso, tempo y objetivo. false: `sets` es obligatorio. */
    keepSets:    z.boolean().optional(),
    sets:        setsInputSchema.optional(),
    notes:       z.string().max(300).nullish(),
  }),
  z.object({
    op:          z.literal("add_exercise"),
    exerciseId:  idSchema,
    /** Bloque destino; omitir para agregarlo al nivel superior. */
    blockId:     idSchema.nullish(),
    /** Posición (0 = primero). Omitir para agregar al final. */
    position:    z.number().int().min(0).nullish(),
    goal:        z.enum(EXERCISE_GOALS).nullish(),
    restSeconds: z.number().int().positive().max(600).nullish(),
    tempo:       tempoSchema.nullish(),
    notes:       z.string().max(300).nullish(),
    /** true: reps/tiempo de cada serie son por cada lado (unilateral). */
    perSide:     z.boolean().nullish(),
    sets:        setsInputSchema,
  }),
  z.object({
    op:     z.literal("remove_item"),
    itemId: idSchema,
  }),
  z.object({
    op:       z.literal("move_item"),
    itemId:   idSchema,
    /** Nuevo padre: id de un bloque, o null/omitido para el nivel superior. Los bloques solo pueden ir al nivel superior. */
    toBlockId: idSchema.nullish(),
    /** Nueva posición dentro del padre (0 = primero). */
    toPosition: z.number().int().min(0),
  }),
  z.object({
    op:     z.literal("update_sets"),
    itemId: idSchema,
    /** Reemplaza TODAS las series del ejercicio. */
    sets:   setsInputSchema,
  }),
  z.object({
    op:          z.literal("update_item_fields"),
    itemId:      idSchema,
    // null borra el campo; undefined lo deja igual
    tempo:       tempoSchema.nullish(),
    restSeconds: z.number().int().positive().max(600).nullish(),
    goal:        z.enum(EXERCISE_GOALS).nullish(),
    notes:       z.string().max(300).nullish(),
    /** true marca "por cada lado"; false o null lo quita. */
    perSide:     z.boolean().nullish(),
  }),
  z.object({
    op:     z.literal("update_block"),
    itemId: idSchema,
    rounds: z.number().int().min(2).max(MAX_BLOCK_ROUNDS).optional(),
    name:   z.string().max(60).nullish(),
    restBetweenRoundsSeconds: z.number().int().positive().max(600).nullish(),
  }),
])

export type EditOp = z.infer<typeof editOpSchema>
export type EditOpType = EditOp["op"]

// ─── Cambios (registro legible y comparable por la UI) ───────────────────────

export type RoutineChange = {
  type: EditOpType
  /** Id del ejercicio o bloque afectado (estable entre antes y después). */
  itemId: string
  itemKind: "exercise" | "block"
  /** Bloque que contiene el ítem, o null si está en el nivel superior. */
  blockId: string | null
  /** Frase en español para mostrar al entrenador. */
  summary: string
  /** Estado relevante antes (null si el ítem no existía). Solo campos que cambian. */
  before: Record<string, unknown> | null
  /** Estado relevante después (null si el ítem se eliminó). */
  after: Record<string, unknown> | null
}

export type EditResult = { content: RoutineContent; changes: RoutineChange[] }

export type EditOptions = {
  /** exerciseId obtenidos de search_exercises/propose_new_exercise en este turno. Obligatorio para replace/add. */
  knownExerciseIds: ReadonlySet<string>
  /** id -> nombre, para redactar los resúmenes. Si falta, se usa un nombre genérico. */
  exerciseNames?: Readonly<Record<string, string>>
  /** Permite loadType "fixed_kg" (solo si el entrenador dio los pesos). Default false. */
  allowFixedKg?: boolean
  /** Permite loadType "percent_rm" (solo si hay RM registrados). Default false. */
  allowPercentRm?: boolean
  /** Generador de ids; inyectable para pruebas. */
  newId?: () => string
}

export class RoutineEditError extends Error {
  constructor(message: string, readonly opIndex?: number) {
    super(message)
    this.name = "RoutineEditError"
  }
}

// ─── Utilidades internas ──────────────────────────────────────────────────────

type Location =
  | { kind: "exercise"; parent: null; list: RoutineContent["items"]; index: number }
  | { kind: "block"; parent: null; list: RoutineContent["items"]; index: number }
  | { kind: "block-exercise"; parent: RoutineItemBlock; list: RoutineExerciseContent[]; index: number }

function clone(content: RoutineContent): RoutineContent {
  return structuredClone(content)
}

function locate(content: RoutineContent, itemId: string): Location | null {
  const list = content.items
  list.sort((a, b) => a.order - b.order) // en el sitio: otras referencias a la lista siguen válidas
  for (let i = 0; i < list.length; i++) {
    const it = list[i]!
    if (it.id === itemId) return { kind: it.type, parent: null, list, index: i } as Location
    if (it.type === "block") {
      it.exercises.sort((a, b) => a.order - b.order)
      const j = it.exercises.findIndex((e) => e.id === itemId)
      if (j >= 0) return { kind: "block-exercise", parent: it, list: it.exercises, index: j }
    }
  }
  return null
}

function mustLocate(content: RoutineContent, itemId: string): Location {
  const loc = locate(content, itemId)
  if (!loc) throw new RoutineEditError(`No existe un ejercicio o bloque con id ${itemId}. Usa solo los ids del estado actual de la rutina.`)
  return loc
}

function mustFindBlock(content: RoutineContent, blockId: string): RoutineItemBlock {
  const loc = locate(content, blockId)
  if (!loc || loc.kind !== "block") throw new RoutineEditError(`El id ${blockId} no es un bloque de la rutina.`)
  return loc.list[loc.index] as RoutineItemBlock
}

function renumber(content: RoutineContent) {
  content.items.forEach((it, i) => {
    it.order = i
    if (it.type === "block") it.exercises.forEach((e, j) => { e.order = j })
  })
}

function nameOf(opts: EditOptions, exerciseId: string): string {
  return opts.exerciseNames?.[exerciseId] ?? "ejercicio"
}

function exerciseAt(loc: Location): RoutineExerciseContent {
  if (loc.kind === "block") throw new RoutineEditError("Esa operación aplica a ejercicios, no a bloques.")
  return loc.list[loc.index] as RoutineExerciseContent
}

function requireKnown(exerciseId: string, opts: EditOptions) {
  if (!opts.knownExerciseIds.has(exerciseId)) {
    throw new RoutineEditError(`El exerciseId ${exerciseId} no salió de search_exercises ni propose_new_exercise en este turno. Busca de nuevo y usa solo ids devueltos.`)
  }
}

export function buildSets(sets: SetInput[], opts: Pick<EditOptions, "allowFixedKg" | "allowPercentRm">, previous?: RoutineSet[]): RoutineSet[] {
  return sets.map((s, i) => {
    if (s.loadType === "fixed_kg" && !opts.allowFixedKg) {
      // Se tolera si ya existía exactamente ese valor (el modelo solo repite lo que había)
      const existed = previous?.some((p) => p.loadType === "fixed_kg" && p.loadValue === s.loadValue)
      if (!existed) throw new RoutineEditError("No inventes pesos: fixed_kg solo si el entrenador indicó los kilos. Usa rpe.")
    }
    if (s.loadType === "percent_rm" && !opts.allowPercentRm) {
      const existed = previous?.some((p) => p.loadType === "percent_rm")
      if (!existed) throw new RoutineEditError("percent_rm requiere RM registrados. Usa rpe.")
    }
    if (s.loadType === "rpe" && s.loadValue != null && s.loadValue > 10) throw new RoutineEditError("RPE debe estar entre 1 y 10.")
    if (s.loadType === "percent_rm" && s.loadValue != null && s.loadValue > 100) throw new RoutineEditError("percent_rm debe estar entre 1 y 100.")

    const load = s.loadType && s.loadValue ? { loadType: s.loadType, loadValue: s.loadValue } : {}
    if (s.setType === "time") {
      return { setNumber: i + 1, setType: "time", ...(s.targetDurationSeconds ? { targetDurationSeconds: s.targetDurationSeconds } : {}), ...load } as RoutineSet
    }
    return { setNumber: i + 1, setType: "reps", ...(s.targetReps ? { targetReps: s.targetReps } : {}), ...load } as RoutineSet
  })
}

function describeSet(s: RoutineSet): string {
  const volume = s.setType === "time" ? `${s.targetDurationSeconds ?? "?"} s` : `${s.targetReps ?? "?"} reps`
  const load = s.loadType && s.loadValue != null
    ? ` @ ${s.loadType === "rpe" ? `RPE ${s.loadValue}` : s.loadType === "percent_rm" ? `${s.loadValue}% RM` : `${s.loadValue} kg`}`
    : ""
  return volume + load
}

function describeSets(sets: RoutineSet[]): string {
  if (sets.length === 0) return "sin series"
  const parts = sets.map(describeSet)
  return parts.every((p) => p === parts[0]) ? `${sets.length} × ${parts[0]}` : parts.join(" · ")
}

const FIELD_LABELS: Record<string, string> = {
  tempo: "tempo", restSeconds: "descanso", goal: "objetivo", notes: "notas", perSide: "por cada lado",
  rounds: "rondas", name: "nombre", restBetweenRoundsSeconds: "descanso entre rondas",
}

function fmt(v: unknown): string {
  return v == null ? "(vacío)" : typeof v === "string" ? `"${v}"` : typeof v === "boolean" ? (v ? "sí" : "no") : String(v)
}

// ─── Aplicación de una operación ─────────────────────────────────────────────

function applyOne(content: RoutineContent, op: EditOp, opts: EditOptions): RoutineChange {
  const newId = opts.newId ?? (() => crypto.randomUUID())

  switch (op.op) {
    case "replace_exercise": {
      const loc = mustLocate(content, op.itemId)
      const ex = exerciseAt(loc)
      requireKnown(op.newExerciseId, opts)
      if (op.newExerciseId === ex.exerciseId) throw new RoutineEditError("El ejercicio nuevo es el mismo que el actual.")
      const keep = op.keepSets ?? true
      if (!keep && !op.sets) throw new RoutineEditError("Con keepSets=false debes enviar sets.")
      const before = { exerciseId: ex.exerciseId, exerciseName: nameOf(opts, ex.exerciseId), sets: structuredClone(ex.sets) }
      ex.exerciseId = op.newExerciseId
      if (!keep || op.sets) ex.sets = buildSets(op.sets!, opts, ex.sets)
      if (op.notes !== undefined) {
        if (op.notes) ex.notes = op.notes
        else delete ex.notes
      } else {
        delete ex.notes // las notas describían el ejercicio anterior
      }
      const after = { exerciseId: ex.exerciseId, exerciseName: nameOf(opts, ex.exerciseId), sets: structuredClone(ex.sets) }
      return {
        type: op.op, itemId: ex.id, itemKind: "exercise", blockId: loc.parent?.id ?? null,
        summary: `Cambió ${before.exerciseName} por ${after.exerciseName}`,
        before, after,
      }
    }

    case "add_exercise": {
      requireKnown(op.exerciseId, opts)
      const parent = op.blockId ? mustFindBlock(content, op.blockId) : null
      const list: Array<{ id: string }> = parent ? parent.exercises : content.items
      const max = parent ? MAX_BLOCK_EXERCISES : MAX_ITEMS
      if (list.length >= max) throw new RoutineEditError(`No caben más ${parent ? "ejercicios en el bloque" : "ítems en la rutina"} (máximo ${max}).`)
      const position = Math.min(op.position ?? list.length, list.length)
      const ex: RoutineExerciseContent = {
        id: newId(),
        exerciseId: op.exerciseId,
        order: position,
        ...(op.tempo ? { tempo: op.tempo } : {}),
        ...(op.restSeconds ? { restSeconds: op.restSeconds } : {}),
        ...(op.goal ? { goal: op.goal } : {}),
        ...(op.notes ? { notes: op.notes } : {}),
        ...(op.perSide ? { perSide: true } : {}),
        sets: buildSets(op.sets, opts),
      }
      if (parent) parent.exercises.splice(position, 0, ex)
      else content.items.splice(position, 0, { type: "exercise", ...ex })
      return {
        type: op.op, itemId: ex.id, itemKind: "exercise", blockId: parent?.id ?? null,
        summary: `Agregó ${nameOf(opts, ex.exerciseId)} (${describeSets(ex.sets)})${parent ? ` al bloque ${parent.name ?? "sin nombre"}` : ""}`,
        before: null,
        after: { exerciseId: ex.exerciseId, exerciseName: nameOf(opts, ex.exerciseId), position, sets: structuredClone(ex.sets) },
      }
    }

    case "remove_item": {
      const loc = mustLocate(content, op.itemId)
      if (loc.kind === "block-exercise" && loc.list.length === 1) {
        throw new RoutineEditError("El bloque quedaría vacío: elimina el bloque completo con su id.")
      }
      const [removed] = loc.list.splice(loc.index, 1)
      const isBlock = loc.kind === "block"
      const snapshot = isBlock
        ? { name: (removed as RoutineItemBlock).name ?? null, rounds: (removed as RoutineItemBlock).rounds, exercises: (removed as RoutineItemBlock).exercises.map((e) => nameOf(opts, e.exerciseId)) }
        : { exerciseId: (removed as RoutineExerciseContent).exerciseId, exerciseName: nameOf(opts, (removed as RoutineExerciseContent).exerciseId), sets: structuredClone((removed as RoutineExerciseContent).sets) }
      return {
        type: op.op, itemId: op.itemId, itemKind: isBlock ? "block" : "exercise", blockId: loc.parent?.id ?? null,
        summary: isBlock
          ? `Eliminó el bloque ${snapshot.name ?? "sin nombre"}`
          : `Eliminó ${(snapshot as { exerciseName: string }).exerciseName}`,
        before: snapshot, after: null,
      }
    }

    case "move_item": {
      const loc = mustLocate(content, op.itemId)
      const toParent = op.toBlockId ? mustFindBlock(content, op.toBlockId) : null
      if (loc.kind === "block" && toParent) throw new RoutineEditError("Un bloque no puede ir dentro de otro bloque.")
      if (toParent && toParent.id === op.itemId) throw new RoutineEditError("Un bloque no puede moverse dentro de sí mismo.")
      if (loc.kind === "block-exercise" && loc.list.length === 1 && loc.parent !== toParent) {
        throw new RoutineEditError("El bloque quedaría vacío al mover su único ejercicio.")
      }
      const fromBlockId = loc.parent?.id ?? null
      const fromIndex = loc.index
      const [moved] = loc.list.splice(loc.index, 1)
      const dest: unknown[] = toParent ? toParent.exercises : content.items
      const toIndex = Math.min(op.toPosition, dest.length)
      if (dest.length >= (toParent ? MAX_BLOCK_EXERCISES : MAX_ITEMS) && loc.parent !== toParent) {
        loc.list.splice(loc.index, 0, moved as never)
        throw new RoutineEditError("El destino está lleno.")
      }
      // Un ejercicio suelto que entra a un bloque pierde `type`; uno que sale lo recupera
      if (loc.kind === "block-exercise" && !toParent) dest.splice(toIndex, 0, { type: "exercise", ...(moved as RoutineExerciseContent) })
      else if (loc.kind === "exercise" && toParent) {
        const { type: _t, ...plain } = moved as RoutineExerciseContent & { type: "exercise" }
        dest.splice(toIndex, 0, plain)
      } else dest.splice(toIndex, 0, moved)

      const label = loc.kind === "block"
        ? `bloque ${(moved as RoutineItemBlock).name ?? "sin nombre"}`
        : nameOf(opts, (moved as RoutineExerciseContent).exerciseId)
      if (fromBlockId === (toParent?.id ?? null) && fromIndex === toIndex) throw new RoutineEditError("El ítem ya está en esa posición.")
      return {
        type: op.op, itemId: op.itemId, itemKind: loc.kind === "block" ? "block" : "exercise", blockId: toParent?.id ?? null,
        summary: `Movió ${label} de la posición ${fromIndex + 1} a la ${toIndex + 1}${fromBlockId !== (toParent?.id ?? null) ? (toParent ? ` dentro del bloque ${toParent.name ?? "sin nombre"}` : " fuera del bloque") : ""}`,
        before: { blockId: fromBlockId, position: fromIndex },
        after: { blockId: toParent?.id ?? null, position: toIndex },
      }
    }

    case "update_sets": {
      const loc = mustLocate(content, op.itemId)
      const ex = exerciseAt(loc)
      const before = structuredClone(ex.sets)
      ex.sets = buildSets(op.sets, opts, ex.sets)
      return {
        type: op.op, itemId: ex.id, itemKind: "exercise", blockId: loc.parent?.id ?? null,
        summary: `${nameOf(opts, ex.exerciseId)}: series de ${describeSets(before)} a ${describeSets(ex.sets)}`,
        before: { sets: before }, after: { sets: structuredClone(ex.sets) },
      }
    }

    case "update_item_fields": {
      const loc = mustLocate(content, op.itemId)
      const ex = exerciseAt(loc)
      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      const parts: string[] = []
      for (const key of ["tempo", "restSeconds", "goal", "notes", "perSide"] as const) {
        const value = op[key]
        if (value === undefined) continue
        // perSide solo se guarda cuando es true: false equivale a ausente.
        const current = key === "perSide" ? (ex.perSide ? true : null) : (ex[key] ?? null)
        const next = key === "perSide" ? (value ? true : null) : (value ?? null)
        if (current === next) continue
        before[key] = current
        after[key] = next
        parts.push(`${FIELD_LABELS[key]} ${fmt(current)} → ${fmt(next)}`)
        if (next === null) delete ex[key]
        else (ex as Record<string, unknown>)[key] = next
      }
      if (parts.length === 0) throw new RoutineEditError("La operación no cambia nada.")
      return {
        type: op.op, itemId: ex.id, itemKind: "exercise", blockId: loc.parent?.id ?? null,
        summary: `${nameOf(opts, ex.exerciseId)}: ${parts.join("; ")}`,
        before, after,
      }
    }

    case "update_block": {
      const loc = mustLocate(content, op.itemId)
      if (loc.kind !== "block") throw new RoutineEditError("update_block solo aplica a bloques.")
      const block = loc.list[loc.index] as RoutineItemBlock
      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      const parts: string[] = []
      if (op.rounds !== undefined && op.rounds !== block.rounds) {
        before.rounds = block.rounds; after.rounds = op.rounds
        parts.push(`rondas ${block.rounds} → ${op.rounds}`)
        block.rounds = op.rounds
      }
      for (const key of ["name", "restBetweenRoundsSeconds"] as const) {
        const value = op[key]
        if (value === undefined) continue
        const current = block[key] ?? null
        const next = value ?? null
        if (current === next) continue
        before[key] = current; after[key] = next
        parts.push(`${FIELD_LABELS[key]} ${fmt(current)} → ${fmt(next)}`)
        if (next === null) delete block[key]
        else (block as Record<string, unknown>)[key] = next
      }
      if (parts.length === 0) throw new RoutineEditError("La operación no cambia nada.")
      return {
        type: op.op, itemId: block.id, itemKind: "block", blockId: null,
        summary: `Bloque ${block.name ?? "sin nombre"}: ${parts.join("; ")}`,
        before, after,
      }
    }
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Aplica las operaciones en orden sobre una copia y valida el resultado con el zod de la rutina.
 * Es atómica: si una operación falla, lanza RoutineEditError (con `opIndex`) y no devuelve nada.
 * No muta `content`.
 */
export function applyEdits(content: RoutineContent, ops: EditOp[], opts: EditOptions): EditResult {
  const draft = clone(content)
  const changes: RoutineChange[] = []

  ops.forEach((raw, index) => {
    const parsed = editOpSchema.safeParse(raw)
    if (!parsed.success) {
      throw new RoutineEditError(`Operación inválida: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, index)
    }
    try {
      changes.push(applyOne(draft, parsed.data, opts))
      renumber(draft)
    } catch (err) {
      if (err instanceof RoutineEditError) throw new RoutineEditError(err.message, index)
      throw err
    }
  })

  const validated = routineContentSchema.safeParse(draft)
  if (!validated.success) {
    throw new RoutineEditError(`La rutina resultante no es válida: ${validated.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`)
  }
  // zod descarta mode/circuitRounds (legado); lo conservamos si existían para no alterar lo que no se edita
  const result: RoutineContent = { ...validated.data, ...(content.mode ? { mode: content.mode } : {}), ...(content.circuitRounds ? { circuitRounds: content.circuitRounds } : {}) }
  return { content: result, changes }
}

export function applyEdit(content: RoutineContent, op: EditOp, opts: EditOptions): EditResult {
  return applyEdits(content, [op], opts)
}
