// Entrada "amigable" de contenido de rutina para clientes externos (herramientas MCP:
// create_routine, update_routine, create_plan). Módulo puro, sin base de datos.
//
// Frente a RoutineContent (lo que se guarda) la entrada:
//   - no lleva `order` ni `setNumber` (salen de la posición en el arreglo);
//   - el `id` de ejercicios y bloques es opcional (se genera si falta o se repite;
//     conservarlo mantiene estable el vínculo con athleteSetCompletion.routineExerciseId);
//   - admite el atajo `sets: { count: 3, setType: "reps", targetReps: 10 }`;
//   - acepta en cada campo lo mismo que routineContentSchema (lo que guarda la web): enteros
//     positivos sin tope en reps/tiempo/distancia/descanso y textos libres en tempo, notas y nombre
//     del circuito, para que el contenido de una rutina hecha en la web (get_routine "detail")
//     vuelva a entrar tal cual por update_routine. Solo la carga tiene cota por tipo (RPE 1–10,
//     %RM 1–120, kg ≤ 1000) y el tamaño se acota con los límites de estructura y de JSON.
// normalizeRoutineContent la convierte a RoutineContent y la valida con routineContentSchema;
// toContentInput es la inversa (formato "detail" de get_routine). Ver docs/mcp.md.

import type { RoutineContent, RoutineExerciseContent, RoutineItemBlock, RoutineSet } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { EXERCISE_GOALS, MAX_BLOCK_EXERCISES, MAX_BLOCK_ROUNDS, MAX_ITEMS, MAX_SETS_PER_EXERCISE } from "./ai-routine-edits"
import { routineContentSchema } from "./routine-content-schema"

export { MAX_BLOCK_EXERCISES, MAX_BLOCK_ROUNDS, MAX_ITEMS, MAX_SETS_PER_EXERCISE }

/** Tamaño máximo del contenido serializado (JSON) que acepta la entrada. */
export const MAX_CONTENT_JSON_CHARS = 60_000
export const MIN_BLOCK_ROUNDS = 2

// Cota de loadValue según loadType
const LOAD_BOUNDS = {
  rpe:        { min: 1, max: 10, label: "RPE" },
  percent_rm: { min: 1, max: 120, label: "%RM" },
  fixed_kg:   { min: 0, max: 1000, label: "kg" },
} as const

// Tempo con el formato recomendado: se normaliza a mayúsculas ("3-1-x-0" → "3-1-X-0"). Cualquier
// otro texto (la web lo guarda libre, p. ej. "31X0" o "lento") se conserva tal cual.
const TEMPO_RE = /^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i

// ─── Schemas ──────────────────────────────────────────────────────────────────

const setFields = {
  setType:               z.enum(["reps", "time", "distance", "amrap"]),
  targetReps:            z.number().int().min(1).optional(),
  targetDurationSeconds: z.number().int().min(1).optional(),
  targetDistanceMeters:  z.number().int().min(1).optional(),
  loadType:              z.enum(["rpe", "percent_rm", "fixed_kg"]).optional(),
  loadValue:             z.number().positive().optional(),
}

type LoadFields = { loadType?: keyof typeof LOAD_BOUNDS; loadValue?: number }

function checkLoad(s: LoadFields, ctx: z.RefinementCtx) {
  if (s.loadValue === undefined) return
  if (!s.loadType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loadType"], message: "loadValue exige loadType (rpe, percent_rm o fixed_kg)" })
    return
  }
  const b = LOAD_BOUNDS[s.loadType]
  if (s.loadValue < b.min || s.loadValue > b.max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loadValue"], message: `${b.label} debe estar entre ${b.min} y ${b.max}` })
  }
}

export const routineSetInputSchema = z.object(setFields).strict().superRefine(checkLoad)

// Atajo: una serie con `count` se repite `count` veces
export const routineSetCountInputSchema = z
  .object({ ...setFields, count: z.number().int().min(1).max(MAX_SETS_PER_EXERCISE) })
  .strict()
  .superRefine(checkLoad)

export const routineSetsInputSchema = z.union([
  z.array(routineSetInputSchema).min(1).max(MAX_SETS_PER_EXERCISE),
  routineSetCountInputSchema,
])

const exerciseFields = {
  id:          z.string().uuid().optional(),
  exerciseId:  z.string().uuid(),
  sets:        routineSetsInputSchema,
  restSeconds: z.number().int().min(1).optional().describe("Segundos de descanso después del ejercicio (habitual 30–300)"),
  tempo:       z.string().optional().describe("Recomendado E-P-C-P, p. ej. 3-1-2-0 (X = explosivo)"),
  goal:        z.enum(EXERCISE_GOALS).optional(),
  notes:       z.string().optional().describe("Indicación breve para el atleta"),
  perSide:     z.boolean().optional(),
}

export const routineExerciseInputSchema = z.object(exerciseFields).strict()

export const routineItemInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exercise"), ...exerciseFields }).strict(),
  z
    .object({
      type:   z.literal("block"),
      id:     z.string().uuid().optional(),
      name:   z.string().optional(),
      rounds: z.number().int().min(MIN_BLOCK_ROUNDS).max(MAX_BLOCK_ROUNDS),
      restBetweenRoundsSeconds: z.number().int().min(1).optional(),
      exercises: z.array(routineExerciseInputSchema).min(1).max(MAX_BLOCK_EXERCISES),
    })
    .strict(),
])

export const routineContentInputSchema = z
  .object({ items: z.array(routineItemInputSchema).max(MAX_ITEMS) })
  .strict()
  .superRefine((value, ctx) => {
    if (JSON.stringify(value).length > MAX_CONTENT_JSON_CHARS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `El contenido supera ${MAX_CONTENT_JSON_CHARS} caracteres` })
    }
  })

export type RoutineSetInput = z.infer<typeof routineSetInputSchema>
export type RoutineSetsInput = z.infer<typeof routineSetsInputSchema>
export type RoutineExerciseInput = z.infer<typeof routineExerciseInputSchema>
export type RoutineItemInput = z.infer<typeof routineItemInputSchema>
export type RoutineContentInput = z.infer<typeof routineContentInputSchema>

// ─── Entrada → RoutineContent ─────────────────────────────────────────────────

function toSets(input: RoutineSetsInput): RoutineSet[] {
  const list = Array.isArray(input) ? input : Array.from({ length: input.count }, () => input)
  return list.map((s, i) => ({
    setNumber: i + 1,
    setType: s.setType,
    ...(s.targetReps !== undefined && { targetReps: s.targetReps }),
    ...(s.targetDurationSeconds !== undefined && { targetDurationSeconds: s.targetDurationSeconds }),
    ...(s.targetDistanceMeters !== undefined && { targetDistanceMeters: s.targetDistanceMeters }),
    ...(s.loadType !== undefined && { loadType: s.loadType }),
    ...(s.loadValue !== undefined && { loadValue: s.loadValue }),
  }))
}

/**
 * Convierte la entrada a RoutineContent: genera los ids que faltan o se repiten,
 * numera `order` y `setNumber`, expande `count` y valida el resultado. Lanza ZodError
 * si la entrada no cumple el schema y TRPCError BAD_REQUEST si excede los límites.
 */
export function normalizeRoutineContent(raw: RoutineContentInput, opts: { newId?: () => string } = {}): RoutineContent {
  const input = routineContentInputSchema.parse(raw)
  const newId = opts.newId ?? (() => crypto.randomUUID())
  const used = new Set<string>()
  const idFor = (id: string | undefined) => {
    let next = id && !used.has(id) ? id : newId()
    while (used.has(next)) next = newId()
    used.add(next)
    return next
  }

  const toExercise = (e: RoutineExerciseInput, order: number): RoutineExerciseContent => {
    const notes = e.notes?.trim()
    return {
      id: idFor(e.id),
      exerciseId: e.exerciseId,
      order,
      ...(e.tempo !== undefined && { tempo: TEMPO_RE.test(e.tempo) ? e.tempo.toUpperCase() : e.tempo }),
      ...(e.restSeconds !== undefined && { restSeconds: e.restSeconds }),
      ...(e.goal !== undefined && { goal: e.goal }),
      ...(notes && { notes }),
      ...(e.perSide && { perSide: true }),
      sets: toSets(e.sets),
    }
  }

  const content: RoutineContent = {
    v: 1,
    items: input.items.map((item, order) => {
      if (item.type === "exercise") {
        const { type: _type, ...rest } = item
        return { type: "exercise" as const, ...toExercise(rest, order) }
      }
      const name = item.name?.trim()
      const block: RoutineItemBlock = {
        type: "block",
        id: idFor(item.id),
        order,
        ...(name && { name }),
        rounds: item.rounds,
        ...(item.restBetweenRoundsSeconds !== undefined && { restBetweenRoundsSeconds: item.restBetweenRoundsSeconds }),
        exercises: item.exercises.map((e, i) => toExercise(e, i)),
      }
      return block
    }),
  }

  assertRoutineLimits(content)
  return routineContentSchema.parse(content)
}

/**
 * Límites de tamaño de una rutina (los mismos del AI Routine Editor). Sirve también
 * para contenido que no viene de la entrada amigable (p. ej. tras aplicar ediciones).
 */
export function assertRoutineLimits(content: RoutineContent): void {
  const fail = (message: string) => {
    throw new TRPCError({ code: "BAD_REQUEST", message })
  }
  if (content.items.length > MAX_ITEMS) fail(`Una rutina admite como máximo ${MAX_ITEMS} elementos`)
  const checkSets = (e: RoutineExerciseContent) => {
    if (e.sets.length > MAX_SETS_PER_EXERCISE) fail(`Un ejercicio admite como máximo ${MAX_SETS_PER_EXERCISE} series`)
  }
  for (const item of content.items) {
    if (item.type === "exercise") {
      checkSets(item)
      continue
    }
    if (item.exercises.length > MAX_BLOCK_EXERCISES) fail(`Un circuito admite como máximo ${MAX_BLOCK_EXERCISES} ejercicios`)
    if (item.rounds < MIN_BLOCK_ROUNDS || item.rounds > MAX_BLOCK_ROUNDS) {
      fail(`Un circuito debe tener entre ${MIN_BLOCK_ROUNDS} y ${MAX_BLOCK_ROUNDS} rondas`)
    }
    item.exercises.forEach(checkSets)
  }
  if (JSON.stringify(content).length > MAX_CONTENT_JSON_CHARS) fail(`El contenido supera ${MAX_CONTENT_JSON_CHARS} caracteres`)
}

// ─── RoutineContent → entrada (inversa) ───────────────────────────────────────

function fromSets(sets: RoutineSet[]): RoutineSetInput[] {
  return [...sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => ({
      setType: s.setType,
      ...(s.targetReps !== undefined && { targetReps: s.targetReps }),
      ...(s.targetDurationSeconds !== undefined && { targetDurationSeconds: s.targetDurationSeconds }),
      ...(s.targetDistanceMeters !== undefined && { targetDistanceMeters: s.targetDistanceMeters }),
      ...(s.loadType !== undefined && { loadType: s.loadType }),
      ...(s.loadValue !== undefined && { loadValue: s.loadValue }),
    }))
}

function fromExercise(e: RoutineExerciseContent): RoutineExerciseInput {
  return {
    id: e.id,
    exerciseId: e.exerciseId,
    sets: fromSets(e.sets),
    ...(e.restSeconds !== undefined && { restSeconds: e.restSeconds }),
    ...(e.tempo !== undefined && { tempo: e.tempo }),
    ...(e.goal !== undefined && { goal: e.goal }),
    ...(e.notes !== undefined && { notes: e.notes }),
    ...(e.perSide !== undefined && { perSide: e.perSide }),
  }
}

/**
 * Inversa de normalizeRoutineContent: conserva los ids y quita `order`/`setNumber`.
 * Se usa para devolver la rutina en un formato que update_routine acepta tal cual.
 * No valida: un contenido guardado que hoy excede algún límite se devuelve igual.
 */
export function toContentInput(content: RoutineContent): RoutineContentInput {
  return {
    items: [...content.items]
      .sort((a, b) => a.order - b.order)
      .map((item): RoutineItemInput => {
        if (item.type === "exercise") return { type: "exercise", ...fromExercise(item) }
        return {
          type: "block",
          id: item.id,
          ...(item.name !== undefined && { name: item.name }),
          rounds: item.rounds,
          ...(item.restBetweenRoundsSeconds !== undefined && { restBetweenRoundsSeconds: item.restBetweenRoundsSeconds }),
          exercises: [...item.exercises].sort((a, b) => a.order - b.order).map(fromExercise),
        }
      }),
  }
}
