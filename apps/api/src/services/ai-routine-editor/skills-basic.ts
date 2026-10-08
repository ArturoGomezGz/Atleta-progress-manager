// Habilidades atómicas: catálogo y edición básica. Envuelven las operaciones puras de
// ai-routine-edits.ts; el resultado es compacto (resumen del cambio, nunca la rutina completa).

import { z } from "zod"
import { EXERCISE_GOALS, MAX_BLOCK_ROUNDS, MAX_SETS_PER_EXERCISE, editOpSchema, type EditOp, type EditOpType } from "../ai-routine-edits"
import { matchesAvoid } from "./avoid"
import { bodyZones, levels, MAX_NEW_EXERCISES, patterns } from "./catalog-constants"
import { defineSkill, type AnySkill, type JsonSchema, type SkillDef } from "./types"

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
  description: "Busca ejercicios en el catálogo disponible para el equipo (nombres en español). Devuelve hasta 12 resultados; excluye lo que el mensaje pidió evitar.",
  category: "catalog", execution: "deterministic", scope: "read", status: "limited", risk: "low", mcp: "yes", flag: FLAG, reviewedAt: REVIEWED,
  notes: "Aplica `avoid` (nombre o equipamiento, sin acentos ni mayúsculas) antes de registrar ids válidos.",
  inputSchema: searchInput,
  parameters: params({
    query:           { type: "string", description: "Texto parcial del nombre en español, ej. 'sentadilla'. Omitir para buscar solo por filtros" },
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

const proposeInput = z.object({
  name:              z.string().min(2).max(80),
  description:       z.string().max(400),
  difficulty:        z.enum(levels),
  movementPatterns:  z.array(z.enum(patterns)).max(4),
  contraindications: z.string().max(300).nullish(),
})

export const proposeNewExerciseSkill = defineSkill({
  id: "propose_new_exercise",
  name: "Proponer ejercicio nuevo",
  description: `Crea un ejercicio nuevo en el catálogo del equipo cuando ninguna búsqueda devuelve un equivalente razonable. Máximo ${MAX_NEW_EXERCISES} por tweak.`,
  category: "catalog", execution: "deterministic", scope: "persist", status: "limited", risk: "medium", mcp: "pending", flag: FLAG, reviewedAt: REVIEWED,
  notes: "Única escritura del flujo: el ejercicio queda en el catálogo privado del equipo aunque se rechace la propuesta.",
  inputSchema: proposeInput,
  parameters: params({
    name:              { type: "string", description: "Nombre en español" },
    description:       { type: "string", description: "Ejecución en 1-2 frases" },
    difficulty:        { type: "string", enum: levels },
    movementPatterns:  { type: "array", items: { type: "string", enum: patterns } },
    contraindications: { type: "string" },
  }, ["name", "description", "difficulty", "movementPatterns"]),
  async run(input, rt) {
    const created = await rt.catalog.propose(input)
    if (created.id && created.name) {
      rt.names[created.id] = created.name
      if (!matchesAvoid({ name: created.name }, rt.avoid)) rt.knownExerciseIds.add(created.id)
    }
    return { result: created }
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
  notes: "El ítem conserva su id; descarta las notas del ejercicio anterior. Exige un exerciseId devuelto por el catálogo en el mismo tweak.",
  parameters: params({
    itemId: uuidProp("id del ejercicio en el estado actual"),
    newExerciseId: uuidProp("id devuelto por search_exercises/propose_new_exercise"),
    keepSets: { type: "boolean", description: "Default true. Con false, sets es obligatorio" },
    sets: setsJson,
    notes: { type: ["string", "null"], description: "Notas nuevas; por defecto se borran las del ejercicio anterior" },
  }, ["itemId", "newExerciseId"]),
})

export const addExerciseSkill = editSkill("add_exercise", {
  name: "Agregar ejercicio",
  description: "Agrega un ejercicio (id obtenido con search_exercises) al nivel superior o dentro de un bloque.",
  notes: "Máximo 20 ítems por rutina y 10 ejercicios por bloque.",
  parameters: params({
    exerciseId: uuidProp("id devuelto por search_exercises/propose_new_exercise"),
    blockId: { type: ["string", "null"], description: "Id del bloque destino; omitir para el nivel superior" },
    position: { type: "integer", description: "0 = primero; omitir para el final" },
    goal: { type: "string", enum: EXERCISE_GOALS },
    restSeconds: { type: "integer" },
    tempo: { type: "string", description: "Formato E-P-C-P, ej. 3-1-1-0" },
    notes: { type: "string" },
    perSide: { type: "boolean", description: "true en unilaterales: reps/tiempo son por cada lado" },
    sets: setsJson,
  }, ["exerciseId", "sets"]),
})

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
  description: "Cambia tempo, descanso, objetivo, notas o \"por cada lado\" (perSide) de un ejercicio. null borra el campo; omitirlo lo deja igual.",
  parameters: params({
    itemId: uuidProp("id del ejercicio"),
    tempo: { type: ["string", "null"] },
    restSeconds: { type: ["integer", "null"] },
    goal: { type: ["string", "null"], enum: [...EXERCISE_GOALS, null] },
    notes: { type: ["string", "null"] },
    perSide: { type: ["boolean", "null"], description: "true: reps/tiempo por cada lado (unilateral); false/null lo quita" },
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
  searchExercisesSkill, proposeNewExerciseSkill,
  replaceExerciseSkill, addExerciseSkill, removeItemSkill, moveItemSkill, updateSetsSkill, updateItemFieldsSkill, updateBlockSkill,
]
