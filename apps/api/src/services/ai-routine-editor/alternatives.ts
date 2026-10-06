// Recuperación determinista de alternativas para `replace_with_alternative` (habilidad `find_alternatives`).
// Puro: sin DB ni red. El catálogo está en inglés y el usuario/modelo hablan español, así que buscar por
// nombre falla; aquí se compara por metadatos (patrón de movimiento, músculo primario, dificultad, equipo).

import { matchesAvoid, normalizeText } from "./avoid"

export const MAX_ALTERNATIVES = 8
const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const
type Level = keyof typeof LEVEL_RANK

export type AlternativeInfo = {
  id: string
  name: string
  difficulty: Level | null
  patterns: string[]
  primaryMuscles: string[]
  /** Zonas corporales de los músculos primarios ("upper" | "lower" | "core"). */
  bodyZones: string[]
  equipment: string[]
}

export type AlternativeCandidate = Omit<AlternativeInfo, "bodyZones">

const overlap = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x)).length
const isBodyweight = (equipment: readonly string[]) => equipment.length === 0 || equipment.every((e) => /peso corporal|bodyweight|body weight|ninguno|none/.test(normalizeText(e)))

function score(target: AlternativeInfo, c: AlternativeInfo): number {
  let s = 0
  const sharedPatterns = overlap(target.patterns, c.patterns)
  if (sharedPatterns > 0) s += 40
  if (sharedPatterns > 0 && target.patterns[0] && target.patterns[0] === c.patterns[0]) s += 5
  if (overlap(target.primaryMuscles, c.primaryMuscles) > 0) s += 30
  if (overlap(target.bodyZones, c.bodyZones) > 0) s += 10
  // Dificultad: la más cercana a la del objetivo (nunca por encima, eso se filtra antes)
  if (target.difficulty && c.difficulty) s += 10 - 5 * Math.abs(LEVEL_RANK[target.difficulty] - LEVEL_RANK[c.difficulty])
  // Equipo parecido: mismo equipo, o ambos de peso corporal
  const te = target.equipment.map(normalizeText), ce = c.equipment.map(normalizeText)
  if (isBodyweight(target.equipment) && isBodyweight(c.equipment)) s += 8
  else if (overlap(te, ce) > 0) s += 8
  return s
}

/**
 * Elige y ordena las alternativas a `target` dentro de `pool`: excluye ejercicios ya en la rutina (por id o
 * nombre), los evitados, los más difíciles que el original y los que no comparten patrón ni músculo primario.
 */
export function rankAlternatives(
  target: AlternativeInfo,
  pool: readonly AlternativeInfo[],
  opts: { excludeIds?: ReadonlySet<string>; excludeNames?: readonly string[]; avoid?: readonly string[]; limit?: number } = {},
): AlternativeCandidate[] {
  const names = new Set((opts.excludeNames ?? []).map(normalizeText))
  const ranked = pool
    .filter((c) => c.id !== target.id && !opts.excludeIds?.has(c.id) && !names.has(normalizeText(c.name)))
    .filter((c) => !matchesAvoid({ name: c.name, equipment: c.equipment }, opts.avoid ?? []))
    .filter((c) => !target.difficulty || !c.difficulty || LEVEL_RANK[c.difficulty] <= LEVEL_RANK[target.difficulty])
    .filter((c) => overlap(target.patterns, c.patterns) > 0 || overlap(target.primaryMuscles, c.primaryMuscles) > 0)
    .map((c) => ({ c, s: score(target, c) }))
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name) || a.c.id.localeCompare(b.c.id))
  return ranked.slice(0, opts.limit ?? MAX_ALTERNATIVES).map(({ c }) => ({
    id: c.id, name: c.name, difficulty: c.difficulty, patterns: c.patterns, primaryMuscles: c.primaryMuscles, equipment: c.equipment,
  }))
}
