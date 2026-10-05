// Refinamiento de una rutina abierta con IA ("chat de ajustes"). NO guarda nada en la rutina:
// devuelve { message, proposedContent, changes } y el entrenador decide si aplicar.
// Reusa el bucle de tools del generador (search_exercises / propose_new_exercise) y añade tools de
// edición que operan sobre la capa pura de ai-routine-edits.ts. Ver docs/ia-generacion-rutinas.md.
//
// Este módulo es puro respecto a DB/OpenAI: el acceso real vive en ai-routine-refine-deps.ts y se
// inyecta como `deps`, así el bucle se prueba con un LLM simulado sin base de datos ni red.

import type { RoutineContent } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import type { FastifyBaseLogger } from "fastify"
import type OpenAI from "openai"
import { z } from "zod"
import type { Ctx } from "./ai-routines"
import {
  applyEdit,
  EXERCISE_GOALS,
  MAX_BLOCK_ROUNDS,
  MAX_SETS_PER_EXERCISE,
  RoutineEditError,
  editOpSchema,
  type EditOp,
  type RoutineChange,
} from "./ai-routine-edits"
import { AI_ROUTINE_REFINE_SYSTEM_PROMPT } from "./ai-routine-refine-prompt"
import { routineContentSchema } from "./routine-content-schema"

// ─── Límites ──────────────────────────────────────────────────────────────────

export const REFINE_MAX_MESSAGE_CHARS = 1000
/** Mensajes (usuario + asistente) del historial que se envían al modelo: ~3 intercambios. */
export const REFINE_MAX_HISTORY_MESSAGES = 6
const REFINE_MAX_HISTORY_INPUT = 12
const REFINE_HISTORY_MESSAGE_CHARS = 600
const REFINE_MAX_ITEMS = 30
const REFINE_MAX_CONTENT_JSON_CHARS = 60_000
const MAX_TURNS = 10
const MAX_REPLY_CHARS = 600

// ─── Input ────────────────────────────────────────────────────────────────────

export const refineRoutineInputSchema = z.object({
  teamId: z.string().uuid(),
  /** Estado actual de la rutina (con los ids estables de ítems y ejercicios). */
  routineContent: routineContentSchema
    .refine((c) => c.items.length >= 1, "La rutina está vacía")
    .refine((c) => c.items.length <= REFINE_MAX_ITEMS, `Máximo ${REFINE_MAX_ITEMS} ítems`)
    .refine((c) => JSON.stringify(c).length <= REFINE_MAX_CONTENT_JSON_CHARS, "La rutina es demasiado grande"),
  message: z.string().trim().min(1).max(REFINE_MAX_MESSAGE_CHARS),
  /** Turnos previos de la conversación (solo texto). Se usan los últimos REFINE_MAX_HISTORY_MESSAGES. */
  history: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(REFINE_MAX_HISTORY_INPUT).default([]),
  context: z.object({
    level:        z.enum(["beginner", "intermediate", "advanced"]).nullish(),
    limitations:  z.string().max(500).nullish(),
    /** null/omitido = sin restricción; [] = solo peso corporal */
    equipmentIds: z.array(z.string().uuid()).max(50).nullish(),
    hasKnownRM:   z.boolean().optional(),
  }).optional(),
})

export type RefineRoutineInput = z.infer<typeof refineRoutineInputSchema>

export type RefineRoutineResult = {
  message: string
  proposedContent: RoutineContent
  changes: RoutineChange[]
  /** Ejercicios creados con propose_new_exercise (privados del equipo, quedan en el catálogo aunque se descarte la propuesta). */
  createdExercises: { id: string; name: string }[]
}

// ─── Tools ────────────────────────────────────────────────────────────────────

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

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[]): OpenAI.Chat.Completions.ChatCompletionTool {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } }
}

const editTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  fn("replace_exercise", "Cambia el ejercicio de un ítem por otro (id obtenido con search_exercises). Conserva series, descanso, tempo y objetivo salvo que envíes sets.", {
    itemId: uuidProp("id del ejercicio en el estado actual"),
    newExerciseId: uuidProp("exerciseId devuelto por search_exercises/propose_new_exercise"),
    keepSets: { type: "boolean", description: "Default true. Con false, sets es obligatorio" },
    sets: setsJson,
    notes: { type: ["string", "null"], description: "Notas nuevas; por defecto se borran las del ejercicio anterior" },
  }, ["itemId", "newExerciseId"]),
  fn("add_exercise", "Agrega un ejercicio (id obtenido con search_exercises) al nivel superior o dentro de un bloque.", {
    exerciseId: uuidProp("exerciseId devuelto por search_exercises/propose_new_exercise"),
    blockId: { type: ["string", "null"], description: "Id del bloque destino; omitir para el nivel superior" },
    position: { type: "integer", description: "0 = primero; omitir para el final" },
    goal: { type: "string", enum: EXERCISE_GOALS },
    restSeconds: { type: "integer" },
    tempo: { type: "string", description: "Formato E-P-C-P, ej. 3-1-1-0" },
    notes: { type: "string" },
    sets: setsJson,
  }, ["exerciseId", "sets"]),
  fn("remove_item", "Elimina un ejercicio o un bloque completo. No se puede vaciar un bloque quitando su único ejercicio: elimina el bloque.", {
    itemId: uuidProp("id del ejercicio o bloque"),
  }, ["itemId"]),
  fn("move_item", "Mueve un ejercicio o bloque a otra posición (0 = primero), opcionalmente a otro bloque. Los bloques solo van en el nivel superior.", {
    itemId: uuidProp("id del ejercicio o bloque"),
    toBlockId: { type: ["string", "null"], description: "Bloque destino; omitir/null para el nivel superior" },
    toPosition: { type: "integer" },
  }, ["itemId", "toPosition"]),
  fn("update_sets", "Reemplaza TODAS las series de un ejercicio (repeticiones, tiempo, carga).", {
    itemId: uuidProp("id del ejercicio"),
    sets: setsJson,
  }, ["itemId", "sets"]),
  fn("update_item_fields", "Cambia tempo, descanso, objetivo o notas de un ejercicio. null borra el campo; omitirlo lo deja igual.", {
    itemId: uuidProp("id del ejercicio"),
    tempo: { type: ["string", "null"] },
    restSeconds: { type: ["integer", "null"] },
    goal: { type: ["string", "null"], enum: [...EXERCISE_GOALS, null] },
    notes: { type: ["string", "null"] },
  }, ["itemId"]),
  fn("update_block", "Cambia rondas, nombre o descanso entre rondas de un bloque. null borra el campo; omitirlo lo deja igual.", {
    itemId: uuidProp("id del bloque"),
    rounds: { type: "integer", description: `2 a ${MAX_BLOCK_ROUNDS}` },
    name: { type: ["string", "null"] },
    restBetweenRoundsSeconds: { type: ["integer", "null"] },
  }, ["itemId"]),
]

const proposeEditsTool = fn(
  "propose_edits",
  "Termina el turno. Llamar UNA vez, al final, después de aplicar los cambios (o sin cambios si solo era una pregunta).",
  { message: { type: "string", description: "1-3 frases en español: qué cambiaste o la respuesta" } },
  ["message"],
)

const EDIT_TOOL_NAMES = new Set(editTools.map((t) => (t.type === "function" ? t.function.name : "")))

// ─── Dependencias (inyectables) ───────────────────────────────────────────────

export type RefineCompletion = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage
  finishReason: string | null | undefined
  usage: { input: number; output: number }
}

export type RefineDeps = {
  complete(params: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  }): Promise<RefineCompletion>
  /** Tools de catálogo (search_exercises y propose_new_exercise). */
  catalogTools: OpenAI.Chat.Completions.ChatCompletionTool[]
  searchExercises(args: unknown, ctx: Ctx): Promise<unknown>
  proposeNewExercise(args: unknown, ctx: Ctx): Promise<unknown>
  getExerciseNames(ids: string[]): Promise<Record<string, string>>
  getEquipmentNames(ids: string[]): Promise<string[]>
}

// ─── Estado de la rutina para el modelo ──────────────────────────────────────

type ExerciseLike = { id: string; exerciseId: string; goal?: string; tempo?: string; restSeconds?: number; notes?: string; sets: unknown[] }

function exerciseView(ex: ExerciseLike, names: Record<string, string>) {
  return {
    id: ex.id,
    exercise: names[ex.exerciseId] ?? "(ejercicio sin nombre)",
    goal: ex.goal,
    tempo: ex.tempo,
    restSeconds: ex.restSeconds,
    notes: ex.notes,
    sets: ex.sets.map((s) => {
      const { setNumber: _n, ...rest } = s as Record<string, unknown>
      return rest
    }),
  }
}

/** Vista compacta y legible de la rutina (ids estables, nombres en vez de exerciseId). */
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

function exerciseIdsOf(content: RoutineContent): string[] {
  return [...new Set(content.items.flatMap((it) => it.type === "exercise" ? [it.exerciseId] : it.exercises.map((e) => e.exerciseId)))]
}

const labels = { level: { beginner: "principiante", intermediate: "intermedio", advanced: "avanzado" } }

export function buildRefineUserPrompt(
  input: Pick<RefineRoutineInput, "message" | "context">,
  content: RoutineContent,
  names: Record<string, string>,
  equipmentNames: string[] | null,
) {
  const ctx = input.context
  const lines = [
    "ESTADO ACTUAL DE LA RUTINA (json; usa estos ids):",
    JSON.stringify(describeRoutineForModel(content, names)),
    "",
    "CONTEXTO:",
    `- Nivel: ${ctx?.level ? labels.level[ctx.level] : "no especificado"}`,
    `- Limitaciones o lesiones: ${ctx?.limitations?.trim() || "no especificadas"}`,
    `- Equipamiento: ${equipmentNames === null ? "no restringido" : equipmentNames.length ? equipmentNames.join(", ") : "ninguno (solo peso corporal)"}`,
    `- RM registrados: ${ctx?.hasKnownRM ? "sí (puedes usar percent_rm)" : "no (usa RPE)"}`,
    "",
    "MENSAJE DEL ENTRENADOR:",
    input.message,
  ]
  return lines.join("\n")
}

/** El entrenador dio pesos en kg/lb en su mensaje: solo entonces se admite fixed_kg. */
export function messageMentionsWeights(message: string): boolean {
  return /\d\s*(kg|kilos?|lbs?|libras?)\b/i.test(message)
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function refineRoutineWithAI(
  rawInput: RefineRoutineInput,
  userId: string,
  log: FastifyBaseLogger,
  deps: RefineDeps,
): Promise<RefineRoutineResult> {
  const input = refineRoutineInputSchema.parse(rawInput)

  const equipmentIds = input.context?.equipmentIds
  const equipmentNames = equipmentIds ? await deps.getEquipmentNames(equipmentIds) : null

  const names: Record<string, string> = await deps.getExerciseNames(exerciseIdsOf(input.routineContent))
  const ctx: Ctx = {
    userId,
    teamId: input.teamId,
    allowedEquipment: equipmentIds ? new Set(equipmentIds) : null,
    knownIds: new Set(),
    created: [],
  }

  // Solo texto de los últimos turnos; el estado de la rutina viaja siempre fresco en el último mensaje
  const history = input.history
    .slice(-REFINE_MAX_HISTORY_MESSAGES)
    .map((h) => ({ role: h.role, content: h.content.slice(0, REFINE_HISTORY_MESSAGE_CHARS) }) as const)

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: AI_ROUTINE_REFINE_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: buildRefineUserPrompt(input, input.routineContent, names, equipmentNames) },
  ]

  const tools = [...deps.catalogTools, ...editTools, proposeEditsTool]
  const allowFixedKg = messageMentionsWeights(input.message)
  const allowPercentRm = input.context?.hasKnownRM === true

  let working = input.routineContent
  const changes: RoutineChange[] = []
  const usage = { input: 0, output: 0 }
  let lastError: string | undefined

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const completion = await deps.complete({ messages, tools })
    usage.input += completion.usage.input
    usage.output += completion.usage.output

    const message = completion.message
    if (!message.tool_calls?.length) {
      lastError = `El modelo dejó de llamar tools sin enviar propose_edits (finish_reason=${completion.finishReason})`
      break
    }
    messages.push(message)

    const turnLog: { tool: string; error?: string }[] = []
    let finalMessage: string | undefined
    let finishCallId: string | undefined
    let editErrorThisTurn = false

    for (const call of message.tool_calls) {
      if (call.type !== "function") continue
      const name = call.function.name

      if (name === "propose_edits") {
        finishCallId = call.id
        try {
          finalMessage = z.object({ message: z.string().trim().min(1) }).parse(JSON.parse(call.function.arguments)).message.slice(0, MAX_REPLY_CHARS)
        } catch {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Falta message (texto en español)." }) })
          turnLog.push({ tool: name, error: "message inválido" })
          finishCallId = undefined
        }
        continue
      }

      let result: unknown
      try {
        const args = JSON.parse(call.function.arguments)
        if (name === "search_exercises") {
          result = await deps.searchExercises(args, ctx)
          if (Array.isArray(result)) for (const r of result as { id: string; name: string }[]) names[r.id] = r.name
        } else if (name === "propose_new_exercise") {
          result = await deps.proposeNewExercise(args, ctx)
          const created = result as { id?: string; name?: string }
          if (created.id && created.name) names[created.id] = created.name
        } else if (EDIT_TOOL_NAMES.has(name)) {
          const op = editOpSchema.parse({ ...args, op: name }) as EditOp
          const applied = applyEdit(working, op, { knownExerciseIds: ctx.knownIds, exerciseNames: names, allowFixedKg, allowPercentRm })
          working = applied.content
          changes.push(...applied.changes)
          result = { ok: true, summary: applied.changes.map((c) => c.summary), state: describeRoutineForModel(working, names) }
        } else {
          result = { error: `Tool desconocida: ${name}` }
          turnLog.push({ tool: name, error: `Tool desconocida: ${name}` })
          editErrorThisTurn = true
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) })
          continue
        }
        turnLog.push({ tool: name })
      } catch (err) {
        const text = err instanceof RoutineEditError
          ? err.message
          : err instanceof z.ZodError
            ? err.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : "Argumentos inválidos"
        result = { error: text }
        turnLog.push({ tool: name, error: text })
        lastError = text
        if (EDIT_TOOL_NAMES.has(name)) editErrorThisTurn = true
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) })
    }

    log.info({ teamId: input.teamId, turn, calls: turnLog }, "[ai-routines] refinamiento turno")

    if (finishCallId && finalMessage) {
      if (editErrorThisTurn) {
        // Un cambio falló en este mismo turno: el mensaje podría describir algo que no se aplicó
        messages.push({ role: "tool", tool_call_id: finishCallId, content: JSON.stringify({ error: "Algún cambio falló en este turno. Revisa el estado actual y vuelve a llamar propose_edits con un mensaje que refleje lo que sí se aplicó." }) })
        continue
      }
      const proposedContent = routineContentSchema.parse(working) as RoutineContent
      log.info({ teamId: input.teamId, userId, turns: turn, tokens: usage, edits: changes.length, created: ctx.created.length }, "[ai-routines] refinamiento éxito")
      return { message: finalMessage, proposedContent, changes, createdExercises: ctx.created }
    }
  }

  log.warn({ teamId: input.teamId, userId, tokens: usage, lastError, exercisesCreated: ctx.created.length }, "[ai-routines] refinamiento sin resultado")
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La IA no logró procesar el ajuste. Intenta reformular el pedido." })
}
