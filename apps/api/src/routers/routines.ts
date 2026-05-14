import { db } from "@atleta/db/client"
import { exercise, routine, type RoutineContent, type RoutineExerciseContent, type RoutineItemBlock, type RoutineItemExercise, type RoutineSet } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const routineSetSchema = z.object({
  setNumber: z.number().int().min(1),
  setType:   z.enum(["reps", "time", "distance", "amrap"]),
  targetReps:            z.number().int().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  targetDistanceMeters:  z.number().int().positive().optional(),
  loadType:  z.enum(["fixed_kg", "percent_rm", "rpe"]).optional(),
  loadValue: z.number().positive().optional(),
}) satisfies z.ZodType<RoutineSet>

const exerciseContentSchema = z.object({
  id:          z.string().uuid(),
  exerciseId:  z.string().uuid(),
  order:       z.number().int().min(0),
  tempo:       z.string().optional(),
  restSeconds: z.number().int().positive().optional(),
  goal:        z.enum(["strength","hypertrophy","endurance","power","cardio","recovery"]).optional(),
  notes:       z.string().optional(),
  sets:        z.array(routineSetSchema).min(1),
}) satisfies z.ZodType<RoutineExerciseContent>

const routineItemSchema = z.discriminatedUnion("type", [
  exerciseContentSchema.extend({ type: z.literal("exercise") }) satisfies z.ZodType<RoutineItemExercise>,
  z.object({
    type:      z.literal("block"),
    id:        z.string().uuid(),
    order:     z.number().int().min(0),
    name:      z.string().optional(),
    rounds:    z.number().int().min(2),
    exercises: z.array(exerciseContentSchema).min(1),
  }) satisfies z.ZodType<RoutineItemBlock>,
])

const routineContentSchema = z.object({
  v:     z.literal(1),
  items: z.array(routineItemSchema),
}) satisfies z.ZodType<RoutineContent>

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractExerciseIds(content: RoutineContent): string[] {
  return content.items.flatMap((item) =>
    item.type === "exercise"
      ? [item.exerciseId]
      : item.exercises.map((e) => e.exerciseId),
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const routinesRouter = router({
  create: protectedProcedure
    .input(z.object({
      teamId:   z.string().uuid(),
      name:     z.string().min(1),
      category: z.enum(["evaluation", "training"]).default("training"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [r] = await db
        .insert(routine)
        .values({ ...input, createdBy: ctx.session.user.id, content: { v: 1, items: [] } })
        .returning()
      return r
    }),

  list: protectedProcedure
    .input(z.object({
      teamId:   z.string().uuid(),
      category: z.enum(["evaluation", "training"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const conditions = [eq(routine.teamId, input.teamId)]
      if (input.category) conditions.push(eq(routine.category, input.category))
      return db.select().from(routine).where(and(...conditions))
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, r.teamId)

      const exerciseIds = extractExerciseIds(r.content)
      const exercises = exerciseIds.length > 0
        ? await db
            .select({ id: exercise.id, name: exercise.name })
            .from(exercise)
            .where(inArray(exercise.id, exerciseIds))
        : []

      const nameById = Object.fromEntries(exercises.map((e) => [e.id, e.name ?? "Ejercicio eliminado"]))
      return { ...r, exerciseNames: nameById }
    }),

  updateContent: protectedProcedure
    .input(z.object({
      id:      z.string().uuid(),
      content: routineContentSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)

      const [updated] = await db
        .update(routine)
        .set({ content: input.content, updatedAt: new Date() })
        .where(eq(routine.id, input.id))
        .returning()
      return updated
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      const [updated] = await db
        .update(routine)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(routine.id, input.id))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      await db.delete(routine).where(eq(routine.id, input.id))
    }),
})
