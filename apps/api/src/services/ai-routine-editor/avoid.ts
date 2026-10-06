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

export function normalizeAvoid(terms: readonly string[] | undefined | null): string[] {
  return [...new Set((terms ?? []).map(stem).filter((t) => t.length >= 3))].slice(0, 8)
}

/** true si el nombre del ejercicio o de su equipamiento contiene alguno de los términos a evitar. */
export function matchesAvoid(ex: { name: string; equipment?: readonly (string | { equipmentName: string })[] }, avoid: readonly string[]): boolean {
  if (avoid.length === 0) return false
  const haystack = [ex.name, ...(ex.equipment ?? []).map((e) => (typeof e === "string" ? e : e.equipmentName))].map(normalizeText)
  return avoid.some((term) => haystack.some((h) => h.includes(term)))
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
  return normalizeAvoid(terms)
}
