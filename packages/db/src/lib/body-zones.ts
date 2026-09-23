import type { RoutineContent } from "../schema/routines"

// ─── Zonas corporales ──────────────────────────────────────────────────────────
//
// Cada grupo muscular pertenece a una zona base (`muscle_group.body_zone`). La zona
// de un ejercicio no se guarda: se deriva de sus músculos PRIMARIOS. Si todos caen
// en la misma zona, esa es su zona; si caen en más de una, el ejercicio es full body.
//
// El perfil de una rutina (o sesión) reparte sus series entre las cuatro zonas
// (inferior, superior, core, full body). Así una rutina "mayormente pierna con algo
// de full body" se ve roja con una franja morada, y la zona con más series es su
// color dominante. Ver docs/ejercicios-schema.md §10.

export type BaseBodyZone = "upper" | "lower" | "core"
export type BodyZone = BaseBodyZone | "full_body"

export const BODY_ZONES: readonly BodyZone[] = ["lower", "upper", "core", "full_body"]

type MuscleLike = { bodyZone: BaseBodyZone; role: string }

export function deriveBodyZone(muscles: readonly MuscleLike[]): BodyZone | null {
  const zones = new Set(muscles.filter((m) => m.role === "primary").map((m) => m.bodyZone))
  if (zones.size === 0) return null
  if (zones.size === 1) return [...zones][0]
  return "full_body"
}

/**
 * Proporción de músculos primarios por zona base. Para un ejercicio full body dice
 * hacia dónde se carga (p. ej. un thruster: 2/3 inferior, 1/3 superior).
 */
export function primaryZoneMix(muscles: readonly MuscleLike[]): Partial<Record<BaseBodyZone, number>> {
  const primary = muscles.filter((m) => m.role === "primary")
  const mix: Partial<Record<BaseBodyZone, number>> = {}
  for (const m of primary) mix[m.bodyZone] = (mix[m.bodyZone] ?? 0) + 1 / primary.length
  return mix
}

export type ZoneShare = { zone: BodyZone; sets: number; share: number }

export type ZoneProfile = {
  /** Zona con más series: el color principal de la rutina. null si no hay nada clasificable. */
  dominant: BodyZone | null
  /** Solo zonas presentes, de mayor a menor proporción. Las proporciones suman 1. */
  shares: ZoneShare[]
  /** Series que cuentan para el perfil (las de ejercicios sin músculos primarios no cuentan). */
  totalSets: number
}

export const EMPTY_ZONE_PROFILE: ZoneProfile = { dominant: null, shares: [], totalSets: 0 }

/**
 * Suma series por zona. En un circuito cada ronda cuenta: 3 rondas de 2 series
 * son 6 series. `zoneOf` resuelve la zona de cada ejercicio (null = sin clasificar).
 */
export function zoneProfileFromContent(
  content: RoutineContent | null | undefined,
  zoneOf: (exerciseId: string) => BodyZone | null | undefined,
): ZoneProfile {
  const sets: Partial<Record<BodyZone, number>> = {}
  const add = (exerciseId: string, n: number) => {
    const zone = zoneOf(exerciseId)
    if (!zone || n <= 0) return
    sets[zone] = (sets[zone] ?? 0) + n
  }

  for (const item of content?.items ?? []) {
    if (item.type === "exercise") add(item.exerciseId, item.sets.length)
    else for (const ex of item.exercises) add(ex.exerciseId, ex.sets.length * item.rounds)
  }

  return zoneProfileFromCounts(sets)
}

export function zoneProfileFromCounts(counts: Partial<Record<BodyZone, number>>): ZoneProfile {
  const totalSets = BODY_ZONES.reduce((sum, z) => sum + (counts[z] ?? 0), 0)
  if (totalSets === 0) return EMPTY_ZONE_PROFILE

  // Orden estable ante empates: el de BODY_ZONES
  const shares = BODY_ZONES
    .filter((z) => (counts[z] ?? 0) > 0)
    .map((zone) => ({ zone, sets: counts[zone]!, share: counts[zone]! / totalSets }))
    .sort((a, b) => b.sets - a.sets)

  return { dominant: shares[0].zone, shares, totalSets }
}
