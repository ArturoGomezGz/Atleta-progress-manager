// Adaptador: habilidades del registro -> tools de OpenAI. Es el único lugar con tipos de OpenAI;
// las definiciones de habilidades son independientes del proveedor.

import type OpenAI from "openai"
import { getSkill } from "../skills"
import type { AnySkill } from "../types"

export type OpenAITool = OpenAI.Chat.Completions.ChatCompletionTool

export function skillToTool(skill: AnySkill): OpenAITool {
  if (!skill.parameters) throw new Error(`La habilidad ${skill.id} no declara parameters`)
  return { type: "function", function: { name: skill.id, description: skill.description, parameters: skill.parameters } }
}

export function skillsToTools(ids: readonly string[]): OpenAITool[] {
  return ids.map((id) => {
    const skill = getSkill(id)
    if (!skill) throw new Error(`Habilidad desconocida: ${id}`)
    return skillToTool(skill)
  })
}

/** Tool de cierre del agente: no es una habilidad (no toca la rutina). */
export const FINISH_TOOL_NAME = "propose_edits"
export const finishTool: OpenAITool = {
  type: "function",
  function: {
    name: FINISH_TOOL_NAME,
    description: "Termina el tweak. Llamar UNA vez, cuando ya aplicaste el cambio pedido (o sin cambios si no era posible).",
    parameters: { type: "object", properties: { message: { type: "string", description: "1-2 frases en español: qué cambiaste o por qué no se pudo" } }, required: ["message"] },
  },
}
