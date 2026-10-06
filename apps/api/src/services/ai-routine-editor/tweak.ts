// AI Routine Editor: un tweak = UNA tarea, sin conversación y sin estado en el servidor.
//   1. Enrutador: clasifica el pedido (o usa la pista de la UI) -> intención + ítems objetivo + `avoid`,
//      o devuelve UNA pregunta de aclaración (nunca dos).
//   2. Ejecución: determinista (adjust_difficulty, adjust_rest) o dirigida por LLM con solo las
//      herramientas de esa intención.
//   3. Guardián de alcance: descarta todo cambio fuera de lo que la intención permite.
// No guarda nada en la rutina: devuelve una propuesta que el entrenador acepta o rechaza.
// Puro respecto a DB/OpenAI: todo el acceso real entra por `deps`. Ver docs/habilidades-ia-rutinas.md.

import { TRPCError } from "@trpc/server"
import type { FastifyBaseLogger } from "fastify"
import { routineContentSchema } from "../routine-content-schema"
import { runAgent } from "./agent"
import type { TweakDeps } from "./deps"
import { tweakInputSchema, type TweakInput, type TweakResult } from "./input"
import { INTENTS, type IntentParams } from "./intents"
import { decisionFromHint, routeRequest, type RouteDecision } from "./router"
import { exerciseIdsOf } from "./routine-view"
import { createRuntime } from "./runtime"
import { guardChanges, type Dropped } from "./scope-guard"
import { getSkill } from "./skills"
import type { RoutineChange } from "../ai-routine-edits"
import type { RoutineContent } from "@atleta/db/schema"

const MAX_MESSAGE_CHARS = 600

/** El entrenador dio pesos en kg/lb en su mensaje: solo entonces se admite fixed_kg. */
export function messageMentionsWeights(message: string): boolean {
  return /\d\s*(kg|kilos?|lbs?|libras?)\b/i.test(message)
}

/** Mensaje final: describe SOLO lo que quedó aplicado (nunca lo que el modelo dijo haber hecho). */
export function buildFinalMessage(args: { changes: RoutineChange[]; skillMessage?: string; agentMessage?: string; dropped: number; hadErrors: boolean }): string {
  const { changes, skillMessage, agentMessage, dropped, hadErrors } = args
  let text: string
  if (changes.length === 0) {
    text = dropped > 0
      ? "No apliqué cambios: la IA intentó modificar cosas que no pediste."
      : skillMessage ?? (hadErrors || !agentMessage ? "No pude aplicar el cambio. Intenta reformularlo." : agentMessage)
  } else if (skillMessage && dropped === 0) {
    text = skillMessage
  } else {
    text = changes.length <= 3 ? changes.map((c) => c.summary).join(". ") + "." : `Apliqué ${changes.length} cambios.`
  }
  return text.slice(0, MAX_MESSAGE_CHARS)
}

const noChanges = (content: RoutineContent, message: string): TweakResult => ({ status: "done", message, proposedContent: content, changes: [], createdExercises: [] })

export async function tweakRoutineWithAI(rawInput: TweakInput, userId: string, log: FastifyBaseLogger, deps: TweakDeps): Promise<TweakResult> {
  const input = tweakInputSchema.parse(rawInput)
  const original = input.routineContent
  const names: Record<string, string> = await deps.getExerciseNames(exerciseIdsOf(original))
  const usage = { input: 0, output: 0 }

  // 1. Intención
  let decision: RouteDecision | null = input.intentHint ? decisionFromHint(input.intentHint, original, names, `${input.message} ${input.clarification?.answer ?? ""}`) : null
  const source: "hint" | "router" = decision ? "hint" : "router"
  if (!decision) {
    try {
      const routed = await routeRequest({ input, names, deps })
      decision = routed.decision
      usage.input += routed.usage.input
      usage.output += routed.usage.output
    } catch (err) {
      log.warn({ teamId: input.teamId, userId, err: err instanceof Error ? err.message : String(err) }, "[ai-routines] tweak sin intención")
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La IA no logró procesar el ajuste. Intenta reformular el pedido." })
    }
  }

  if (decision.kind === "clarify") {
    log.info({ teamId: input.teamId, userId, status: "needs_info", source, tokens: usage }, "[ai-routines] tweak aclaración")
    return { status: "needs_info", question: decision.question, ...(decision.options ? { options: decision.options } : {}) }
  }
  if (decision.kind === "reply") {
    log.info({ teamId: input.teamId, userId, status: "out_of_scope", source, tokens: usage }, "[ai-routines] tweak sin cambios")
    return noChanges(original, decision.message)
  }

  // 2. Ejecución
  const params: IntentParams = decision.params
  const intent = INTENTS[params.intent]
  const rt = createRuntime({
    original, names, avoid: params.avoid, userId, teamId: input.teamId, deps,
    allowFixedKg: messageMentionsWeights(`${input.message} ${input.clarification?.answer ?? ""}`),
  })

  let skillMessage: string | undefined
  let agentMessage: string | undefined
  let hadErrors = false
  let turns = 0
  let knob: IntentParams["knob"] | null = params.knob

  if (intent.execution === "deterministic") {
    const skill = getSkill(intent.skillIds[0]!)!
    const skillInput = skill.inputSchema!.parse({ direction: params.direction, knob: params.knob, seconds: params.seconds, targetItemIds: params.targetItemIds })
    const out = await skill.run!(skillInput, rt)
    skillMessage = out.message
    knob = (out.meta?.knob as typeof knob) ?? knob
  } else {
    const outcome = await runAgent({ params, input, names, rt, deps, log })
    usage.input += outcome.usage.input
    usage.output += outcome.usage.output
    agentMessage = outcome.message
    hadErrors = outcome.hadErrors
    turns = outcome.turns
    if (!outcome.finished && rt.applied.length === 0) {
      log.warn({ teamId: input.teamId, userId, intent: params.intent, tokens: usage, created: rt.ctx.created.length }, "[ai-routines] tweak sin resultado")
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La IA no logró procesar el ajuste. Intenta reformular el pedido." })
    }
  }

  // 3. Guardián de alcance
  const guarded = guardChanges({ intent: params.intent, targetItemIds: params.targetItemIds, knob, original }, rt.applied, rt.working(), rt.editOptions())
  const dropped: Dropped[] = guarded.dropped
  if (dropped.length) log.warn({ teamId: input.teamId, userId, intent: params.intent, dropped }, "[ai-routines] tweak cambios fuera de alcance descartados")

  const proposedContent = routineContentSchema.parse(guarded.content) as RoutineContent
  const message = buildFinalMessage({ changes: guarded.changes, skillMessage, agentMessage, dropped: dropped.length, hadErrors })
  log.info({
    teamId: input.teamId, userId, intent: params.intent, source, turns, tokens: usage,
    edits: guarded.changes.length, dropped: dropped.length, created: rt.ctx.created.length,
  }, "[ai-routines] tweak éxito")
  return { status: "done", message, proposedContent, changes: guarded.changes, createdExercises: rt.ctx.created }
}
