// Pedidos compuestos: un tweak es UNA tarea, así que lo demás se declara en el mensaje final ("No hice: …").
// El `leftover` lo propone el modelo del enrutador, que a veces lo inventa en pedidos simples o lo omite en
// los compuestos. Esta capa lo verifica con reglas deterministas sobre el texto del entrenador.

import type { ExecIntent } from "./intents"

type Kind = "replace" | "add" | "difficulty" | "rest" | "edit"

const KIND_OF_INTENT: Record<ExecIntent, Kind> = {
  replace_with_alternative: "replace",
  add_exercise: "add",
  adjust_difficulty: "difficulty",
  adjust_rest: "rest",
  edit_basic: "edit",
}

/** Separadores de peticiones dentro de un mismo mensaje. */
const SPLIT = /\s+(?:y|e|adem[aá]s|tambi[eé]n|luego|despu[eé]s|pero)\s+|\s*[,;]\s*|\s+de paso\s+/i
/** El mensaje trae más de una petición (separador entre dos fragmentos con contenido). */
export function looksCompound(message: string): boolean {
  return splitClauses(message).length > 1
}

export function splitClauses(message: string): string[] {
  return message.split(SPLIT).map((c) => c.trim()).filter((c) => c.split(/\s+/).length >= 2)
}

function kindOfClause(clause: string): Kind | null {
  const c = clause.toLowerCase()
  const hasNumber = /\d/.test(c)
  if (/\bdescansos?\b/.test(c)) return "rest"
  if (!/\bpor\b|\botr[oa]s?\b|\balternativ/.test(c) && /\bm[aá]s (dif[ií]cil|f[aá]cil|intens\w*|duro|ligero|pesad\w*)|\b(sub[eií]\w*|baj\w*|aument\w*|reduc\w*|incremen\w*|dismin\w*) (todos? )?(los |las |el |la )?(pesos?|cargas?|intensidad|volumen|series)/.test(c)) return "difficulty"
  if (/\b(series?|rondas?|repeticiones)\b/.test(c) && !/\bejercicios?\b/.test(c) && /\b(agrega\w*|a[ñn]ade\w*|quita\w*|pon\w*|suma\w*)\b/.test(c)) return "edit"
  if (/\b(agrega\w*|a[ñn]ade\w*|incluye\w*|suma\w*|pon\w*)\b.*\bejercicios?\b|\b(agrega\w*|a[ñn]ade\w*|incluye\w*)\b/.test(c)) return "add"
  if (/\b(series?|repeticiones|reps|rondas|tempo|notas?|quita\w*|elimina\w*|borra\w*|mueve\w*|sube\w* el \w+ a)\b/.test(c) || (/\b(cambi\w*|pon\w*)\b/.test(c) && hasNumber)) return "edit"
  if (/\b(cambi\w*|sustitu\w*|reemplaz\w*|remplaz\w*|intercambi\w*)\b/.test(c) && !hasNumber) return "replace"
  return null
}

/** Primera petición del mensaje que NO corresponde a la intención elegida (o undefined si no hay). */
export function detectUnhandledRequest(message: string, intent: ExecIntent): string | undefined {
  const own = KIND_OF_INTENT[intent]
  for (const clause of splitClauses(message)) {
    const kind = kindOfClause(clause)
    if (kind && kind !== own) return clause.slice(0, 100)
  }
  return undefined
}

const clean = (s: string) => s.trim().replace(/[.\s]+$/, "").replace(/^(de paso|solo|solamente)\s+/i, "")

/**
 * Lo que NO se hizo. El del modelo solo se acepta si el mensaje es realmente compuesto (si no, es un invento
 * que contradice lo que sí se hizo); si el modelo no dijo nada, se deduce del texto.
 */
export function resolveLeftover(message: string, intent: ExecIntent, modelLeftover?: string): string | undefined {
  const fromModel = modelLeftover ? clean(modelLeftover) : ""
  if (fromModel && looksCompound(message)) return fromModel
  const detected = detectUnhandledRequest(message, intent)
  return detected ? clean(detected) : undefined
}
