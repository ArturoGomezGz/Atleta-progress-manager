import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RoutineContent } from "@atleta/db/schema"
import type OpenAI from "openai"
import {
  buildRefineUserPrompt,
  describeRoutineForModel,
  messageMentionsWeights,
  refineRoutineInputSchema,
  refineRoutineWithAI,
  REFINE_MAX_MESSAGE_CHARS,
  type RefineCompletion,
  type RefineDeps,
  type RefineRoutineInput,
} from "../../src/services/ai-routine-refine"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const TEAM = id(1)
const SQUAT = id(101)
const PRESS = id(102)
const NEW_EX = id(103)
const ITEM_SQUAT = id(11)
const ITEM_PRESS = id(12)

const content = (): RoutineContent => ({
  v: 1,
  items: [
    { type: "exercise", id: ITEM_SQUAT, exerciseId: SQUAT, order: 0, goal: "strength", sets: [{ setNumber: 1, setType: "reps", targetReps: 5, loadType: "rpe", loadValue: 8 }] },
    { type: "exercise", id: ITEM_PRESS, exerciseId: PRESS, order: 1, sets: [{ setNumber: 1, setType: "reps", targetReps: 10 }] },
  ],
})

const validInput = (): RefineRoutineInput => ({ teamId: TEAM, routineContent: content(), message: "Cambia la sentadilla", history: [] })

describe("refineRoutineInputSchema", () => {
  it("acepta una entrada mínima y aplica defaults", () => {
    const parsed = refineRoutineInputSchema.parse({ teamId: TEAM, routineContent: content(), message: "  hola  " })
    assert.equal(parsed.message, "hola")
    assert.deepEqual(parsed.history, [])
  })

  it("rechaza mensajes vacíos o demasiado largos", () => {
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), message: "   " }).success, false)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), message: "x".repeat(REFINE_MAX_MESSAGE_CHARS + 1) }).success, false)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), message: "x".repeat(REFINE_MAX_MESSAGE_CHARS) }).success, true)
  })

  it("limita el historial y valida roles", () => {
    const turn = (role: string) => ({ role, content: "hola" })
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), history: Array.from({ length: 12 }, () => turn("user")) }).success, true)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), history: Array.from({ length: 13 }, () => turn("user")) }).success, false)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), history: [turn("system")] }).success, false)
  })

  it("rechaza rutinas vacías, inválidas o demasiado grandes", () => {
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), routineContent: { v: 1, items: [] } }).success, false)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), routineContent: { v: 1, items: [{ type: "block", id: ITEM_SQUAT, order: 0, rounds: 1, exercises: [] }] } }).success, false)
    const many = { v: 1, items: Array.from({ length: 31 }, (_, i) => ({ ...content().items[0]!, id: id(500 + i), order: i })) }
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), routineContent: many }).success, false)
  })

  it("valida el contexto opcional", () => {
    const ok = refineRoutineInputSchema.safeParse({ ...validInput(), context: { level: "beginner", limitations: "hombro", equipmentIds: [], hasKnownRM: false } })
    assert.equal(ok.success, true)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), context: { level: "pro" } }).success, false)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), context: { limitations: "x".repeat(501) } }).success, false)
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), context: { equipmentIds: ["no-uuid"] } }).success, false)
  })

  it("exige teamId uuid", () => {
    assert.equal(refineRoutineInputSchema.safeParse({ ...validInput(), teamId: "x" }).success, false)
  })
})

describe("helpers de prompt", () => {
  it("describe la rutina con ids y nombres, sin exerciseId ni setNumber", () => {
    const view = describeRoutineForModel(content(), { [SQUAT]: "Sentadilla" })
    const text = JSON.stringify(view)
    assert.ok(text.includes(ITEM_SQUAT) && text.includes("Sentadilla"))
    assert.ok(!text.includes(SQUAT) && !text.includes("setNumber"))
  })

  it("el prompt de usuario incluye el estado actual, contexto y mensaje", () => {
    const p = buildRefineUserPrompt({ message: "baja el descanso", context: { level: "beginner", limitations: "rodilla" } }, content(), {}, ["Barra"])
    assert.ok(p.includes("ESTADO ACTUAL") && p.includes("principiante") && p.includes("rodilla") && p.includes("Barra") && p.includes("baja el descanso"))
  })

  it("detecta pesos mencionados por el entrenador", () => {
    assert.equal(messageMentionsWeights("sube a 60 kg"), true)
    assert.equal(messageMentionsWeights("usa 135 lbs"), true)
    assert.equal(messageMentionsWeights("más pesado"), false)
  })
})

// ─── Bucle con LLM simulado ───────────────────────────────────────────────────

type Call = { name: string; args: unknown }
const toolMsg = (calls: Call[]): RefineCompletion => ({
  finishReason: "tool_calls",
  usage: { input: 10, output: 5 },
  message: {
    role: "assistant", content: null, refusal: null,
    tool_calls: calls.map((c, i) => ({ id: `call_${c.name}_${i}`, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })),
  } as OpenAI.Chat.Completions.ChatCompletionMessage,
})

function mockDeps(script: Call[][], seen: { messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[][] } = { messages: [] }): RefineDeps {
  let turn = 0
  return {
    async complete({ messages }) {
      seen.messages.push(structuredClone(messages))
      const calls = script[turn++]
      if (!calls) throw new Error("guion agotado")
      return toolMsg(calls)
    },
    catalogTools: [],
    async searchExercises(_args, ctx) {
      ctx.knownIds.add(NEW_EX)
      return [{ id: NEW_EX, name: "Prensa de pierna" }]
    },
    async proposeNewExercise() { return { error: "no" } },
    async getExerciseNames() { return { [SQUAT]: "Sentadilla", [PRESS]: "Press banca" } },
    async getEquipmentNames() { return ["Barra"] },
  }
}

const log = { info() {}, warn() {}, error() {} } as never

describe("refineRoutineWithAI (LLM simulado)", () => {
  it("busca, edita y devuelve mensaje + contenido propuesto + cambios sin tocar la entrada", async () => {
    const input = validInput()
    const snapshot = structuredClone(input.routineContent)
    const result = await refineRoutineWithAI(input, "user-1", log, mockDeps([
      [{ name: "search_exercises", args: { query: "prensa" } }],
      [{ name: "replace_exercise", args: { itemId: ITEM_SQUAT, newExerciseId: NEW_EX } }, { name: "update_item_fields", args: { itemId: ITEM_PRESS, restSeconds: 90 } }],
      [{ name: "propose_edits", args: { message: "Cambié la sentadilla por prensa y bajé el descanso del press." } }],
    ]))
    assert.equal(result.message, "Cambié la sentadilla por prensa y bajé el descanso del press.")
    assert.equal(result.changes.length, 2)
    assert.equal(result.changes[0]!.summary, "Cambió Sentadilla por Prensa de pierna")
    const first = result.proposedContent.items[0]!
    assert.equal(first.type === "exercise" && first.exerciseId, NEW_EX)
    assert.deepEqual(input.routineContent, snapshot, "no muta la rutina original")
  })

  it("rechaza un exerciseId sin búsqueda previa y deja que el modelo se corrija", async () => {
    const seen = { messages: [] as OpenAI.Chat.Completions.ChatCompletionMessageParam[][] }
    const result = await refineRoutineWithAI(validInput(), "user-1", log, mockDeps([
      [{ name: "replace_exercise", args: { itemId: ITEM_SQUAT, newExerciseId: NEW_EX } }],
      [{ name: "search_exercises", args: {} }],
      [{ name: "replace_exercise", args: { itemId: ITEM_SQUAT, newExerciseId: NEW_EX } }],
      [{ name: "propose_edits", args: { message: "Listo." } }],
    ], seen))
    assert.equal(result.changes.length, 1)
    const toolReply = seen.messages[1]!.find((m) => m.role === "tool") as { content: string }
    assert.match(toolReply.content, /search_exercises/)
  })

  it("no acepta propose_edits en el mismo turno de un cambio fallido", async () => {
    const result = await refineRoutineWithAI(validInput(), "user-1", log, mockDeps([
      [{ name: "remove_item", args: { itemId: id(999) } }, { name: "propose_edits", args: { message: "Eliminé el ejercicio." } }],
      [{ name: "propose_edits", args: { message: "No pude eliminarlo; no existe." } }],
    ]))
    assert.equal(result.message, "No pude eliminarlo; no existe.")
    assert.equal(result.changes.length, 0)
  })

  it("permite responder sin cambios (pregunta o fuera de alcance)", async () => {
    const result = await refineRoutineWithAI(validInput(), "user-1", log, mockDeps([[{ name: "propose_edits", args: { message: "Solo puedo ayudarte con esta rutina." } }]]))
    assert.deepEqual(result.changes, [])
    assert.deepEqual(result.proposedContent, validInput().routineContent)
  })

  it("bloquea fixed_kg inventado salvo que el mensaje traiga pesos", async () => {
    const edit = { name: "update_sets", args: { itemId: ITEM_PRESS, sets: [{ setType: "reps", targetReps: 5, loadType: "fixed_kg", loadValue: 100 }] } }
    const done = { name: "propose_edits", args: { message: "ok" } }
    const blocked = await refineRoutineWithAI(validInput(), "u", log, mockDeps([[edit], [done]]))
    assert.equal(blocked.changes.length, 0)
    const allowed = await refineRoutineWithAI({ ...validInput(), message: "pon 100 lbs en el press" }, "u", log, mockDeps([[edit], [done]]))
    assert.equal(allowed.changes.length, 1)
  })

  it("envía solo los últimos mensajes del historial y el estado actual al final", async () => {
    const seen = { messages: [] as OpenAI.Chat.Completions.ChatCompletionMessageParam[][] }
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 === 0 ? "user" as const : "assistant" as const, content: `m${i}` }))
    await refineRoutineWithAI({ ...validInput(), history }, "u", log, mockDeps([[{ name: "propose_edits", args: { message: "ok" } }]], seen))
    const sent = seen.messages[0]!
    assert.equal(sent.length, 1 + 6 + 1)
    assert.equal(sent[0]!.role, "system")
    assert.equal((sent[1] as { content: string }).content, "m6")
    assert.match((sent.at(-1) as { content: string }).content, /ESTADO ACTUAL/)
  })

  it("falla con error TRPC si el modelo nunca termina", async () => {
    const loop = Array.from({ length: 10 }, () => [{ name: "search_exercises", args: {} }])
    await assert.rejects(refineRoutineWithAI(validInput(), "u", log, mockDeps(loop)), /no logró/)
  })

  it("valida la entrada también dentro del servicio", async () => {
    await assert.rejects(refineRoutineWithAI({ ...validInput(), message: "" }, "u", log, mockDeps([])))
  })
})
