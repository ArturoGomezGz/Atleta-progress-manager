import { db } from "@atleta/db/client"
import { exercise, routine, routineExercise } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

export const routinesRouter = router({
  create: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [newRoutine] = await db
        .insert(routine)
        .values({ ...input, createdBy: ctx.session.user.id })
        .returning()
      return newRoutine
    }),

  list: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      return db.select().from(routine).where(eq(routine.teamId, input.teamId))
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, r.teamId)
      const exercises = await db
        .select({
          id: routineExercise.id,
          routineId: routineExercise.routineId,
          exerciseId: routineExercise.exerciseId,
          exerciseName: exercise.name,
          targetSets: routineExercise.targetSets,
          targetReps: routineExercise.targetReps,
          targetWeight: routineExercise.targetWeight,
          order: routineExercise.order,
        })
        .from(routineExercise)
        .innerJoin(exercise, eq(routineExercise.exerciseId, exercise.id))
        .where(eq(routineExercise.routineId, r.id))
        .orderBy(asc(routineExercise.order))
      return { ...r, exercises }
    }),

  addExercise: protectedProcedure
    .input(
      z.object({
        routineId: z.string().uuid(),
        exerciseId: z.string().uuid(),
        targetSets: z.number().int().min(1),
        targetReps: z.number().int().min(1),
        targetWeight: z.string().optional(),
        order: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      const [re] = await db.insert(routineExercise).values(input).returning()
      return re
    }),

  removeExercise: protectedProcedure
    .input(z.object({ routineExerciseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [re] = await db
        .select()
        .from(routineExercise)
        .where(eq(routineExercise.id, input.routineExerciseId))
        .limit(1)
      if (!re) throw new TRPCError({ code: "NOT_FOUND" })
      const [r] = await db.select().from(routine).where(eq(routine.id, re.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      await db.delete(routineExercise).where(eq(routineExercise.id, input.routineExerciseId))
    }),

  updateExercise: protectedProcedure
    .input(
      z.object({
        routineExerciseId: z.string().uuid(),
        targetSets: z.number().int().min(1).optional(),
        targetReps: z.number().int().min(1).optional(),
        targetWeight: z.string().nullable().optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { routineExerciseId, ...values } = input
      const [re] = await db
        .select()
        .from(routineExercise)
        .where(eq(routineExercise.id, routineExerciseId))
        .limit(1)
      if (!re) throw new TRPCError({ code: "NOT_FOUND" })
      const [r] = await db.select().from(routine).where(eq(routine.id, re.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      const [updated] = await db
        .update(routineExercise)
        .set(values)
        .where(eq(routineExercise.id, routineExerciseId))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      await db.delete(routine).where(and(eq(routine.id, input.id), eq(routine.teamId, r.teamId)))
    }),
})
