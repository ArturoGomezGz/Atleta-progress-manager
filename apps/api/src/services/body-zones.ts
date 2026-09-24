import { db } from "@atleta/db/client"
import { deriveBodyZone, zoneProfileFromContent, type BodyZone, type ZoneProfile } from "@atleta/db/body-zones"
import { exerciseMuscle, muscle, muscleGroup, type RoutineContent } from "@atleta/db/schema"
import { eq, inArray } from "drizzle-orm"

function exerciseIdsOf(content: RoutineContent | null | undefined): string[] {
  return (content?.items ?? []).flatMap((item) =>
    item.type === "exercise" ? [item.exerciseId] : item.exercises.map((e) => e.exerciseId),
  )
}

/** Zona corporal de cada ejercicio (derivada de sus músculos primarios), en una sola consulta. */
export async function exerciseZones(exerciseIds: string[]): Promise<Map<string, BodyZone | null>> {
  const ids = [...new Set(exerciseIds)]
  if (ids.length === 0) return new Map()

  const rows = await db
    .select({ exerciseId: exerciseMuscle.exerciseId, role: exerciseMuscle.role, bodyZone: muscleGroup.bodyZone })
    .from(exerciseMuscle)
    .innerJoin(muscle, eq(exerciseMuscle.muscleId, muscle.id))
    .innerJoin(muscleGroup, eq(muscle.muscleGroupId, muscleGroup.id))
    .where(inArray(exerciseMuscle.exerciseId, ids))

  const byExercise = new Map<string, typeof rows>()
  for (const r of rows) byExercise.set(r.exerciseId, [...(byExercise.get(r.exerciseId) ?? []), r])
  return new Map(ids.map((id) => [id, deriveBodyZone(byExercise.get(id) ?? [])]))
}

/** Perfil por zonas de varias rutinas/sesiones a la vez (una sola consulta de músculos). */
export async function zoneProfiles(contents: (RoutineContent | null | undefined)[]): Promise<ZoneProfile[]> {
  const zones = await exerciseZones(contents.flatMap(exerciseIdsOf))
  return contents.map((c) => zoneProfileFromContent(c, (id) => zones.get(id)))
}

/** Agrega `zoneProfile` a cada fila a partir de su `content`, sin devolver el content. */
export async function withZoneProfiles<T extends { content: RoutineContent | null }>(
  rows: T[],
): Promise<(Omit<T, "content"> & { zoneProfile: ZoneProfile })[]> {
  const profiles = await zoneProfiles(rows.map((r) => r.content))
  return rows.map(({ content: _content, ...rest }, i) => ({ ...rest, zoneProfile: profiles[i] }))
}
