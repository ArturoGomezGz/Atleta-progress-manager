// Visibilidad de ejercicios: única fuente del criterio "qué ejercicios puede ver/usar
// un usuario". Lo usan exercises.get, la validación de contenido de rutinas
// (routines.updateContent / create) y la IA de rutinas.
//
// Un ejercicio es visible si es del sistema (sin dueño), público, del propio usuario
// o de uno de los equipos indicados. Los borrados (deletedAt) nunca son visibles.

import { db } from "@atleta/db/client"
import { exercise, teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm"

export type ExerciseVisibilityScope = { userId: string; teamIds: readonly string[] }

/** Condición SQL de visibilidad para `select … from exercise`. */
export function exerciseVisibilityWhere(scope: ExerciseVisibilityScope): SQL {
  return and(
    isNull(exercise.deletedAt),
    or(
      and(isNull(exercise.ownerUserId), isNull(exercise.ownerTeamId)),
      eq(exercise.isPublic, true),
      eq(exercise.ownerUserId, scope.userId),
      ...(scope.teamIds.length > 0 ? [inArray(exercise.ownerTeamId, [...scope.teamIds])] : []),
    ),
  )!
}

/** Criterio en memoria (misma regla que exerciseVisibilityWhere, sin mirar deletedAt). */
export function canViewExercise(
  ex: Pick<typeof exercise.$inferSelect, "isPublic" | "ownerUserId" | "ownerTeamId">,
  scope: ExerciseVisibilityScope,
): boolean {
  if (ex.isPublic) return true
  if (ex.ownerUserId === null && ex.ownerTeamId === null) return true
  if (ex.ownerUserId !== null && ex.ownerUserId === scope.userId) return true
  return ex.ownerTeamId !== null && scope.teamIds.includes(ex.ownerTeamId)
}

/** Equipos a los que pertenece el usuario (cualquier rol). */
export async function memberTeamIds(userId: string): Promise<string[]> {
  const rows = await db.select({ teamId: teamMember.teamId }).from(teamMember).where(eq(teamMember.userId, userId))
  return rows.map((r) => r.teamId)
}

/** Ids de `ids` que NO son visibles (no existen, están borrados o son privados ajenos). */
export async function invisibleExerciseIds(ids: readonly string[], scope: ExerciseVisibilityScope): Promise<string[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const rows = await db
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(inArray(exercise.id, unique), exerciseVisibilityWhere(scope)))
  const visible = new Set(rows.map((r) => r.id))
  return unique.filter((id) => !visible.has(id))
}

/**
 * Exige que todos los ejercicios sean visibles para quien edita una rutina del equipo
 * `teamId`. Además del equipo de la rutina cuentan los demás equipos del usuario: el
 * selector del editor web (exercises.list) ofrece los ejercicios de todos ellos.
 * Falla con BAD_REQUEST sin revelar a quién pertenece el ejercicio.
 */
export async function assertExercisesVisible(ids: readonly string[], ctx: { userId: string; teamId: string }) {
  if (ids.length === 0) return
  const teamIds = [...new Set([ctx.teamId, ...(await memberTeamIds(ctx.userId))])]
  const invalid = await invisibleExerciseIds(ids, { userId: ctx.userId, teamIds })
  if (invalid.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: invalid.length === 1
        ? "La rutina usa un ejercicio que no existe o no está disponible para este equipo"
        : `La rutina usa ${invalid.length} ejercicios que no existen o no están disponibles para este equipo`,
    })
  }
}
