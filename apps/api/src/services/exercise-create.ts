// Alta de un ejercicio en el catálogo privado de un equipo. Solo la usa la herramienta MCP
// `create_exercise` (mcp/tools/catalog.ts): el editor y el generador de rutinas con IA ya no crean
// ejercicios (ver docs/habilidades-ia-rutinas.md). Idempotente por nombre: si ya hay un ejercicio
// visible para el equipo con ese nombre (sin distinguir mayúsculas; comparación literal, sin LIKE)
// lo devuelve en vez de crear otro.

import { db } from "@atleta/db/client"
import { exercise } from "@atleta/db/schema"
import { and } from "drizzle-orm"
import { z } from "zod"
import { equalsIgnoringCase } from "../lib/text-search"
import { levels, patterns } from "./ai-routine-editor/catalog-constants"
import { exerciseVisibilityWhere } from "./exercise-visibility"

export const createExerciseInputSchema = z.object({
  name:              z.string().min(2).max(80).describe("Nombre en español"),
  description:       z.string().max(400).describe("Ejecución en 1-2 frases"),
  difficulty:        z.enum(levels),
  movementPatterns:  z.array(z.enum(patterns)).max(4).describe("Patrones de movimiento (hasta 4)"),
  contraindications: z.string().max(300).nullish().describe("Contraindicaciones, si las hay"),
})

export type CreateExerciseInput = z.infer<typeof createExerciseInputSchema>

export type CreateExerciseResult =
  | { id: string; name: string; existed: boolean }
  | { error: string }

/** Crea (o devuelve, si ya existe uno visible con el mismo nombre) un ejercicio del equipo `teamId`. */
export async function createTeamExercise(raw: unknown, scope: { userId: string; teamId: string }): Promise<CreateExerciseResult> {
  const args = createExerciseInputSchema.parse(raw)
  const name = args.name.trim()
  const visible = exerciseVisibilityWhere({ userId: scope.userId, teamIds: [scope.teamId] })

  const [existing] = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exercise)
    .where(and(visible, equalsIgnoringCase(exercise.name, name)))
    .limit(1)
  if (existing) return { ...existing, existed: true }

  const [inserted] = await db
    .insert(exercise)
    .values({
      name,
      description: args.description,
      difficulty: args.difficulty,
      movementPatterns: args.movementPatterns,
      contraindications: args.contraindications ?? null,
      isPublic: false,
      ownerTeamId: scope.teamId,
      createdBy: scope.userId,
    })
    .onConflictDoNothing()
    .returning({ id: exercise.id, name: exercise.name })

  if (!inserted) return { error: "No se pudo crear (nombre duplicado). Búscalo con search_exercises." }
  return { ...inserted, existed: false }
}
