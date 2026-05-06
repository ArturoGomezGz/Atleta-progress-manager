import { db } from "@atleta/db/client"
import {
  athleteSession,
  exercise,
  routine,
  routineExercise,
  sessionExercise,
  setRecord,
  trainingSession,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

export const sessionsRouter = router({
  // Start a session from a routine — snapshots exercises at this moment
  create: protectedProcedure
    .input(
      z.object({
        routineId: z.string().uuid(),
        teamId: z.string().uuid(),
        athleteIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)

      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })

      const routineExercises = await db
        .select()
        .from(routineExercise)
        .where(eq(routineExercise.routineId, input.routineId))
        .orderBy(asc(routineExercise.order))

      return db.transaction(async (tx) => {
        const [session] = await tx
          .insert(trainingSession)
          .values({
            routineId: input.routineId,
            teamId: input.teamId,
            startedBy: ctx.session.user.id,
          })
          .returning()

        // Snapshot exercises
        if (routineExercises.length > 0) {
          await tx.insert(sessionExercise).values(
            routineExercises.map(({ exerciseId, targetSets, targetReps, targetWeight, order }) => ({
              sessionId: session.id,
              exerciseId,
              targetSets,
              targetReps,
              targetWeight,
              order,
            })),
          )
        }

        // Enroll athletes
        await tx.insert(athleteSession).values(
          input.athleteIds.map((athleteId) => ({ sessionId: session.id, athleteId })),
        )

        return session
      })
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.id))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)

      const [exercises, athletes] = await Promise.all([
        db
          .select({
            id: sessionExercise.id,
            sessionId: sessionExercise.sessionId,
            exerciseId: sessionExercise.exerciseId,
            exerciseName: exercise.name,
            targetSets: sessionExercise.targetSets,
            targetReps: sessionExercise.targetReps,
            targetWeight: sessionExercise.targetWeight,
            order: sessionExercise.order,
          })
          .from(sessionExercise)
          .innerJoin(exercise, eq(sessionExercise.exerciseId, exercise.id))
          .where(eq(sessionExercise.sessionId, input.id))
          .orderBy(asc(sessionExercise.order)),
        db
          .select()
          .from(athleteSession)
          .where(eq(athleteSession.sessionId, input.id)),
      ])

      return { ...session, exercises, athletes }
    }),

  // Retrieve all sets for one athlete in this session
  athleteSets: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.sessionId))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(
          and(
            eq(athleteSession.sessionId, input.sessionId),
            eq(athleteSession.athleteId, input.athleteId),
          ),
        )
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })

      return db.select().from(setRecord).where(eq(setRecord.athleteSessionId, as.id))
    }),

  recordSet: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        athleteId: z.string(),
        sessionExerciseId: z.string().uuid(),
        setNumber: z.number().int().min(1),
        reps: z.number().int().min(0),
        weight: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.sessionId))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" })
      await assertCoach(ctx.session.user.id, session.teamId)

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(
          and(
            eq(athleteSession.sessionId, input.sessionId),
            eq(athleteSession.athleteId, input.athleteId),
          ),
        )
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      if (as.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Athlete session is cancelled" })

      const [set] = await db
        .insert(setRecord)
        .values({
          athleteSessionId: as.id,
          sessionExerciseId: input.sessionExerciseId,
          setNumber: input.setNumber,
          reps: input.reps,
          weight: input.weight,
          recordedBy: ctx.session.user.id,
        })
        .returning()
      return set
    }),

  updateSetStatus: protectedProcedure
    .input(
      z.object({
        setId: z.string().uuid(),
        status: z.enum(["valid", "invalid"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [set] = await db.select().from(setRecord).where(eq(setRecord.id, input.setId)).limit(1)
      if (!set) throw new TRPCError({ code: "NOT_FOUND" })

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(eq(athleteSession.id, set.athleteSessionId))
        .limit(1)
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, as!.sessionId))
        .limit(1)
      await assertCoach(ctx.session.user.id, session!.teamId)

      const [updated] = await db
        .update(setRecord)
        .set({ status: input.status })
        .where(eq(setRecord.id, input.setId))
        .returning()
      return updated
    }),

  deleteSet: protectedProcedure
    .input(z.object({ setId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [set] = await db.select().from(setRecord).where(eq(setRecord.id, input.setId)).limit(1)
      if (!set) throw new TRPCError({ code: "NOT_FOUND" })

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(eq(athleteSession.id, set.athleteSessionId))
        .limit(1)
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, as!.sessionId))
        .limit(1)
      await assertCoach(ctx.session.user.id, session!.teamId)

      await db.delete(setRecord).where(eq(setRecord.id, input.setId))
    }),

  cancelAthlete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.sessionId))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)

      await db
        .update(athleteSession)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(athleteSession.sessionId, input.sessionId),
            eq(athleteSession.athleteId, input.athleteId),
          ),
        )
    }),

  addSessionExercise: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        exerciseId: z.string().uuid(),
        targetSets: z.number().int().min(1),
        targetReps: z.number().int().min(1),
        targetWeight: z.string().optional(),
        order: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.sessionId))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" })
      await assertCoach(ctx.session.user.id, session.teamId)

      const [se] = await db.insert(sessionExercise).values(input).returning()
      return se
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.id))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)

      const [updated] = await db
        .update(trainingSession)
        .set({ status: "completed" })
        .where(eq(trainingSession.id, input.id))
        .returning()
      return updated
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(trainingSession)
        .where(eq(trainingSession.id, input.id))
        .limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)

      const [updated] = await db
        .update(trainingSession)
        .set({ status: "cancelled" })
        .where(eq(trainingSession.id, input.id))
        .returning()
      return updated
    }),
})
