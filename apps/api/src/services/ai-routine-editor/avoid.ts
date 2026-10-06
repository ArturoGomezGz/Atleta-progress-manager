// Exclusiones dichas en el mensaje del tweak ("no tengo paralelas", "sin barra", "nada de saltos").
// No es memoria: aplican solo a las búsquedas de catálogo de ese tweak. Puro (sin DB ni red).

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** Raíz tolerante a plurales: "saltos" -> "salto", "paralelas" -> "paralela". */
function stem(term: string): string {
  const t = normalizeText(term)
  return t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t
}

/** Término especial: el entrenador no tiene NINGÚN equipo (solo peso corporal). Excluye todo ejercicio con equipo. */
export const NO_EQUIPMENT = "equipo"
const NO_EQUIPMENT_TERMS = new Set(["equipo", "equipamiento", "equipos", "nada", "ninguno", "ninguna", "peso corporal", "bodyweight", "sin equipo", "solo peso corporal"])

/** El catálogo está en inglés y el entrenador habla español: cada término se amplía con sus equivalentes. */
const SYNONYMS: Record<string, string[]> = {
  salto: ["jump", "hop", "bound", "plyo", "burpee"],
  barra: ["barbell", "ez bar", "ez-bar", "bar bell"],
  mancuerna: ["dumbbell"],
  maquina: ["machine", "smith", "leg press"],
  polea: ["cable", "pulley"],
  banda: ["band", "resistance"],
  liga: ["band", "resistance"],
  paralela: ["parallel", "dip"],
  pesa: ["kettlebell", "dumbbell"],
  rusa: ["kettlebell"],
  disco: ["plate"],
  balon: ["ball"],
  suspension: ["suspension", "trx", "ring"],
  anilla: ["ring"],
  banco: ["bench"],
  cajon: ["box"],
  cuerda: ["rope"],
}

/** Raíz tolerante a plurales: "saltos" -> "salto", "paralelas" -> "paralela". */
export function expandAvoidTerm(term: string): string[] {
  return [term, ...(SYNONYMS[term] ?? [])]
}

export function normalizeAvoid(terms: readonly string[] | undefined | null): string[] {
  const out = (terms ?? []).map((t) => (NO_EQUIPMENT_TERMS.has(normalizeText(t)) ? NO_EQUIPMENT : stem(t))).filter((t) => t.length >= 3)
  return [...new Set(out)].slice(0, 8)
}

/** Sin equipo, o solo peso corporal. */
export const isBodyweight = (equipment: readonly string[]) => equipment.length === 0 || equipment.every((e) => /peso corporal|bodyweight|body weight|ninguno|none/.test(normalizeText(e)))

/** true si el nombre del ejercicio o de su equipamiento contiene alguno de los términos a evitar. */
export function matchesAvoid(ex: { name: string; equipment?: readonly (string | { equipmentName: string })[] }, avoid: readonly string[]): boolean {
  if (avoid.length === 0) return false
  const equipment = (ex.equipment ?? []).map((e) => (typeof e === "string" ? e : e.equipmentName))
  const haystack = [ex.name, ...equipment].map(normalizeText)
  return avoid.some((term) => (term === NO_EQUIPMENT ? !isBodyweight(equipment) : expandAvoidTerm(term).some((t) => haystack.some((h) => h.includes(t)))))
}

const NEGATION = /(?:\bno\s+(?:tengo|hay|tenemos|cuento\s+con|quiero|uses|usar|uses)|\bsin\b|\bnada\s+de\b|\bevita(?:r|me)?\b|\bnunca\b)\s+((?:(?:el|la|los|las|un|una|unos|unas|de|del|mas|ningun|ninguna)\s+)*[a-z0-9]+(?:(?:\s+(?:ni|o)\s+)(?:(?:el|la|los|las|un|una|unos|unas|de|del)\s+)*[a-z0-9]+){0,3})/g
const FILLER = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "mas", "ningun", "ninguna", "y", "ni", "o", "tener", "ejercicios", "ejercicio", "equipo", "nada", "quiero"])

/**
 * Extrae exclusiones del texto del entrenador sin modelo ("no tengo paralelas", "sin barra ni mancuernas",
 * "nada de saltos"). Se usa cuando una pista de la UI salta al enrutador. Conservador: una palabra por término.
 */
export function extractAvoidFromMessage(message: string): string[] {
  const text = normalizeText(message).replace(/[^a-z0-9,\s]/g, " ")
  const terms: string[] = []
  for (const m of text.matchAll(NEGATION)) {
    for (const word of m[1]!.split(/[\s,]+/)) if (word && !FILLER.has(word)) terms.push(word)
  }
  // "ni nada", "sin equipo", "solo tengo mi peso corporal": no hay equipo de ningún tipo
  if (/\bni nada\b|\bsin (?:ningun )?(?:equipo|equipamiento|nada)\b|\bsolo (?:tengo |con )?(?:mi )?(?:propio )?(?:peso corporal|cuerpo)\b|\bsolo (?:el )?peso corporal\b/.test(text)) terms.push(NO_EQUIPMENT)
  return normalizeAvoid(terms)
}
