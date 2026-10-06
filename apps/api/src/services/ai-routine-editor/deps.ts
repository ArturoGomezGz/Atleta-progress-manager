// Dependencias inyectables del tweak (OpenAI y base de datos). La interfaz va aquí para que el flujo
// completo se pruebe con un LLM simulado, sin red ni base de datos.

import type OpenAI from "openai"
import type { Ctx } from "../ai-routines"

export type ToolChoice = "required" | { type: "function"; function: { name: string } }

export type Completion = {
  message: OpenAI.Chat.Completions.ChatCompletionMessage
  finishReason: string | null | undefined
  usage: { input: number; output: number }
}

export type TweakDeps = {
  complete(params: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
    toolChoice: ToolChoice
  }): Promise<Completion>
  searchExercises(args: unknown, ctx: Ctx): Promise<unknown>
  proposeNewExercise(args: unknown, ctx: Ctx): Promise<unknown>
  getExerciseNames(ids: string[]): Promise<Record<string, string>>
}
