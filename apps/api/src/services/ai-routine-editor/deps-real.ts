// Dependencias reales (OpenAI + base de datos) del AI Routine Editor.
import { db } from "@atleta/db/client"
import { exercise } from "@atleta/db/schema"
import { inArray } from "drizzle-orm"
import { getOpenAI } from "../../routers/exercises"
import { AI_MODEL, findAlternativePool, searchExercises } from "../ai-routines"
import type { TweakDeps } from "./deps"

export function createTweakDeps(): TweakDeps {
  return {
    async complete({ messages, tools, toolChoice }) {
      const response = await getOpenAI().chat.completions.create({
        model: AI_MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        tools,
        tool_choice: toolChoice,
        messages,
      })
      const message = response.choices[0]?.message
      if (!message) throw new Error("Respuesta vacía del modelo")
      return {
        message,
        finishReason: response.choices[0]?.finish_reason,
        usage: { input: response.usage?.prompt_tokens ?? 0, output: response.usage?.completion_tokens ?? 0 },
      }
    },
    searchExercises,
    findAlternativePool,
    async getExerciseNames(ids) {
      if (ids.length === 0) return {}
      const rows = await db.select({ id: exercise.id, name: exercise.name }).from(exercise).where(inArray(exercise.id, ids))
      return Object.fromEntries(rows.map((r) => [r.id, r.name]))
    },
  }
}
