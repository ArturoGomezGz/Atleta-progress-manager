import { db } from "@atleta/db/client"
import { equipment, exercise, type RoutineContent, type RoutineExerciseContent, type RoutineSet } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, arrayContains, eq, ilike, inArray, isNull, or } from "drizzle-orm"
import type OpenAI from "openai"
import { z } from "zod"
import { attachDetails, getOpenAI } from "../routers/exercises"
import { AI_ROUTINE_SYSTEM_PROMPT } from "./ai-routines-prompt"

const MODEL = "gpt-4o-mini"
const MAX_TURNS = 16
const MAX_NEW_EXERCISES = 2

const goals = ["strength", "hypertrophy", "endurance", "power", "cardio", "recovery"] as const
const levels = ["beginner", "intermediate", "advanced"] as const
const patterns = ["push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility", "core"] as const
const bodyZones = ["upper", "lower", "core"] as const

export const aiRoutineInputSchema = z.object({
  teamId:          z.string().uuid(),
  goal:            z.enum(goals),
  durationMinutes: z.number().int().min(15).max(180),
  level:           z.enum(levels).nullable().optional(),
  includeWarmup:   z.boolean().default(true),
  // Default de la guía: vuelta a la calma solo en sesiones de 45 min o más
  includeCooldown: z.boolean().nullable().optional(),
  hasKnownRM:      z.boolean().default(false),
  format:          z.enum(["traditional", "circuit", "mixed"]).nullable().optional(),
  focusPatterns:   z.array(z.enum(patterns)).max(9).nullable().optional(),
  focusZones:      z.array(z.enum(bodyZones)).max(3).nullable().optional(),
  // null/undefined = sin restricción; [] = solo peso corporal
  equipmentIds:    z.array(z.string().uuid()).max(50).nullable().optional(),
  limitations:     z.string().max(500).nullable().optional(),
  description:     z.string().max(1500).nullable().optional(),
})

export type AiRoutineInput = z.infer<typeof aiRoutineInputSchema>

// ─── Esquema de la rutina que devuelve el modelo (sin ids ni orden) ───────────

const aiSetSchema = z.object({
  setType:               z.enum(["reps", "time"]),
  targetReps:            z.number().int().positive().max(200).optional().nullable(),
  targetDurationSeconds: z.number().int().positive().max(3600).optional().nullable(),
  loadType:              z.enum(["rpe", "percent_rm", "fixed_kg"]).optional().nullable(),
  loadValue:             z.number().positive().max(1000).optional().nullable(),
})

const aiExerciseSchema = z.object({
  exerciseId:  z.string().uuid(),
  goal:        z.enum(goals).optional().nullable(),
  restSeconds: z.number().int().positive().max(600).optional().nullable(),
  tempo:       z.string().regex(/^[0-9X]-[0-9X]-[0-9X]-[0-9X]$/i).optional().nullable(),
  notes:       z.string().max(300).optional().nullable(),
  sets:        z.array(aiSetSchema).min(1).max(12),
})

const aiRoutineSchema = z.object({
  summary: z.string().max(600),
  items: z.array(z.discriminatedUnion("type", [
    aiExerciseSchema.extend({ type: z.literal("exercise") }),
    z.object({
      type:      z.literal("block"),
      name:      z.string().max(60).optional().nullable(),
      rounds:    z.number().int().min(2).max(20),
      exercises: z.array(aiExerciseSchema).min(1).max(10),
    }),
  ])).min(1).max(20),
})

// ─── Tools ────────────────────────────────────────────────────────────────────

const setJsonSchema = {
  type: "object",
  properties: {
    setType:               { type: "string", enum: ["reps", "time"] },
    targetReps:            { type: "integer", description: "Solo si setType=reps" },
    targetDurationSeconds: { type: "integer", description: "Solo si setType=time" },
    loadType:              { type: "string", enum: ["rpe", "percent_rm", "fixed_kg"], description: "Omitir para peso corporal. fixed_kg se muestra en lbs" },
    loadValue:             { type: "number" },
  },
  required: ["setType"],
}

const exerciseJsonSchema = {
  type: "object",
  properties: {
    exerciseId:  { type: "string", description: "id devuelto por search_exercises o propose_new_exercise" },
    goal:        { type: "string", enum: goals },
    restSeconds: { type: "integer" },
    tempo:       { type: "string", description: "Formato excéntrica-pausa-concéntrica-pausa, ej. 3-1-1-0" },
    notes:       { type: "string", description: "Indicación breve para el atleta, en español" },
    sets:        { type: "array", items: setJsonSchema },
  },
  required: ["exerciseId", "sets"],
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_exercises",
      description: "Busca ejercicios en el catálogo disponible para el equipo (nombres en español). Devuelve hasta 12 resultados ya filtrados por el equipamiento permitido.",
      parameters: {
        type: "object",
        properties: {
          query:           { type: "string", description: "Texto parcial del nombre en español, ej. 'sentadilla'. Omitir para buscar solo por filtros" },
          movementPattern: { type: "string", enum: patterns },
          bodyZone:        { type: "string", enum: bodyZones },
          difficulty:      { type: "string", enum: levels },
          warmupOnly:      { type: "boolean", description: "true para ejercicios marcados como aptos para calentamiento" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_new_exercise",
      description: `Crea un ejercicio nuevo en el catálogo del equipo cuando ninguna búsqueda devuelve un equivalente razonable. Máximo ${MAX_NEW_EXERCISES} por rutina.`,
      parameters: {
        type: "object",
        properties: {
          name:              { type: "string", description: "Nombre en español" },
          description:       { type: "string", description: "Ejecución en 1-2 frases" },
          difficulty:        { type: "string", enum: levels },
          movementPatterns:  { type: "array", items: { type: "string", enum: patterns } },
          contraindications: { type: "string" },
        },
        required: ["name", "description", "difficulty", "movementPatterns"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_routine",
      description: "Entrega la rutina final. Llamar una sola vez, al terminar.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "2-3 frases en español para el entrenador: estructura y criterio" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type:      { type: "string", enum: ["exercise", "block"] },
                name:      { type: "string", description: "Solo bloques, ej. 'Calentamiento'" },
                rounds:    { type: "integer", description: "Solo bloques, mínimo 2" },
                exercises: { type: "array", items: exerciseJsonSchema, description: "Solo bloques" },
                ...exerciseJsonSchema.properties,
              },
              required: ["type"],
            },
          },
        },
        required: ["summary", "items"],
      },
    },
  },
]

// ─── Ejecución de tools ───────────────────────────────────────────────────────

type Ctx = {
  userId: string
  teamId: string
  allowedEquipment: Set<string> | null
  knownIds: Set<string>
  created: { id: string; name: string }[]
}

function visibleTo(ctx: Ctx) {
  return and(
    isNull(exercise.deletedAt),
    or(
      and(isNull(exercise.ownerUserId), isNull(exercise.ownerTeamId)),
      eq(exercise.isPublic, true),
      eq(exercise.ownerTeamId, ctx.teamId),
      eq(exercise.ownerUserId, ctx.userId),
    ),
  )
}

const searchArgsSchema = z.object({
  query:           z.string().max(80).optional().nullable(),
  movementPattern: z.enum(patterns).optional().nullable(),
  bodyZone:        z.enum(bodyZones).optional().nullable(),
  difficulty:      z.enum(levels).optional().nullable(),
  warmupOnly:      z.boolean().optional().nullable(),
})

async function searchExercises(raw: unknown, ctx: Ctx) {
  const args = searchArgsSchema.parse(raw)
  const rows = await db
    .select()
    .from(exercise)
    .where(and(
      visibleTo(ctx),
      args.query ? ilike(exercise.name, `%${args.query.trim()}%`) : undefined,
      args.movementPattern ? arrayContains(exercise.movementPatterns, [args.movementPattern]) : undefined,
      args.difficulty ? eq(exercise.difficulty, args.difficulty) : undefined,
      args.warmupOnly ? eq(exercise.suitableFor, "warmup") : undefined,
    ))
    .limit(80)

  const results = (await attachDetails(rows))
    .filter((ex) => !args.bodyZone || ex.muscles.some((m) => m.role === "primary" && m.bodyZone === args.bodyZone))
    .filter((ex) => !ctx.allowedEquipment || ex.equipment.every((e) => ctx.allowedEquipment!.has(e.equipmentId)))
    .slice(0, 12)

  for (const ex of results) ctx.knownIds.add(ex.id)

  return results.map((ex) => ({
    id: ex.id,
    name: ex.name,
    difficulty: ex.difficulty,
    patterns: ex.movementPatterns,
    warmup: ex.suitableFor === "warmup" || undefined,
    equipment: ex.equipment.map((e) => e.equipmentName),
    primaryMuscles: ex.muscles.filter((m) => m.role === "primary").map((m) => m.muscleName),
    contraindications: ex.contraindications ? ex.contraindications.slice(0, 160) : undefined,
  }))
}

const proposeArgsSchema = z.object({
  name:              z.string().min(2).max(80),
  description:       z.string().max(400),
  difficulty:        z.enum(levels),
  movementPatterns:  z.array(z.enum(patterns)).max(4),
  contraindications: z.string().max(300).optional().nullable(),
})

async function proposeNewExercise(raw: unknown, ctx: Ctx) {
  const args = proposeArgsSchema.parse(raw)
  const name = args.name.trim()

  const [existing] = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exercise)
    .where(and(visibleTo(ctx), ilike(exercise.name, name)))
    .limit(1)
  if (existing) {
    ctx.knownIds.add(existing.id)
    return { id: existing.id, name: existing.name, note: "Ya existía en el catálogo; úsalo" }
  }

  if (ctx.created.length >= MAX_NEW_EXERCISES) {
    return { error: `Límite de ${MAX_NEW_EXERCISES} ejercicios nuevos alcanzado. Usa uno del catálogo.` }
  }

  const [inserted] = await db
    .insert(exercise)
    .values({
      name,
      description: args.description,
      difficulty: args.difficulty,
      movementPatterns: args.movementPatterns,
      contraindications: args.contraindications ?? null,
      isPublic: false,
      ownerTeamId: ctx.teamId,
      createdBy: ctx.userId,
    })
    .onConflictDoNothing()
    .returning({ id: exercise.id, name: exercise.name })

  if (!inserted) return { error: "No se pudo crear (nombre duplicado). Búscalo con search_exercises." }

  ctx.knownIds.add(inserted.id)
  ctx.created.push(inserted)
  return inserted
}

// ─── Conversión a RoutineContent ──────────────────────────────────────────────

function toSets(sets: z.infer<typeof aiSetSchema>[]): RoutineSet[] {
  return sets.map((s, i) => {
    if (s.setType === "time") {
      return { setNumber: i + 1, setType: "time", ...(s.targetDurationSeconds ? { targetDurationSeconds: s.targetDurationSeconds } : {}) }
    }
    return {
      setNumber: i + 1,
      setType: "reps",
      ...(s.targetReps ? { targetReps: s.targetReps } : {}),
      ...(s.loadType && s.loadValue ? { loadType: s.loadType, loadValue: s.loadValue } : {}),
    }
  })
}

function toExercise(ex: z.infer<typeof aiExerciseSchema>, order: number): RoutineExerciseContent {
  return {
    id: crypto.randomUUID(),
    exerciseId: ex.exerciseId,
    order,
    ...(ex.tempo ? { tempo: ex.tempo } : {}),
    ...(ex.restSeconds ? { restSeconds: ex.restSeconds } : {}),
    ...(ex.goal ? { goal: ex.goal } : {}),
    ...(ex.notes ? { notes: ex.notes } : {}),
    sets: toSets(ex.sets),
  }
}

function buildRoutine(raw: unknown, ctx: Ctx): { content: RoutineContent; summary: string } | { error: string } {
  const parsed = aiRoutineSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: `Rutina inválida: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` }
  }

  const ids = parsed.data.items.flatMap((it) => it.type === "exercise" ? [it.exerciseId] : it.exercises.map((e) => e.exerciseId))
  const unknown = [...new Set(ids.filter((id) => !ctx.knownIds.has(id)))]
  if (unknown.length > 0) {
    return { error: `Estos exerciseId no salieron de search_exercises ni propose_new_exercise: ${unknown.join(", ")}. Busca de nuevo y usa solo ids devueltos.` }
  }

  const content: RoutineContent = {
    v: 1,
    items: parsed.data.items.map((it, order) =>
      it.type === "exercise"
        ? { type: "exercise" as const, ...toExercise(it, order) }
        : {
            type: "block" as const,
            id: crypto.randomUUID(),
            order,
            ...(it.name ? { name: it.name } : {}),
            rounds: it.rounds,
            exercises: it.exercises.map((e, i) => toExercise(e, i)),
          },
    ),
  }
  return { content, summary: parsed.data.summary }
}

// ─── Prompt del usuario ───────────────────────────────────────────────────────

const labels = {
  goal: { strength: "fuerza", hypertrophy: "hipertrofia", endurance: "resistencia muscular", power: "potencia", cardio: "acondicionamiento/cardio", recovery: "recuperación/movilidad" },
  level: { beginner: "principiante", intermediate: "intermedio", advanced: "avanzado" },
  format: { traditional: "tradicional (ejercicio por ejercicio)", circuit: "circuitos", mixed: "mixto" },
  zone: { upper: "tren superior", lower: "tren inferior", core: "core" },
}

function buildUserPrompt(input: AiRoutineInput, equipmentNames: string[] | null) {
  const line = (label: string, value: string | null | undefined) => `- ${label}: ${value ?? "no especificado"}`
  return [
    "Solicitud del entrenador:",
    line("Objetivo principal", labels.goal[input.goal]),
    line("Duración total", `${input.durationMinutes} minutos`),
    line("Nivel", input.level ? labels.level[input.level] : null),
    line("Calentamiento", input.includeWarmup ? "sí" : "no"),
    line("Vuelta a la calma", (input.includeCooldown ?? input.durationMinutes >= 45) ? "sí" : "no"),
    line("RM registrados", input.hasKnownRM ? "sí, puedes usar percent_rm en los básicos" : "no (usa RPE)"),
    line("Formato preferido", input.format ? labels.format[input.format] : null),
    line("Patrones foco", input.focusPatterns?.length ? input.focusPatterns.join(", ") : null),
    line("Zonas foco", input.focusZones?.length ? input.focusZones.map((z) => labels.zone[z]).join(", ") : null),
    line("Equipamiento disponible", equipmentNames === null ? null : equipmentNames.length ? equipmentNames.join(", ") : "ninguno (solo peso corporal)"),
    line("Limitaciones o lesiones", input.limitations?.trim() || null),
    "",
    "Descripción libre:",
    input.description?.trim() || "(sin descripción)",
  ].join("\n")
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function generateRoutineWithAI(input: AiRoutineInput, userId: string) {
  let equipmentNames: string[] | null = null
  if (input.equipmentIds) {
    equipmentNames = input.equipmentIds.length
      ? (await db.select({ name: equipment.name }).from(equipment).where(inArray(equipment.id, input.equipmentIds))).map((e) => e.name)
      : []
  }

  const ctx: Ctx = {
    userId,
    teamId: input.teamId,
    allowedEquipment: input.equipmentIds ? new Set(input.equipmentIds) : null,
    knownIds: new Set(),
    created: [],
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: AI_ROUTINE_SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(input, equipmentNames) },
  ]

  const usage = { input: 0, output: 0 }
  let lastError: string | undefined

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const response = await getOpenAI().chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 4000,
      tools,
      tool_choice: "required",
      messages,
    })
    usage.input += response.usage?.prompt_tokens ?? 0
    usage.output += response.usage?.completion_tokens ?? 0

    const message = response.choices[0]?.message
    if (!message?.tool_calls?.length) {
      lastError = `El modelo dejó de llamar tools sin enviar submit_routine (finish_reason=${response.choices[0]?.finish_reason})`
      break
    }
    messages.push(message)

    const turnLog: { tool: string; error?: string }[] = []

    for (const call of message.tool_calls) {
      if (call.type !== "function") continue
      let result: unknown
      try {
        const args = JSON.parse(call.function.arguments)
        if (call.function.name === "submit_routine") {
          const built = buildRoutine(args, ctx)
          if (!("error" in built)) {
            console.info("[ai-routines] éxito", { teamId: input.teamId, turns: turn, tokens: usage, created: ctx.created.length })
            return { ...built, createdExercises: ctx.created }
          }
          result = built
          lastError = built.error
          turnLog.push({ tool: call.function.name, error: built.error })
        } else if (call.function.name === "search_exercises") {
          result = await searchExercises(args, ctx)
          turnLog.push({ tool: call.function.name })
        } else if (call.function.name === "propose_new_exercise") {
          result = await proposeNewExercise(args, ctx)
          turnLog.push({ tool: call.function.name })
        } else {
          const unknownToolError = `Tool desconocida: ${call.function.name}`
          result = { error: unknownToolError }
          turnLog.push({ tool: call.function.name, error: unknownToolError })
        }
      } catch (err) {
        const message = err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Argumentos inválidos"
        result = { error: message }
        turnLog.push({ tool: call.function.name, error: message })
        if (call.function.name === "submit_routine") lastError = message
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) })
    }
    console.info("[ai-routines] turno", { teamId: input.teamId, turn, calls: turnLog })
  }

  console.warn("[ai-routines] sin rutina válida", { teamId: input.teamId, tokens: usage, lastError, exercisesCreated: ctx.created.length })
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La IA no logró completar la rutina. Intenta de nuevo o agrega más detalle." })
}
