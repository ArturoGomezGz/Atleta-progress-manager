// Tipo fijo de un entrenamiento (calentamiento, principal, recuperación) y su orden por defecto
// dentro del día. Las evaluaciones no tienen tipo y no participan en secuencias.

import { routineKindEnum, type RoutineKind } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

export const ROUTINE_KINDS = routineKindEnum.enumValues
export type { RoutineKind }

export const routineKindSchema = z.enum(ROUTINE_KINDS)

/** Orden por defecto dentro del día: calentamiento antes del principal, y este antes de la recuperación. */
export const DEFAULT_KIND_POSITION: Readonly<Record<RoutineKind, number>> = { warmup: 0, main: 1, recovery: 2 }

export const DEFAULT_ROUTINE_KIND: RoutineKind = "main"

export const defaultPositionForKind = (kind: RoutineKind | null | undefined): number =>
  kind ? DEFAULT_KIND_POSITION[kind] : 0

/**
 * Regla de la rutina: evaluation → kind null (un kind explícito es un error);
 * training → kind obligatorio, "main" si no se indica. `current` es el valor guardado (al editar).
 */
export function resolveRoutineKind(
  category: "evaluation" | "training",
  requested: RoutineKind | undefined,
  current: RoutineKind | null = null,
): RoutineKind | null {
  if (category === "evaluation") {
    if (requested !== undefined) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Las evaluaciones no tienen tipo (calentamiento, principal o recuperación)" })
    }
    return null
  }
  return requested ?? current ?? DEFAULT_ROUTINE_KIND
}

/** Hora sugerida "HH:MM" (solo informativa). */
export const scheduledTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM (24 h)")

/** Postgres devuelve `time` como "HH:MM:SS": el contrato de la API usa "HH:MM". */
export const toHHMM = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null)
