// Restricciones que el entrenador dice con palabras y el catálogo (en inglés) no expone como datos:
// "más fácil", molestias ("me duele la rodilla") y la naturaleza de un ejercicio (isométrico, salto).
// Todo determinista y sobre nombres de ejercicio; puro (sin DB ni red).

import { normalizeText } from "./avoid"

/** "Más fácil / menos exigente": el reemplazo debe ser estrictamente menos difícil. */
export function messageWantsEasier(message: string): boolean {
  return /\bm[aá]s (?:f[aá]cil(?:es)?|sencill\w+|suave|ligero|ligera)\b|\bmenos (?:dif[ií]cil|exigente|intens\w+|duro)\b|\bregres\w+|\bprincipiante\b/i.test(message)
}

export type Injury = "knee" | "lowback" | "shoulder" | "wrist" | "elbow" | "ankle"

const INJURY_WORDS: Record<Injury, string> = {
  knee: "rodill\\w*",
  lowback: "lumbar\\w*|espalda baja|zona baja|columna",
  shoulder: "hombros?",
  wrist: "mu[ñn]ecas?",
  elbow: "codos?",
  ankle: "tobillos?",
}

/** Molestias dichas en el mensaje: "me duele la rodilla", "tengo lesión de hombro", "dolor lumbar". */
export function detectInjuries(message: string): Injury[] {
  const text = message.toLowerCase()
  if (!/\bdue?len?\b|\bdolor\w*|\bmolest\w*|\bles[ií]on\w*|\blesionad\w*|\bdañad\w*|\bproblemas? (?:de|en|con)\b|\binflamad\w*|\bsobrecarg\w*|\btendinitis\b/.test(text)) return []
  return (Object.keys(INJURY_WORDS) as Injury[]).filter((k) => new RegExp(`\\b(?:${INJURY_WORDS[k]})`).test(text))
}

/** Nombres (en inglés) de ejercicios que cargan la zona dañada. Conservador: preferimos no ofrecer algo dudoso. */
const INJURY_NAME_RULES: Record<Injury, RegExp> = {
  knee: /pistol|jump|plyo|hop\b|box\b|burpee|lunge|bulgarian|split squat|step.?up|sissy|deep|cossack|leg extension|\bhold\b/i,
  lowback: /deadlift|good.?morning|bent.?over|snatch|clean\b|hyperextension|jefferson|swing|back extension|barbell row|pendlay/i,
  shoulder: /overhead|military|snatch|jerk|upright|behind|arnold|\bdips?\b|handstand|pike|push press|lateral raise/i,
  wrist: /push.?ups?|handstand|front squat|wrist|plank|burpee|clean\b/i,
  elbow: /skull|tate|french|\bdips?\b|close.?grip|pushdown|extension|chin|pull.?up/i,
  ankle: /jump|hop\b|plyo|box\b|burpee|calf|skip|sprint|run\b/i,
}

export function violatesInjury(ex: { name: string }, injuries: readonly Injury[]): boolean {
  return injuries.some((k) => INJURY_NAME_RULES[k].test(ex.name))
}

export type Nature = "dynamic" | "isometric" | "plyometric"

/** Naturaleza del ejercicio según nombre y patrón: un hold o un salto no sustituye a un movimiento dinámico. */
export function natureOf(ex: { name: string; patterns?: readonly string[] }): Nature {
  const n = normalizeText(ex.name)
  if (/\bhold\b|isometric|\bstatic\b|\bwall sit\b/.test(n)) return "isometric"
  if (/\bjump|\bhop\b|\bbound|plyo|burpee|\bclap|\bskip/.test(n)) return "plyometric"
  return "dynamic"
}

const FAMILIES: [string, RegExp][] = [
  ["row", /\brow\b|\brows\b/], ["pullover", /pullover/], ["squat", /squat/], ["deadlift", /deadlift|good morning/],
  ["bench", /bench|chest press|floor press/], ["overhead", /overhead|shoulder press|military|arnold/], ["dip", /\bdips?\b/],
  ["pushup", /push.?ups?/], ["pullup", /pull.?ups?|chin.?ups?|lat pulldown|pulldown/], ["curl", /\bcurls?\b/],
  ["lunge", /lunge|split squat|step.?up/], ["thrust", /hip thrust|glute bridge|bridge/], ["raise", /\braises?\b/], ["fly", /\bfly\b|\bflyes?\b|pec deck/],
  ["triceps", /pushdown|skull|tate|french|kickback|triceps extension/], ["plank", /plank|hollow|dead bug|crunch|sit.?up/],
]

/** Familia de ejercicio por nombre (en inglés): sirve para que un remo se sustituya por otro remo, no por un pullover. */
export function familyOf(name: string): string | null {
  const n = normalizeText(name)
  return FAMILIES.find(([, re]) => re.test(n))?.[0] ?? null
}
