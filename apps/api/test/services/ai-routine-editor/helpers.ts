import type { RoutineContent } from "@atleta/db/schema"
import type OpenAI from "openai"
import type { Completion, TweakDeps } from "../../../src/services/ai-routine-editor/deps"

export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
export const TEAM = id(1)
export const SQUAT = id(101)
export const PRESS = id(102)
export const ROW = id(103)
export const DIPS = id(104)
export const NEW_EX = id(105)
export const BAD_EX = id(106)
export const ITEM_SQUAT = id(11)
export const ITEM_PRESS = id(12)
export const ITEM_ROW = id(13)
export const ITEM_DIPS = id(14)

export const NAMES: Record<string, string> = { [SQUAT]: "Sentadilla", [PRESS]: "Press banca", [ROW]: "Remo", [DIPS]: "Fondos en paralelas", [NEW_EX]: "Prensa de pierna", [BAD_EX]: "Fondos en paralelas asistidos" }

const rpe = (reps: number, v: number) => ({ setNumber: 1, setType: "reps" as const, targetReps: reps, loadType: "rpe" as const, loadValue: v })

export const content = (): RoutineContent => ({
  v: 1,
  items: [
    { type: "exercise", id: ITEM_SQUAT, exerciseId: SQUAT, order: 0, goal: "strength", restSeconds: 120, sets: [rpe(5, 7), { ...rpe(5, 7), setNumber: 2 }, { ...rpe(5, 7), setNumber: 3 }] },
    { type: "exercise", id: ITEM_PRESS, exerciseId: PRESS, order: 1, restSeconds: 90, sets: [rpe(8, 7), { ...rpe(8, 7), setNumber: 2 }] },
    { type: "exercise", id: ITEM_ROW, exerciseId: ROW, order: 2, restSeconds: 60, sets: [rpe(10, 6.5), { ...rpe(10, 6.5), setNumber: 2 }] },
    { type: "exercise", id: ITEM_DIPS, exerciseId: DIPS, order: 3, sets: [{ setNumber: 1, setType: "reps", targetReps: 10 }] },
  ],
})

export type Call = { name: string; args: unknown }

export const completion = (calls: Call[]): Completion => ({
  finishReason: "tool_calls",
  usage: { input: 10, output: 5 },
  message: {
    role: "assistant", content: null, refusal: null,
    tool_calls: calls.map((c, i) => ({ id: `call_${c.name}_${i}`, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })),
  } as OpenAI.Chat.Completions.ChatCompletionMessage,
})

export type Seen = { router: OpenAI.Chat.Completions.ChatCompletionMessageParam[][]; agent: { messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; tools: string[] }[] }

/** LLM simulado: `route` responde al enrutador (route_request); `agent` es el guion de turnos del agente. */
export function mockDeps(script: { route?: Call; agent?: Call[][] }, seen: Seen = { router: [], agent: [] }, search?: TweakDeps["searchExercises"], findPool?: TweakDeps["findAlternativePool"]): TweakDeps {
  let turn = 0
  return {
    async complete({ messages, tools }) {
      const names = tools.map((t) => (t.type === "function" ? t.function.name : ""))
      if (names.includes("route_request")) {
        seen.router.push(structuredClone(messages))
        if (!script.route) throw new Error("el enrutador no debía llamarse")
        return completion([script.route])
      }
      seen.agent.push({ messages: structuredClone(messages), tools: names })
      const calls = script.agent?.[turn++]
      if (!calls) throw new Error("guion del agente agotado")
      return completion(calls)
    },
    searchExercises: search ?? (async (_args, ctx) => {
      ctx.knownIds.add(NEW_EX)
      return [{ id: NEW_EX, name: "Prensa de pierna", equipment: ["Máquina"], patterns: ["squat"] }]
    }),
    findAlternativePool: findPool ?? (async () => ({
      target: { id: DIPS, name: "Fondos en paralelas", difficulty: "intermediate", patterns: ["push"], primaryMuscles: ["Pecho"], bodyZones: ["upper"], equipment: [] },
      pool: [{ id: NEW_EX, name: "Prensa de pierna", difficulty: "intermediate", patterns: ["push"], primaryMuscles: ["Pecho"], bodyZones: ["upper"], equipment: ["Máquina"] }],
    })),
    async getExerciseNames() { return { ...NAMES } },
  }
}

export const log = { info() {}, warn() {}, error() {} } as never
