// Habilidades compuestas: intenciones de más alto nivel construidas sobre las atómicas.
// adjust_difficulty y adjust_rest son deterministas (cero LLM para la edición). replace_with_alternative
// la dirige un LLM con las habilidades atómicas de `composedOf`; no tiene `run`: la ejecuta el agente del editor.

import { z } from "zod"
import { RoutineEditError } from "../ai-routine-edits"
import { expandTargets, KNOB_LABEL, planDifficulty, restOps, REST_MAX, REST_MIN, type Knob } from "./difficulty"
import { defineSkill, type AnySkill, type SkillRuntime } from "./types"

const FLAG = "ai_routine_tweaks"
const REVIEWED = "2026-10-06"

const idList = z.array(z.string().uuid()).max(10).nullish()

/** Aplica operaciones una a una; una operación imposible se omite en vez de abortar el resto. */
function applyAll(ops: Parameters<SkillRuntime["apply"]>[0][], rt: SkillRuntime): number {
  let applied = 0
  for (const op of ops) {
    try {
      rt.apply(op)
      applied++
    } catch (err) {
      if (!(err instanceof RoutineEditError)) throw err
    }
  }
  return applied
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const adjustDifficultySkill = defineSkill({
  id: "adjust_difficulty",
  name: "Subir o bajar la dificultad",
  description: "Hace la rutina (o los ítems indicados) un poco más difícil o más fácil moviendo UNA sola palanca en pasos pequeños: intensidad (RPE ±1, % RM ±5), volumen (±1 serie o ronda) o descanso (±15 s).",
  category: "compound", execution: "deterministic", scope: "draft", status: "limited", risk: "low", mcp: "yes", flag: FLAG, reviewedAt: REVIEWED,
  notes: "Sin palanca explícita elige la primera con margen: intensidad, volumen, descanso. Nunca agrega, quita ni reemplaza ejercicios ni inventa pesos (`fixed_kg` no se toca). Límites: RPE 5–9 (máx. 2 ejercicios en RPE ≥ 9), % RM 40–95, series 2–6, rondas 2–8, descanso 15–600 s.",
  inputSchema: z.object({
    direction:     z.enum(["up", "down"]),
    knob:          z.enum(["volume", "intensity", "rest"]).nullish(),
    targetItemIds: idList,
  }),
  parameters: {
    type: "object",
    properties: {
      direction: { type: "string", enum: ["up", "down"], description: "up = más difícil, down = más fácil" },
      knob: { type: "string", enum: ["volume", "intensity", "rest"] },
      targetItemIds: { type: "array", items: { type: "string" }, description: "Omitir para toda la rutina" },
    },
    required: ["direction"],
  },
  run(input, rt) {
    const { knob, ops } = planDifficulty(rt.getContent(), { direction: input.direction, knob: input.knob as Knob | null | undefined, targetIds: input.targetItemIds ?? undefined })
    const n = applyAll(ops, rt)
    if (n === 0) {
      return { result: { ok: false }, message: `No encontré margen para hacerla ${input.direction === "up" ? "más difícil" : "más fácil"} sin salirme de los límites seguros.`, meta: { knob } }
    }
    const verb = knob === "rest" ? (input.direction === "up" ? "Reduje" : "Aumenté") : input.direction === "up" ? "Subí" : "Bajé"
    return { result: { ok: true, knob, changed: n }, message: `${verb} ${KNOB_LABEL[knob!]} en ${plural(n, "ítem", "ítems")}.`, meta: { knob } }
  },
})

export const adjustRestSkill = defineSkill({
  id: "adjust_rest",
  name: "Ajustar descansos",
  description: "Sube o baja en 15 s los descansos existentes, o los fija en un valor exacto (p. ej. \"baja el descanso del press a 90 s\"), en toda la rutina o en los ítems indicados.",
  category: "compound", execution: "deterministic", scope: "draft", status: "limited", risk: "low", mcp: "yes", flag: FLAG, reviewedAt: REVIEWED,
  notes: "Con `seconds` fija el descanso de los ejercicios indicados (y de bloques ya con descanso entre rondas); con dirección solo mueve descansos que ya existen. Rango 15–600 s.",
  inputSchema: z.object({
    direction:     z.enum(["up", "down"]).nullish(),
    seconds:       z.number().int().min(REST_MIN).max(REST_MAX).nullish(),
    targetItemIds: idList,
  }).refine((v) => v.direction || v.seconds, "Indica dirección o segundos"),
  parameters: {
    type: "object",
    properties: {
      direction: { type: "string", enum: ["up", "down"], description: "up = más descanso, down = menos" },
      seconds: { type: "integer", description: "Valor exacto en segundos" },
      targetItemIds: { type: "array", items: { type: "string" } },
    },
  },
  run(input, rt) {
    const content = rt.getContent()
    const scope = expandTargets(content, input.targetItemIds ?? undefined)
    const ops = restOps(content, { more: input.direction === "up", scope, absolute: input.seconds ?? undefined })
    const n = applyAll(ops, rt)
    if (n === 0) return { result: { ok: false }, message: "No encontré descansos que ajustar." }
    const what = input.seconds ? `Dejé el descanso en ${input.seconds} s` : input.direction === "up" ? "Aumenté el descanso (hasta 15 s)" : "Reduje el descanso (hasta 15 s)"
    return { result: { ok: true, changed: n }, message: `${what} en ${plural(n, "ítem", "ítems")}.` }
  },
})

export const replaceWithAlternativeSkill = defineSkill({
  id: "replace_with_alternative",
  name: "Reemplazar por una alternativa",
  description: "Sustituye un ejercicio por otro del mismo patrón de movimiento y rol (\"sustitúyelo por algo más\", \"no tengo paralelas\"): busca en el catálogo respetando las exclusiones del mensaje y reemplaza conservando series, descanso y tempo.",
  category: "compound", execution: "llm", scope: "draft", status: "limited", risk: "medium", mcp: "no", flag: FLAG, reviewedAt: REVIEWED,
  composedOf: ["find_alternatives", "search_exercises", "replace_exercise"],
  notes: "Elegir la alternativa requiere criterio, así que la dirige un LLM del agente del editor (no va dentro de un MCP: un cliente MCP usa las atómicas). Solo puede producir un reemplazo (o ajuste de series/campos) sobre los ítems objetivo.",
  inputSchema: z.object({ itemId: z.string().uuid(), avoid: z.array(z.string().max(60)).max(8).nullish() }),
  parameters: {
    type: "object",
    properties: {
      itemId: { type: "string", description: "id del ejercicio a sustituir" },
      avoid: { type: "array", items: { type: "string" }, description: "Equipo o ejercicios a evitar" },
    },
    required: ["itemId"],
  },
})

export const COMPOUND_SKILLS: AnySkill[] = [adjustDifficultySkill, adjustRestSkill, replaceWithAlternativeSkill]
