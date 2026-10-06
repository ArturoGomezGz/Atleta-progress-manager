// Ejecución dirigida por LLM de una intención: el modelo solo ve las herramientas de ESA intención
// (no las 12), con un prompt corto. Los resultados de las herramientas son compactos (nunca devuelven
// la rutina completa). El bucle termina cuando el cambio pedido ya está aplicado, sin pedir otro turno.

import type { RoutineContent } from "@atleta/db/schema"
import type OpenAI from "openai"
import { z } from "zod"
import { RoutineEditError } from "../ai-routine-edits"
import type { FindAlternativesMeta } from "./skills-basic"
import { skillsToTools, finishTool, FINISH_TOOL_NAME } from "./adapters/openai"
import type { TweakDeps } from "./deps"
import { INTENTS, type IntentParams } from "./intents"
import type { TweakInput } from "./input"
import { executionSystemPrompt } from "./prompts"
import { describeItemsForModel, describeRoutineForModel } from "./routine-view"
import type { TweakRuntime } from "./runtime"
import { getSkill } from "./skills"

export const AGENT_MAX_TURNS = 6
const MAX_REPLY_CHARS = 600

export function buildExecutionPrompt(params: IntentParams, input: TweakInput, content: RoutineContent, names: Record<string, string>, alternatives: Record<string, FindAlternativesMeta> = {}): string {
  const lines: string[] = []
  if (params.intent === "replace_with_alternative") {
    lines.push("EJERCICIO(S) A REEMPLAZAR (json; usa estos ids):", JSON.stringify(describeItemsForModel(content, params.targetItemIds, names)))
    const targets = new Set(params.targetItemIds)
    const others = content.items.flatMap((it) => (it.type === "exercise" ? [it] : it.exercises)).filter((e) => !targets.has(e.id)).map((e) => names[e.exerciseId] ?? "?")
    if (others.length) lines.push("", `Otros ejercicios de la rutina (no repitas): ${others.join(", ")}`)
    for (const id of params.targetItemIds) {
      const alt = alternatives[id]
      if (!alt?.candidates.length) continue
      const t = alt.target
      lines.push("", `CANDIDATOS para ${id}${t ? ` (original: patrón ${t.patterns.join("/") || "?"}, músculos ${t.primaryMuscles.join("/") || "?"}, dificultad ${t.difficulty ?? "?"})` : ""}, del mejor al peor (json):`,
        JSON.stringify(alt.candidates.map((c) => ({ id: c.id, name: c.name, pattern: c.patterns, muscles: c.primaryMuscles, equipment: c.equipment, difficulty: c.difficulty }))))
    }
  } else {
    lines.push("RUTINA ACTUAL (json; usa estos ids):", JSON.stringify(describeRoutineForModel(content, names)))
    if (params.targetItemIds.length) lines.push("", `ÍTEMS OBJETIVO: ${params.targetItemIds.join(", ")}`)
  }
  if (params.avoid.length) lines.push("", `EVITAR (el entrenador no lo tiene o no lo quiere): ${params.avoid.join(", ")}`)
  lines.push("", "PEDIDO DEL ENTRENADOR:", input.message)
  if (input.clarification) lines.push("", `ACLARACIÓN: ${input.clarification.question} -> ${input.clarification.answer}`)
  return lines.join("\n")
}

/** ¿Ya se aplicó lo que la intención pedía? Si sí, no hace falta otro turno del modelo. */
function isComplete(params: IntentParams, rt: TweakRuntime): boolean {
  if (rt.applied.length === 0) return false
  if (params.intent === "add_exercise") return true
  const touched = new Set(rt.applied.map((a) => a.change.itemId))
  return params.targetItemIds.every((id) => touched.has(id))
}

export type AgentOutcome = {
  /** Mensaje de cierre del modelo (propose_edits), si lo hubo. */
  message?: string
  turns: number
  usage: { input: number; output: number }
  /** Alguna herramienta falló durante la ejecución. */
  hadErrors: boolean
  finished: boolean
}

export async function runAgent(args: { params: IntentParams; input: TweakInput; names: Record<string, string>; rt: TweakRuntime; deps: TweakDeps; log: { info(o: object, m: string): void }; alternatives?: Record<string, FindAlternativesMeta> }): Promise<AgentOutcome> {
  const { params, input, names, rt, deps, log } = args
  const intent = INTENTS[params.intent]
  const exposed = new Set(intent.skillIds)
  const tools = [...skillsToTools(intent.skillIds), finishTool]
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: executionSystemPrompt(params.intent) },
    { role: "user", content: buildExecutionPrompt(params, input, rt.getContent(), names, args.alternatives) },
  ]

  const usage = { input: 0, output: 0 }
  let hadErrors = false
  let message: string | undefined

  for (let turn = 1; turn <= AGENT_MAX_TURNS; turn++) {
    const completion = await deps.complete({ messages, tools, toolChoice: "required" })
    usage.input += completion.usage.input
    usage.output += completion.usage.output
    const reply = completion.message
    if (!reply.tool_calls?.length) { hadErrors = true; return { message, turns: turn, usage, hadErrors, finished: false } }
    messages.push(reply)

    const turnLog: { tool: string; error?: string }[] = []
    for (const call of reply.tool_calls) {
      if (call.type !== "function") continue
      const name = call.function.name
      let result: unknown
      try {
        const rawArgs = JSON.parse(call.function.arguments)
        if (name === FINISH_TOOL_NAME) {
          message = z.object({ message: z.string().trim().min(1) }).parse(rawArgs).message.slice(0, MAX_REPLY_CHARS)
          result = { ok: true }
        } else if (exposed.has(name)) {
          const skill = getSkill(name)!
          const out = await skill.run!(skill.inputSchema!.parse(rawArgs), rt)
          result = out.result
        } else {
          throw new RoutineEditError(`Herramienta no disponible para este ajuste: ${name}`)
        }
        turnLog.push({ tool: name })
      } catch (err) {
        const text = err instanceof RoutineEditError ? err.message : err instanceof z.ZodError ? err.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Argumentos inválidos"
        result = { error: text }
        turnLog.push({ tool: name, error: text })
        hadErrors = true
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) })
    }
    log.info({ teamId: input.teamId, intent: params.intent, turn, calls: turnLog }, "[ai-routines] tweak turno")

    if (message || isComplete(params, rt)) return { message, turns: turn, usage, hadErrors, finished: true }
  }
  return { message, turns: AGENT_MAX_TURNS, usage, hadErrors, finished: false }
}
