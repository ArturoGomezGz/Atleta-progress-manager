import { db } from "@atleta/db/client"
import {
  athleteExerciseRm,
  athleteSession,
  athleteSessionExerciseCancelled,
  exercise,
  routine,
  sessionExercise,
  sessionSetTarget,
  setRecord,
  trainingSession,
  user,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, desc, eq, gt, gte, inArray, lte } from "drizzle-orm"
import type { RoutineExerciseContent } from "@atleta/db/schema"
import { z } from "zod"
import { triggerExerciseReport } from "../services/report-trigger"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

export const sessionsRouter = router({
  list: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      return db
        .select({
          id: trainingSession.id,
          status: trainingSession.status,
          startedAt: trainingSession.startedAt,
          routineId: trainingSession.routineId,
          routineName: routine.name,
        })
        .from(trainingSession)
        .innerJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(eq(trainingSession.teamId, input.teamId))
        .orderBy(desc(trainingSession.startedAt))
    }),

  create: protectedProcedure
    .input(z.object({
      routineId: z.string().uuid(),
      teamId: z.string().uuid(),
      athleteIds: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)

      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })

      // Aplanar ejercicios del content (ejercicios individuales + ejercicios dentro de bloques)
      const allExercises: RoutineExerciseContent[] = r.content.items.flatMap((item) =>
        item.type === "exercise" ? [item] : item.exercises,
      ).sort((a, b) => a.order - b.order)

      return db.transaction(async (tx) => {
        const [session] = await tx
          .insert(trainingSession)
          .values({ routineId: input.routineId, teamId: input.teamId, startedBy: ctx.session.user.id })
          .returning()

        // Snapshot exercises + set targets desde el content JSON
        for (const ex of allExercises) {
          const [se] = await tx
            .insert(sessionExercise)
            .values({ sessionId: session.id, exerciseId: ex.exerciseId, order: ex.order })
            .returning()

          const repsTargets = ex.sets
            .filter((s) => s.setType === "reps" && (s.targetReps != null || s.loadType === "percent_rm"))
            .map((s) => ({
              sessionExerciseId: se.id,
              setNumber: s.setNumber,
              targetReps: s.targetReps ?? null,
              targetPercent: s.loadType === "percent_rm" && s.loadValue != null
                ? String(s.loadValue)
                : null,
            }))

          if (repsTargets.length > 0) {
            await tx.insert(sessionSetTarget).values(repsTargets)
          }
        }

        await tx.insert(athleteSession).values(
          input.athleteIds.map((athleteId) => ({ sessionId: session.id, athleteId })),
        )

        return session
      })
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.id)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)

      const exercises = await db
        .select({
          id: sessionExercise.id,
          exerciseId: sessionExercise.exerciseId,
          exerciseName: exercise.name,
          order: sessionExercise.order,
        })
        .from(sessionExercise)
        .innerJoin(exercise, eq(sessionExercise.exerciseId, exercise.id))
        .where(eq(sessionExercise.sessionId, input.id))
        .orderBy(asc(sessionExercise.order))

      const exercisesWithTargets = await Promise.all(
        exercises.map(async (ex) => {
          const targets = await db
            .select()
            .from(sessionSetTarget)
            .where(eq(sessionSetTarget.sessionExerciseId, ex.id))
            .orderBy(asc(sessionSetTarget.setNumber))
          return { ...ex, targets }
        }),
      )

      const athletes = await db
        .select({
          id: athleteSession.id,
          athleteId: athleteSession.athleteId,
          status: athleteSession.status,
          athleteName: user.name,
          athleteEmail: user.email,
        })
        .from(athleteSession)
        .innerJoin(user, eq(athleteSession.athleteId, user.id))
        .where(eq(athleteSession.sessionId, input.id))

      return { ...session, exercises: exercisesWithTargets, athletes }
    }),

  athleteSets: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })

      return db.select().from(setRecord).where(eq(setRecord.athleteSessionId, as.id))
    }),

  recordSet: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      athleteId: z.string(),
      sessionExerciseId: z.string().uuid(),
      sessionSetTargetId: z.string().uuid().nullable(),
      setNumber: z.number().int().min(1),
      reps: z.number().int().min(0),
      weightLbs: z.string().default("0"),
      status: z.enum(["valid", "invalid"]).default("valid"),
    }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está activa" })
      await assertCoach(ctx.session.user.id, session.teamId)

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      if (as.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "El atleta está cancelado en esta sesión" })

      const [set] = await db
        .insert(setRecord)
        .values({
          athleteSessionId: as.id,
          sessionExerciseId: input.sessionExerciseId,
          sessionSetTargetId: input.sessionSetTargetId,
          setNumber: input.setNumber,
          reps: input.reps,
          weightLbs: input.weightLbs,
          status: input.status,
          recordedBy: ctx.session.user.id,
        })
        .returning()
      return set
    }),

  updateSet: protectedProcedure
    .input(z.object({ setId: z.string().uuid(), reps: z.number().int().min(0), weightLbs: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [set] = await db.select().from(setRecord).where(eq(setRecord.id, input.setId)).limit(1)
      if (!set) throw new TRPCError({ code: "NOT_FOUND" })
      const [as] = await db.select().from(athleteSession).where(eq(athleteSession.id, set.athleteSessionId)).limit(1)
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, as!.sessionId)).limit(1)
      if (session?.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está activa" })
      await assertCoach(ctx.session.user.id, session!.teamId)
      const [updated] = await db
        .update(setRecord)
        .set({ reps: input.reps, weightLbs: input.weightLbs })
        .where(eq(setRecord.id, input.setId))
        .returning()
      return updated
    }),

  updateSetStatus: protectedProcedure
    .input(z.object({ setId: z.string().uuid(), status: z.enum(["valid", "invalid"]) }))
    .mutation(async ({ ctx, input }) => {
      const [set] = await db.select().from(setRecord).where(eq(setRecord.id, input.setId)).limit(1)
      if (!set) throw new TRPCError({ code: "NOT_FOUND" })
      const [as] = await db.select().from(athleteSession).where(eq(athleteSession.id, set.athleteSessionId)).limit(1)
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, as!.sessionId)).limit(1)
      await assertCoach(ctx.session.user.id, session!.teamId)
      const [updated] = await db.update(setRecord).set({ status: input.status }).where(eq(setRecord.id, input.setId)).returning()
      return updated
    }),

  deleteSet: protectedProcedure
    .input(z.object({ setId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [set] = await db.select().from(setRecord).where(eq(setRecord.id, input.setId)).limit(1)
      if (!set) throw new TRPCError({ code: "NOT_FOUND" })
      const [as] = await db.select().from(athleteSession).where(eq(athleteSession.id, set.athleteSessionId)).limit(1)
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, as!.sessionId)).limit(1)
      await assertCoach(ctx.session.user.id, session!.teamId)
      await db.delete(setRecord).where(eq(setRecord.id, input.setId))
    }),

  cancelAthlete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)
      await db
        .update(athleteSession)
        .set({ status: "cancelled" })
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
    }),

  reactivateAthlete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)
      await db
        .update(athleteSession)
        .set({ status: "active" })
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
    }),

  addSessionExercise: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      exerciseId: z.string().uuid(),
      order: z.number().int().min(0),
      sets: z.array(z.object({
        setNumber: z.number().int().min(1),
        targetReps: z.number().int().min(1).nullable(),
        targetPercent: z.string().nullable(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está activa" })
      await assertCoach(ctx.session.user.id, session.teamId)

      return db.transaction(async (tx) => {
        const [se] = await tx
          .insert(sessionExercise)
          .values({ sessionId: input.sessionId, exerciseId: input.exerciseId, order: input.order })
          .returning()
        await tx.insert(sessionSetTarget).values(
          input.sets.map((s) => ({
            sessionExerciseId: se.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps,
            targetPercent: s.targetPercent,
          })),
        )
        return se
      })
    }),

  cancelAthleteExercise: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string(), sessionExerciseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está activa" })
      await assertCoach(ctx.session.user.id, session.teamId)
      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      await db
        .insert(athleteSessionExerciseCancelled)
        .values({ athleteSessionId: as.id, sessionExerciseId: input.sessionExerciseId })
        .onConflictDoNothing()
    }),

  reactivateAthleteExercise: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string(), sessionExerciseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)
      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      await db
        .delete(athleteSessionExerciseCancelled)
        .where(
          and(
            eq(athleteSessionExerciseCancelled.athleteSessionId, as.id),
            eq(athleteSessionExerciseCancelled.sessionExerciseId, input.sessionExerciseId),
          ),
        )
    }),

  athleteCancelledExercises: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)
      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      const rows = await db
        .select({ sessionExerciseId: athleteSessionExerciseCancelled.sessionExerciseId })
        .from(athleteSessionExerciseCancelled)
        .where(eq(athleteSessionExerciseCancelled.athleteSessionId, as.id))
      return rows.map((r) => r.sessionExerciseId)
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.id)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)

      const newRms: { athleteId: string; exerciseId: string; teamId: string; rmId: string }[] = []

      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(trainingSession)
          .set({ status: "completed" })
          .where(eq(trainingSession.id, input.id))
          .returning()

        // Calculate RMs from valid sets (Epley formula: 1RM = weight × (1 + reps/30))
        const validSets = await tx
          .select({
            athleteId: athleteSession.athleteId,
            exerciseId: sessionExercise.exerciseId,
            reps: setRecord.reps,
            weightLbs: setRecord.weightLbs,
          })
          .from(setRecord)
          .innerJoin(athleteSession, eq(setRecord.athleteSessionId, athleteSession.id))
          .innerJoin(sessionExercise, eq(setRecord.sessionExerciseId, sessionExercise.id))
          .where(
            and(
              eq(athleteSession.sessionId, input.id),
              eq(setRecord.status, "valid"),
              gt(setRecord.weightLbs, "0"),
              gte(setRecord.reps, 1),
              lte(setRecord.reps, 10),
            ),
          )

        // Max estimated RM per (athleteId, exerciseId)
        const rmMap = new Map<string, { athleteId: string; exerciseId: string; rmLbs: number }>()
        for (const s of validSets) {
          const key = `${s.athleteId}:${s.exerciseId}`
          const estimated = Number(s.weightLbs) * (1 + s.reps / 30)
          const existing = rmMap.get(key)
          if (!existing || estimated > existing.rmLbs) {
            rmMap.set(key, { athleteId: s.athleteId, exerciseId: s.exerciseId, rmLbs: estimated })
          }
        }

        // Upsert only if new value exceeds current RM
        for (const { athleteId, exerciseId, rmLbs } of rmMap.values()) {
          const [current] = await tx
            .select({ rmLbs: athleteExerciseRm.rmLbs })
            .from(athleteExerciseRm)
            .where(and(eq(athleteExerciseRm.athleteId, athleteId), eq(athleteExerciseRm.exerciseId, exerciseId)))
            .orderBy(desc(athleteExerciseRm.recordedAt))
            .limit(1)

          if (!current || rmLbs > Number(current.rmLbs)) {
            const [inserted] = await tx.insert(athleteExerciseRm).values({
              athleteId,
              exerciseId,
              rmLbs: rmLbs.toFixed(2),
              source: "auto",
              sessionId: input.id,
            }).returning()
            newRms.push({ athleteId, exerciseId, teamId: session.teamId, rmId: inserted.id })
          }
        }

        return updated
      })

      for (const params of newRms) {
        void triggerExerciseReport({
          athleteId: params.athleteId,
          exerciseId: params.exerciseId,
          teamId: params.teamId,
          triggerRmId: params.rmId,
        }).catch((err) => console.error("Report generation failed", { ...params, err }))
      }

      return result
    }),

  athleteRms: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)

      const exercises = await db
        .select({ exerciseId: sessionExercise.exerciseId })
        .from(sessionExercise)
        .where(eq(sessionExercise.sessionId, input.sessionId))

      const exerciseIds = exercises.map((e) => e.exerciseId)
      if (exerciseIds.length === 0) return {} as Record<string, string>

      const rms = await db
        .select({ exerciseId: athleteExerciseRm.exerciseId, rmLbs: athleteExerciseRm.rmLbs })
        .from(athleteExerciseRm)
        .where(and(eq(athleteExerciseRm.athleteId, input.athleteId), inArray(athleteExerciseRm.exerciseId, exerciseIds)))
        .orderBy(desc(athleteExerciseRm.recordedAt))

      const rmMap: Record<string, string> = {}
      for (const rm of rms) {
        if (!rmMap[rm.exerciseId]) rmMap[rm.exerciseId] = rm.rmLbs
      }
      return rmMap
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.id)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)
      const [updated] = await db.update(trainingSession).set({ status: "cancelled" }).where(eq(trainingSession.id, input.id)).returning()
      return updated
    }),
})
