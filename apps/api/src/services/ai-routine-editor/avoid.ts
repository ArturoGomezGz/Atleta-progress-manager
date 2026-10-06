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
