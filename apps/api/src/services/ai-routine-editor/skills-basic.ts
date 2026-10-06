// Habilidades atómicas: catálogo y edición básica. Envuelven las operaciones puras de
// ai-routine-edits.ts; el resultado es compacto (resumen del cambio, nunca la rutina completa).

import { z } from "zod"
import { EXERCISE_GOALS, MAX_BLOCK_ROUNDS, RoutineEditError, MAX_SETS_PER_EXERCISE, editOpSchema, type EditOp, type EditOpType } from "../ai-routine-edits"
import { MAX_ALTERNATIVES, rankAlternatives, type AlternativeCandidate, type AlternativeInfo } from "./alternatives"
import { matchesAvoid } from "./avoid"
import { bodyZones, levels, patterns } from "./catalog-constants"
import { defineSkill, type AnySkill, type JsonSchema, type SkillDef, type SkillRuntime } from "./types"

const FLAG = "ai_routine_tweaks"
const REVIEWED = "2026-10-06"

// ─── JSON Schema compartido ──────────────────────────────────────────────────

const uuidProp = (description: string) => ({ type: "string", description })

const setJson = {
  type: "object",
  properties: {
    setType:               { type: "string", enum: ["reps", "time"] },
    targetReps:            { type: "integer", description: "Solo si setType=reps" },
    targetDurationSeconds: { type: "integer", description: "Solo si setType=time" },
    loadType:              { type: "string", enum: ["rpe", "percent_rm", "fixed_kg"], description: "Omitir para peso corporal" },
    loadValue:             { type: "number" },
  },
  required: ["setType"],
}
const setsJson = { type: "array", items: setJson, minItems: 1, maxItems: MAX_SETS_PER_EXERCISE }

const params = (properties: Record<string, unknown>, required: string[] = []): JsonSchema => ({ type: "object", properties, required })

// ─── Catálogo ────────────────────────────────────────────────────────────────

const searchInput = z.object({
  query:           z.string().max(80).nullish(),
  movementPattern: z.enum(patterns).nullish(),
  bodyZone:        z.enum(bodyZones).nullish(),
  difficulty:      z.enum(levels).nullish(),
  warmupOnly:      z.boolean().nullish(),
})

export const searchExercisesSkill = defineSkill({
  id: "search_exercises",
  name: "Buscar ejercicios",
  description: "Busca ejercicios en el catálogo disponible para el equipo (la mayoría de los nombres están en inglés: prefiere filtrar por movementPattern o bodyZone, y si usas query que sea una o dos palabras en inglés). Devuelve hasta 12 resultados; excluye lo que el mensaje pidió evitar.",
  category: "catalog", execution: "deterministic", scope: "read", status: "limited", risk: "low", mcp: "yes", flag: FLAG, reviewedAt: REVIEWED,
  notes: "Aplica `avoid` (nombre o equipamiento, sin acentos ni mayúsculas) antes de registrar ids válidos.",
  inputSchema: searchInput,
  parameters: params({
    query:           { type: "string", description: "Texto parcial del nombre, ej. 'squat' o 'plank' (catálogo mayormente en inglés). Omitir para buscar solo por filtros" },
    movementPattern: { type: "string", enum: patterns },
    bodyZone:        { type: "string", enum: bodyZones },
    difficulty:      { type: "string", enum: levels },
    warmupOnly:      { type: "boolean", description: "true para ejercicios aptos para calentamiento" },
  }),
  async run(input, rt) {
    const found = await rt.catalog.search(input)
    const kept = found.filter((ex) => !matchesAvoid({ name: ex.name, equipment: ex.equipment }, rt.avoid))
    for (const ex of found) {
      if (kept.includes(ex)) rt.knownExerciseIds.add(ex.id)
      else rt.knownExerciseIds.delete(ex.id)
    }
    for (const ex of kept) rt.names[ex.id] = ex.name
    // Resultado compacto para el modelo: solo lo necesario para elegir
    return { result: kept.map((ex) => ({ id: ex.id, name: ex.name, patterns: ex.patterns, equipment: ex.equipment, contraindications: ex.contraindications })) }
  },
})

/** Ejercicio (o ejercicio dentro de un bloque) de la rutina con ese id de ítem. */
function findExerciseItem(content: ReturnType<SkillRuntime["getContent"]>, itemId: string) {
  for (const it of content.items) {
    if (it.type === "exercise" && it.id === itemId) return it
    if (it.type === "block") { const e = it.exercises.find((x) => x.id === itemId); if (e) return e }
  }
  return null
}

export type FindAlternativesMeta = { target: AlternativeInfo | null; candidates: AlternativeCandidate[] }

export const findAlternativesSkill = defineSkill({
  id: "find_alternatives",
  name: "Buscar alternativas",
  description: "Devuelve hasta 8 ejercicios equivalentes a uno de la rutina (mismo patrón de movimiento y músculo primario, dificultad no mayor, equipo permitido), ya ordenados del mejor al peor, sin reemplazar nada.",
  category: "catalog", execution: "deterministic", scope: "read", status: "limited", risk: "low", mcp: "yes", flag: FLAG, reviewedAt: REVIEWED,
  notes: "Consulta el catálogo por metadatos (patrón, músculo primario, dificultad, equipo), no por nombre: el catálogo está en inglés. Excluye lo ya presente en la rutina y lo evitado (`avoid`); registra los ids devueltos como válidos.",
  inputSchema: z.object({ itemId: z.string().uuid() }),
  parameters: params({ itemId: uuidProp("id del ejercicio de la rutina para el que se buscan alternativas") }, ["itemId"]),
  async run(input, rt) {
    const content = rt.getContent()
    const item = findExerciseItem(content, input.itemId)
    if (!item) return { result: { error: "No es un ejercicio de la rutina." }, meta: { target: null, candidates: [] } satisfies FindAlternativesMeta }
    const { target, pool } = await rt.catalog.alternatives(item.exerciseId)
    if (!target) return { result: { candidates: [] }, meta: { target: null, candidates: [] } satisfies FindAlternativesMeta }

    const inRoutine = content.items.flatMap((it) => (it.type === "exercise" ? [it] : it.exercises)).map((e) => e.exerciseId)
    const candidates = rankAlternatives(target, pool, {
      excludeIds: new Set(inRoutine),
      excludeNames: inRoutine.map((id) => rt.names[id]).filter((n): n is string => !!n),
      avoid: rt.avoid,
      limit: MAX_ALTERNATIVES,
    })
    for (const c of candidates) { rt.knownExerciseIds.add(c.id); rt.names[c.id] = c.name }
    return {
      result: { candidates: candidates.map((c) => ({ id: c.id, name: c.name, pattern: c.patterns, muscles: c.primaryMuscles, equipment: c.equipment, difficulty: c.difficulty })) },
      meta: { target, candidates } satisfies FindAlternativesMeta,
    }
  },
})

// ─── Edición básica ──────────────────────────────────────────────────────────

/** Esquema de entrada de una operación de edición: el de ai-routine-edits sin el discriminante `op`. */
function inputOf(op: EditOpType) {
  const option = editOpSchema.options.find((o) => o.shape.op.value === op) as z.ZodObject<z.ZodRawShape> | undefined
  if (!option) throw new Error(`Operación desconocida: ${op}`)
  return option.omit({ op: true })
}

function editSkill(op: EditOpType, def: Pick<SkillDef, "name" | "description" | "notes" | "parameters"> & { risk?: SkillDef["risk"] }): SkillDef<Record<string, unknown>> {
  return defineSkill<Record<string, unknown>>({
    id: op,
    name: def.name,
    description: def.description,
    category: "edit", execution: "deterministic", scope: "draft", status: "limited", risk: def.risk ?? "low", mcp: "yes", flag: FLAG, reviewedAt: REVIEWED,
    notes: def.notes,
    inputSchema: inputOf(op) as unknown as z.ZodType<Record<string, unknown>, z.ZodTypeDef, unknown>,
    parameters: def.parameters,
    run(input, rt) {
      const change = rt.apply({ ...input, op } as EditOp)
      return { result: { ok: true, changed: change.summary } }
    },
  })
}

export const replaceExerciseSkill = editSkill("replace_exercise", {
  name: "Reemplazar ejercicio",
  description: "Cambia el ejercicio de un ítem por otro (id obtenido con search_exercises). Conserva series, descanso, tempo y objetivo salvo que envíes sets.",
  notes: "El ítem conserva su id y sus notas (salvo que se envíen `notes`, y el guardián las descarta si el entrenador no las pidió). Exige un exerciseId devuelto por el catálogo en el mismo tweak.",
  parameters: params({
    itemId: uuidProp("id del ejercicio en el estado actual"),
    newExerciseId: uuidProp("id devuelto por search_exercises/find_alternatives"),
    keepSets: { type: "boolean", description: "Default true. Con false, sets es obligatorio" },
    sets: setsJson,
    notes: { type: ["string", "null"], description: "Solo si el entrenador pidió cambiar las notas; por defecto se conservan las del ejercicio anterior" },
  }, ["itemId", "newExerciseId"]),
})

const addExerciseBase = editSkill("add_exercise", {
  name: "Agregar ejercicio",
  description: "Agrega un ejercicio (id obtenido con search_exercises) al nivel superior o dentro de un bloque.",
  notes: "Máximo 20 ítems por rutina y 10 ejercicios por bloque.",
  parameters: params({
    exerciseId: uuidProp("id devuelto por search_exercises/find_alternatives"),
    blockId: { type: ["string", "null"], description: "Id del bloque destino; omitir para el nivel superior" },
    position: { type: "integer", description: "0 = primero; omitir para el final" },
    goal: { type: "string", enum: EXERCISE_GOALS },
    restSeconds: { type: "integer" },
    tempo: { type: "string", description: "Formato E-P-C-P, ej. 3-1-1-0" },
    notes: { type: "string" },
    sets: setsJson,
  }, ["exerciseId", "sets"]),
})

/** add_exercise no repite un ejercicio que ya está en la rutina (H-27), salvo que el entrenador lo pida. */
export const addExerciseSkill: SkillDef<Record<string, unknown>> = {
  ...addExerciseBase,
  run(input, rt) {
    const present = rt.getContent().items.flatMap((it) => (it.type === "exercise" ? [it] : it.exercises)).some((e) => e.exerciseId === input.exerciseId)
    if (present && !rt.allowRepeatExercises) {
      throw new RoutineEditError("Ese ejercicio ya está en la rutina. Elige otro que no esté: no se repiten ejercicios salvo que el entrenador lo pida.")
    }
    return addExerciseBase.run!(input, rt)
  },
}

export const removeItemSkill = editSkill("remove_item", {
  name: "Quitar ejercicio o bloque",
  description: "Elimina un ejercicio o un bloque completo. No se puede vaciar un bloque quitando su único ejercicio: elimina el bloque.",
  risk: "medium",
  parameters: params({ itemId: uuidProp("id del ejercicio o bloque") }, ["itemId"]),
})

export const moveItemSkill = editSkill("move_item", {
  name: "Mover ejercicio o bloque",
  description: "Mueve un ejercicio o bloque a otra posición (0 = primero), opcionalmente a otro bloque. Los bloques solo van en el nivel superior.",
  parameters: params({
    itemId: uuidProp("id del ejercicio o bloque"),
    toBlockId: { type: ["string", "null"], description: "Bloque destino; omitir/null para el nivel superior" },
    toPosition: { type: "integer" },
  }, ["itemId", "toPosition"]),
})

export const updateSetsSkill = editSkill("update_sets", {
  name: "Cambiar series",
  description: "Reemplaza TODAS las series de un ejercicio (repeticiones, tiempo, carga).",
  notes: "`fixed_kg` solo si el mensaje trae pesos; `percent_rm` solo con RM registrados (hoy siempre bloqueado: no hay `context`).",
  parameters: params({ itemId: uuidProp("id del ejercicio"), sets: setsJson }, ["itemId", "sets"]),
})

export const updateItemFieldsSkill = editSkill("update_item_fields", {
  name: "Cambiar campos del ejercicio",
  description: "Cambia tempo, descanso, objetivo o notas de un ejercicio. null borra el campo; omitirlo lo deja igual.",
  parameters: params({
    itemId: uuidProp("id del ejercicio"),
    tempo: { type: ["string", "null"] },
    restSeconds: { type: ["integer", "null"] },
    goal: { type: ["string", "null"], enum: [...EXERCISE_GOALS, null] },
    notes: { type: ["string", "null"] },
  }, ["itemId"]),
})

export const updateBlockSkill = editSkill("update_block", {
  name: "Cambiar bloque",
  description: "Cambia rondas, nombre o descanso entre rondas de un bloque. null borra el campo; omitirlo lo deja igual.",
  parameters: params({
    itemId: uuidProp("id del bloque"),
    rounds: { type: "integer", description: `2 a ${MAX_BLOCK_ROUNDS}` },
    name: { type: ["string", "null"] },
    restBetweenRoundsSeconds: { type: ["integer", "null"] },
  }, ["itemId"]),
})

export const BASIC_SKILLS: AnySkill[] = [
  searchExercisesSkill, findAlternativesSkill,
  replaceExerciseSkill, addExerciseSkill, removeItemSkill, moveItemSkill, updateSetsSkill, updateItemFieldsSkill, updateBlockSkill,
]
