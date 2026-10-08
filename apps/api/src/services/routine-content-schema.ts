// Esquemas zod de RoutineContent (módulo puro, sin acceso a la base de datos).
// Compartido por el router de rutinas y por la capa de ediciones con IA.
import type { RoutineContent, RoutineExerciseContent, RoutineItemBlock, RoutineItemExercise, RoutineSet } from "@atleta/db/schema"
import { z } from "zod"

export const routineSetSchema = z.object({
  setNumber: z.number().int().min(1),
  setType:   z.enum(["reps", "time", "distance", "amrap"]),
  targetReps:            z.number().int().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  targetDistanceMeters:  z.number().int().positive().optional(),
  loadType:  z.enum(["fixed_kg", "percent_rm", "rpe"]).optional(),
  loadValue: z.number().positive().optional(),
}) satisfies z.ZodType<RoutineSet>

export const exerciseContentSchema = z.object({
  id:          z.string().uuid(),
  exerciseId:  z.string().uuid(),
  order:       z.number().int().min(0),
  tempo:       z.string().optional(),
  restSeconds: z.number().int().positive().optional(),
  goal:        z.enum(["strength","hypertrophy","endurance","power","cardio","recovery"]).optional(),
  notes:       z.string().optional(),
  perSide:     z.boolean().optional(),
  sets:        z.array(routineSetSchema).min(1),
}) satisfies z.ZodType<RoutineExerciseContent>

export const routineItemSchema = z.discriminatedUnion("type", [
  exerciseContentSchema.extend({ type: z.literal("exercise") }) satisfies z.ZodType<RoutineItemExercise>,
  z.object({
    type:      z.literal("block"),
    id:        z.string().uuid(),
    order:     z.number().int().min(0),
    name:      z.string().optional(),
    rounds:    z.number().int().min(2),
    restBetweenRoundsSeconds: z.number().int().positive().optional(),
    exercises: z.array(exerciseContentSchema).min(1),
  }) satisfies z.ZodType<RoutineItemBlock>,
])

export const routineContentSchema = z.object({
  v:     z.literal(1),
  items: z.array(routineItemSchema),
}) satisfies z.ZodType<RoutineContent>
