import { db } from "@atleta/db/client"
import { exercise, routine, routineExercise, routineSetTarget } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

const setTargetInput = z.object({
  setNumber: z.number().int().min(1),
  targetReps: z.number().int().min(1).nullable(),
  targetPercent: z.string().nullable(),
})

export const routinesRouter = router({
  create: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [r] = await db.insert(routine).values({ ...input, createdBy: ctx.session.user.id }).returning()
      return r
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
          exerciseId: routineExercise.exerciseId,
          exerciseName: exercise.name,
          order: routineExercise.order,
        })
        .from(routineExercise)
        .innerJoin(exercise, eq(routineExercise.exerciseId, exercise.id))
        .where(eq(routineExercise.routineId, r.id))
        .orderBy(asc(routineExercise.order))

      const exercisesWithSets = await Promise.all(
        exercises.map(async (ex) => {
          const sets = await db
            .select()
            .from(routineSetTarget)
            .where(eq(routineSetTarget.routineExerciseId, ex.id))
            .orderBy(asc(routineSetTarget.setNumber))
          return { ...ex, sets }
        }),
      )

      return { ...r, exercises: exercisesWithSets }
    }),

  addExercise: protectedProcedure
    .input(
      z.object({
        routineId: z.string().uuid(),
        exerciseId: z.string().uuid(),
        order: z.number().int().min(0),
        sets: z.array(setTargetInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)

      return db.transaction(async (tx) => {
        const [re] = await tx
          .insert(routineExercise)
          .values({ routineId: input.routineId, exerciseId: input.exerciseId, order: input.order })
          .returning()
        await tx.insert(routineSetTarget).values(
          input.sets.map((s) => ({
            routineExerciseId: re.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetPercent: s.targetPercent,
          })),
        )
        return re
      })
    }),

  updateSets: protectedProcedure
    .input(
      z.object({
        routineExerciseId: z.string().uuid(),
        sets: z.array(setTargetInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [re] = await db.select().from(routineExercise).where(eq(routineExercise.id, input.routineExerciseId)).limit(1)
      if (!re) throw new TRPCError({ code: "NOT_FOUND" })
      const [r] = await db.select().from(routine).where(eq(routine.id, re.routineId)).limit(1)
      await assertCoach(ctx.session.user.id, r!.teamId)

      await db.transaction(async (tx) => {
        await tx.delete(routineSetTarget).where(eq(routineSetTarget.routineExerciseId, input.routineExerciseId))
        await tx.insert(routineSetTarget).values(
          input.sets.map((s) => ({
            routineExerciseId: input.routineExerciseId,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetPercent: s.targetPercent,
          })),
        )
      })
    }),

  removeExercise: protectedProcedure
    .input(z.object({ routineExerciseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [re] = await db.select().from(routineExercise).where(eq(routineExercise.id, input.routineExerciseId)).limit(1)
      if (!re) throw new TRPCError({ code: "NOT_FOUND" })
      const [r] = await db.select().from(routine).where(eq(routine.id, re.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      await db.delete(routineExercise).where(eq(routineExercise.id, input.routineExerciseId))
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      await db.delete(routine).where(eq(routine.id, input.id))
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      const [updated] = await db.update(routine).set({ name: input.name }).where(eq(routine.id, input.id)).returning()
      return updated
    }),
})
