// Enrutador de intención: una llamada barata al modelo que clasifica el pedido único en una intención,
// ítems objetivo y términos a evitar, o decide que hace falta UNA aclaración. Las acciones rápidas de la
// UI lo saltan con una pista explícita (`intentHint`).

import type { RoutineContent } from "@atleta/db/schema"
import { z } from "zod"
import { extractAvoidFromMessage, normalizeAvoid } from "./avoid"
import type { TweakDeps } from "./deps"
import { EXEC_INTENTS, INTENTS, type IntentParams } from "./intents"
import type { TweakInput } from "./input"
import { ROUTER_SYSTEM_PROMPT } from "./prompts"
import { outlineOf } from "./routine-view"

export type RouteDecision =
  | { kind: "intent"; params: IntentParams }
  | { kind: "clarify"; question: string; options?: string[] }
  | { kind: "reply"; message: string }

export const ROUTE_TOOL_NAME = "route_request"
const MAX_TARGETS = 10
const MAX_OPTIONS = 8

const routeSchema = z.object({
  intent:        z.enum([...EXEC_INTENTS, "clarify", "out_of_scope"]),
  targetItemIds: z.array(z.string()).nullish(),
  avoid:         z.array(z.string().max(60)).nullish(),
  direction:     z.enum(["up", "down"]).nullish(),
  knob:          z.enum(["volume", "intensity", "rest"]).nullish(),
  seconds:       z.number().int().min(15).max(600).nullish(),
  question:      z.string().max(300).nullish(),
  options:       z.array(z.string().max(60)).nullish(),
  reply:         z.string().max(300).nullish(),
})

function routeTool(canClarify: boolean) {
  return {
    type: "function" as const,
    function: {
      name: ROUTE_TOOL_NAME,
      description: "Clasifica el pedido del entrenador.",
      parameters: {
        type: "object",
        properties: {
          intent: { type: "string", enum: [...EXEC_INTENTS, ...(canClarify ? ["clarify"] : []), "out_of_scope"] },
          targetItemIds: { type: "array", items: { type: "string" }, description: "Ids de ítems de la lista a los que se refiere el pedido" },
          avoid: { type: "array", items: { type: "string" }, description: "Equipo o ejercicios que el entrenador no tiene o no quiere, dichos en este mensaje" },
          direction: { type: "string", enum: ["up", "down"] },
          knob: { type: "string", enum: ["volume", "intensity", "rest"] },
          seconds: { type: "integer", description: "Descanso exacto pedido, en segundos" },
          question: { type: "string", description: "Solo con clarify: pregunta corta en español" },
          options: { type: "array", items: { type: "string" }, description: "Solo con clarify: respuestas posibles (máx. 8)" },
          reply: { type: "string", description: "Solo con out_of_scope: respuesta amable de 1 frase" },
        },
        required: ["intent"],
      },
    },
  }
}

const OUT_OF_SCOPE_REPLY = "Solo puedo ayudarte a ajustar esta rutina."
const UNRESOLVED_REPLY = "No pude saber a qué ejercicio te refieres. Vuelve a pedirlo nombrando el ejercicio."

function ensureValidTargets(ids: readonly string[] | null | undefined, content: RoutineContent, names: Record<string, string>): string[] {
  const valid = new Set(outlineOf(content, names).map((e) => e.id))
  return [...new Set(ids ?? [])].filter((id) => valid.has(id)).slice(0, MAX_TARGETS)
}

/** Completa o rechaza una intención ya elegida: ítems objetivo y dirección imprescindibles. */
function resolveIntent(params: IntentParams, content: RoutineContent, names: Record<string, string>, canClarify: boolean): RouteDecision {
  const ask = (question: string, options?: string[]): RouteDecision =>
    canClarify ? { kind: "clarify", question, ...(options?.length ? { options: options.slice(0, MAX_OPTIONS) } : {}) } : { kind: "reply", message: UNRESOLVED_REPLY }

  if (INTENTS[params.intent].requiresTargets && params.targetItemIds.length === 0) {
    const exercises = outlineOf(content, names).filter((e) => !e.name.startsWith("Bloque "))
    return ask("¿A qué ejercicio te refieres?", exercises.length <= MAX_OPTIONS ? exercises.map((e) => e.name) : undefined)
  }
  if (params.intent === "adjust_difficulty" && !params.direction) return ask("¿Más difícil o más fácil?", ["Más difícil", "Más fácil"])
  if (params.intent === "adjust_rest" && !params.direction && !params.seconds) return ask("¿Más o menos descanso?", ["Más descanso", "Menos descanso"])
  return { kind: "intent", params }
}

/** Pista de la UI -> decisión, sin llamar al modelo. null si la pista no alcanza (se usa el enrutador). */
export function decisionFromHint(hint: NonNullable<TweakInput["intentHint"]>, content: RoutineContent, names: Record<string, string>, message = ""): RouteDecision | null {
  const params: IntentParams = {
    intent: hint.intent,
    targetItemIds: ensureValidTargets(hint.targetItemIds, content, names),
    avoid: extractAvoidFromMessage(message), // la pista salta al modelo, pero lo dicho en el mensaje igual se respeta
    direction: hint.direction,
    knob: hint.knob,
    seconds: hint.seconds,
  }
  const decision = resolveIntent(params, content, names, false)
  return decision.kind === "intent" ? decision : null
}

export async function routeRequest(args: {
  input: TweakInput
  names: Record<string, string>
  deps: TweakDeps
}): Promise<{ decision: RouteDecision; usage: { input: number; output: number } }> {
  const { input, names, deps } = args
  const content = input.routineContent
  const canClarify = !input.clarification

  const lines = [
    "RUTINA (id | nombre):",
    ...outlineOf(content, names).map((e) => `- ${e.id} | ${e.name}${e.block ? " (en bloque)" : ""}`),
    "",
    "PEDIDO DEL ENTRENADOR:",
    input.message,
  ]
  if (input.clarification) {
    lines.push("", "ACLARACIÓN (ya preguntaste; no vuelvas a preguntar):", `Pregunta: ${input.clarification.question}`, `Respuesta: ${input.clarification.answer}`)
  }

  const completion = await deps.complete({
    messages: [{ role: "system", content: ROUTER_SYSTEM_PROMPT }, { role: "user", content: lines.join("\n") }],
    tools: [routeTool(canClarify)],
    toolChoice: { type: "function", function: { name: ROUTE_TOOL_NAME } },
  })
  const usage = completion.usage

  const call = completion.message.tool_calls?.find((c) => c.type === "function" && c.function.name === ROUTE_TOOL_NAME)
  if (!call || call.type !== "function") throw new Error("El enrutador no devolvió route_request")
  const parsed = routeSchema.safeParse(JSON.parse(call.function.arguments))
  if (!parsed.success) throw new Error(`route_request inválido: ${parsed.error.issues[0]?.message}`)
  const r = parsed.data

  if (r.intent === "out_of_scope") return { decision: { kind: "reply", message: r.reply?.trim() || OUT_OF_SCOPE_REPLY }, usage }

  if (r.intent === "clarify") {
    const question = r.question?.trim()
    if (!canClarify || !question) return { decision: { kind: "reply", message: UNRESOLVED_REPLY }, usage }
    const options = (r.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, MAX_OPTIONS)
    return { decision: { kind: "clarify", question, ...(options.length ? { options } : {}) }, usage }
  }

  const params: IntentParams = {
    intent: r.intent,
    targetItemIds: ensureValidTargets(r.targetItemIds, content, names),
    avoid: normalizeAvoid(r.avoid),
    direction: r.direction ?? undefined,
    knob: r.knob ?? undefined,
    seconds: r.seconds ?? undefined,
  }
  return { decision: resolveIntent(params, content, names, canClarify), usage }
}
