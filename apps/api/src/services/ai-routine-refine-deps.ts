// Dependencias reales (OpenAI + base de datos) del refinamiento de rutinas con IA.
import { db } from "@atleta/db/client"
import { equipment, exercise } from "@atleta/db/schema"
import { inArray } from "drizzle-orm"
import { getOpenAI } from "../routers/exercises"
import { AI_MODEL, proposeExerciseTool, proposeNewExercise, searchExercises, searchExercisesTool } from "./ai-routines"
import type { RefineDeps } from "./ai-routine-refine"

export function createRefineDeps(): RefineDeps {
  return {
    async complete({ messages, tools }) {
      const response = await getOpenAI().chat.completions.create({
        model: AI_MODEL,
        temperature: 0.3,
        max_tokens: 2000,
        tools,
        tool_choice: "required",
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
    catalogTools: [searchExercisesTool, proposeExerciseTool],
    searchExercises,
    proposeNewExercise,
    async getExerciseNames(ids) {
      if (ids.length === 0) return {}
      const rows = await db.select({ id: exercise.id, name: exercise.name }).from(exercise).where(inArray(exercise.id, ids))
      return Object.fromEntries(rows.map((r) => [r.id, r.name]))
    },
    async getEquipmentNames(ids) {
      if (ids.length === 0) return []
      const rows = await db.select({ name: equipment.name }).from(equipment).where(inArray(equipment.id, ids))
      return rows.map((r) => r.name)
    },
  }
}
