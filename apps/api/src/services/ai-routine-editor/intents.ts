// Intenciones que el enrutador puede elegir. Cada una expone SOLO sus habilidades al modelo de
// ejecución y declara su alcance permitido (lo aplica scope-guard.ts).

import type { Direction, Knob } from "./difficulty"

export const EXEC_INTENTS = ["replace_with_alternative", "add_exercise", "edit_basic", "adjust_difficulty", "adjust_rest"] as const
export type ExecIntent = (typeof EXEC_INTENTS)[number]

export type IntentDef = {
  id: ExecIntent
  label: string
  execution: "deterministic" | "llm"
  /** Ids de habilidades del registro que se exponen al modelo (LLM) o que se ejecutan (determinista). */
  skillIds: string[]
  /** Necesita ítems objetivo identificados; si no hay, el enrutador pide aclaración. */
  requiresTargets: boolean
}

export const INTENTS: Record<ExecIntent, IntentDef> = {
  replace_with_alternative: {
    id: "replace_with_alternative", label: "Reemplazar por una alternativa", execution: "llm", requiresTargets: true,
    skillIds: ["search_exercises", "propose_new_exercise", "replace_exercise"],
  },
  add_exercise: {
    id: "add_exercise", label: "Agregar un ejercicio", execution: "llm", requiresTargets: false,
    skillIds: ["search_exercises", "propose_new_exercise", "add_exercise"],
  },
  edit_basic: {
    id: "edit_basic", label: "Edición puntual (series, campos, bloque, orden, quitar)", execution: "llm", requiresTargets: true,
    skillIds: ["update_sets", "update_item_fields", "update_block", "move_item", "remove_item"],
  },
  adjust_difficulty: { id: "adjust_difficulty", label: "Subir o bajar la dificultad", execution: "deterministic", requiresTargets: false, skillIds: ["adjust_difficulty"] },
  adjust_rest: { id: "adjust_rest", label: "Ajustar descansos", execution: "deterministic", requiresTargets: false, skillIds: ["adjust_rest"] },
}

/** Parámetros de la intención, venidos del enrutador o de una pista de la UI. */
export type IntentParams = {
  intent: ExecIntent
  targetItemIds: string[]
  avoid: string[]
  direction?: Direction
  knob?: Knob
  seconds?: number
}
