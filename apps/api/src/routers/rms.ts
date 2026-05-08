import { db } from "@atleta/db/client"
import { athleteExerciseRm, exercise, exerciseProgressReport, teamMember, user } from "@atleta/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { triggerExerciseReport } from "../services/report-trigger"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

export const rmsRouter = router({
  listByAthlete: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)

      const allRms = await db
        .select({
          id: athleteExerciseRm.id,
          exerciseId: athleteExerciseRm.exerciseId,
          exerciseName: exercise.name,
          rmLbs: athleteExerciseRm.rmLbs,
          source: athleteExerciseRm.source,
          sessionId: athleteExerciseRm.sessionId,
          recordedAt: athleteExerciseRm.recordedAt,
        })
        .from(athleteExerciseRm)
        .innerJoin(exercise, eq(athleteExerciseRm.exerciseId, exercise.id))
        .where(eq(athleteExerciseRm.athleteId, input.athleteId))
        .orderBy(desc(athleteExerciseRm.recordedAt))

      type RmEntry = (typeof allRms)[number]
      const exerciseMap = new Map<string, { exerciseId: string; exerciseName: string; current: RmEntry; history: RmEntry[] }>()
      for (const rm of allRms) {
        if (!exerciseMap.has(rm.exerciseId)) {
          exerciseMap.set(rm.exerciseId, { exerciseId: rm.exerciseId, exerciseName: rm.exerciseName, current: rm, history: [] })
        }
        exerciseMap.get(rm.exerciseId)!.history.push(rm)
      }

      return Array.from(exerciseMap.values())
    }),

  setManual: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      athleteId: z.string(),
      exerciseId: z.string().uuid(),
      rmLbs: z.string().regex(/^\d+(\.\d{1,2})?$/, "Peso inválido"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [rm] = await db
        .insert(athleteExerciseRm)
        .values({ athleteId: input.athleteId, exerciseId: input.exerciseId, rmLbs: input.rmLbs, source: "manual", sessionId: null })
        .returning()

      void triggerExerciseReport({
        athleteId: input.athleteId,
        exerciseId: input.exerciseId,
        teamId: input.teamId,
        triggerRmId: rm.id,
      }).catch((err) => console.error("Report generation failed (manual)", { rmId: rm.id, err }))

      return rm
    }),

  exerciseReport: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      athleteId: z.string(),
      exerciseId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const [report] = await db
        .select({
          content: exerciseProgressReport.content,
          reportSource: exerciseProgressReport.reportSource,
          seenAt: exerciseProgressReport.seenAt,
          generatedAt: exerciseProgressReport.generatedAt,
        })
        .from(exerciseProgressReport)
        .where(and(
          eq(exerciseProgressReport.athleteId, input.athleteId),
          eq(exerciseProgressReport.exerciseId, input.exerciseId),
          eq(exerciseProgressReport.teamId, input.teamId),
        ))
        .limit(1)
      return report ?? null
    }),

  reportStatuses: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const reports = await db
        .select({
          exerciseId: exerciseProgressReport.exerciseId,
          reportSource: exerciseProgressReport.reportSource,
          seenAt: exerciseProgressReport.seenAt,
        })
        .from(exerciseProgressReport)
        .where(and(
          eq(exerciseProgressReport.athleteId, input.athleteId),
          eq(exerciseProgressReport.teamId, input.teamId),
        ))
      return reports.map((r) => ({
        exerciseId: r.exerciseId,
        source: r.reportSource,
        hasUnread: r.seenAt === null,
      }))
    }),

  updateReport: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      athleteId: z.string(),
      exerciseId: z.string().uuid(),
      content: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      await db
        .update(exerciseProgressReport)
        .set({ content: input.content, reportSource: "coach", seenAt: null, generatedAt: new Date() })
        .where(and(
          eq(exerciseProgressReport.athleteId, input.athleteId),
          eq(exerciseProgressReport.exerciseId, input.exerciseId),
          eq(exerciseProgressReport.teamId, input.teamId),
        ))
    }),

  markReportSeen: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      athleteId: z.string(),
      exerciseId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      await db
        .update(exerciseProgressReport)
        .set({ seenAt: new Date() })
        .where(and(
          eq(exerciseProgressReport.athleteId, input.athleteId),
          eq(exerciseProgressReport.exerciseId, input.exerciseId),
          eq(exerciseProgressReport.teamId, input.teamId),
          // Only mark seen if not already seen
        ))
    }),

  athletes: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      return db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(and(eq(teamMember.teamId, input.teamId), eq(teamMember.role, "athlete")))
    }),
})
