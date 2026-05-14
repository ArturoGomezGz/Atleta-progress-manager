import { db } from "@atleta/db/client"
import {
  assignedSession,
  athleteExerciseRm,
  athleteSessionExecution,
  athleteSetCompletion,
  exercise,
  routine,
  routineExercise,
  routineSetTarget,
  teamGroup,
  teamGroupMember,
  user,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, desc, eq, inArray, or } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

export const assignedSessionsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        routineId: z.string().uuid(),
        scheduledDate: z.string().date(),
        assignedToAthleteId: z.string().optional(),
        assignedToGroupId: z.string().uuid().optional(),
      }).refine((d) => d.assignedToAthleteId || d.assignedToGroupId, {
        message: "Debe especificarse atleta o grupo",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r || r.teamId !== input.teamId) throw new TRPCError({ code: "NOT_FOUND" })

      const [s] = await db
        .insert(assignedSession)
        .values({
          routineId: input.routineId,
          teamId: input.teamId,
          assignedBy: ctx.session.user.id,
          assignedToAthleteId: input.assignedToAthleteId ?? null,
          assignedToGroupId: input.assignedToGroupId ?? null,
          scheduledDate: input.scheduledDate,
        })
        .returning()
      return s
    }),

  list: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        athleteId: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed", "skipped"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const conditions = [eq(assignedSession.teamId, input.teamId)]
      if (input.athleteId) conditions.push(eq(assignedSession.assignedToAthleteId, input.athleteId))
      if (input.status) conditions.push(eq(assignedSession.status, input.status))

      const athleteUser = db.$with("athlete_user").as(
        db.select({ id: user.id, name: user.name }).from(user)
      )

      return db
        .select({
          id: assignedSession.id,
          routineId: assignedSession.routineId,
          routineName: routine.name,
          teamId: assignedSession.teamId,
          assignedBy: assignedSession.assignedBy,
          assignedToAthleteId: assignedSession.assignedToAthleteId,
          athleteName: athleteUser.name,
          assignedToGroupId: assignedSession.assignedToGroupId,
          groupName: teamGroup.name,
          scheduledDate: assignedSession.scheduledDate,
          status: assignedSession.status,
          createdAt: assignedSession.createdAt,
        })
        .from(assignedSession)
        .leftJoin(routine, eq(assignedSession.routineId, routine.id))
        .leftJoin(athleteUser, eq(assignedSession.assignedToAthleteId, athleteUser.id))
        .leftJoin(teamGroup, eq(assignedSession.assignedToGroupId, teamGroup.id))
        .where(and(...conditions))
        .orderBy(asc(assignedSession.scheduledDate))
    }),

  myList: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const athleteId = ctx.session.user.id

      const myGroups = await db
        .select({ groupId: teamGroupMember.groupId })
        .from(teamGroupMember)
        .innerJoin(teamGroup, eq(teamGroupMember.groupId, teamGroup.id))
        .where(and(eq(teamGroupMember.athleteId, athleteId), eq(teamGroup.teamId, input.teamId)))

      const groupIds = myGroups.map((g) => g.groupId)

      const targetCondition = groupIds.length > 0
        ? or(eq(assignedSession.assignedToAthleteId, athleteId), inArray(assignedSession.assignedToGroupId, groupIds))!
        : eq(assignedSession.assignedToAthleteId, athleteId)

      return db
        .select({
          id: assignedSession.id,
          routineId: assignedSession.routineId,
          routineName: routine.name,
          scheduledDate: assignedSession.scheduledDate,
          status: assignedSession.status,
          assignedToAthleteId: assignedSession.assignedToAthleteId,
          assignedToGroupId: assignedSession.assignedToGroupId,
          groupName: teamGroup.name,
        })
        .from(assignedSession)
        .leftJoin(routine, eq(assignedSession.routineId, routine.id))
        .leftJoin(teamGroup, eq(assignedSession.assignedToGroupId, teamGroup.id))
        .where(and(eq(assignedSession.teamId, input.teamId), targetCondition))
        .orderBy(asc(assignedSession.scheduledDate))
    }),

  cancel: protectedProcedure
    .input(z.object({ assignedSessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [s] = await db.select().from(assignedSession).where(eq(assignedSession.id, input.assignedSessionId)).limit(1)
      if (!s) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, s.teamId)
      await db.update(assignedSession).set({ status: "skipped" }).where(eq(assignedSession.id, input.assignedSessionId))
    }),
})

export const athleteSessionsRouter = router({
  start: protectedProcedure
    .input(z.object({ assignedSessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const athleteId = ctx.session.user.id
      const [s] = await db.select().from(assignedSession).where(eq(assignedSession.id, input.assignedSessionId)).limit(1)
      if (!s) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(athleteId, s.teamId)

      if (s.status === "skipped" || s.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está disponible" })
      }

      // Idempotent — return existing execution if already started
      const [existing] = await db
        .select()
        .from(athleteSessionExecution)
        .where(and(eq(athleteSessionExecution.assignedSessionId, input.assignedSessionId), eq(athleteSessionExecution.athleteId, athleteId)))
        .limit(1)
      if (existing) return existing

      await db.update(assignedSession).set({ status: "in_progress" }).where(eq(assignedSession.id, input.assignedSessionId))

      const [execution] = await db
        .insert(athleteSessionExecution)
        .values({ assignedSessionId: input.assignedSessionId, athleteId })
        .returning()
      return execution
    }),

  completeSet: protectedProcedure
    .input(z.object({ executionId: z.string().uuid(), routineExerciseId: z.string().uuid(), setNumber: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [exec] = await db
        .select()
        .from(athleteSessionExecution)
        .where(and(eq(athleteSessionExecution.id, input.executionId), eq(athleteSessionExecution.athleteId, ctx.session.user.id)))
        .limit(1)
      if (!exec) throw new TRPCError({ code: "NOT_FOUND" })
      if (exec.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está en progreso" })

      // Idempotent
      const [existing] = await db
        .select()
        .from(athleteSetCompletion)
        .where(
          and(
            eq(athleteSetCompletion.executionId, input.executionId),
            eq(athleteSetCompletion.routineExerciseId, input.routineExerciseId),
            eq(athleteSetCompletion.setNumber, input.setNumber),
          ),
        )
        .limit(1)
      if (existing) return existing

      const [completion] = await db
        .insert(athleteSetCompletion)
        .values({ executionId: input.executionId, routineExerciseId: input.routineExerciseId, setNumber: input.setNumber })
        .returning()
      return completion
    }),

  undoSet: protectedProcedure
    .input(z.object({ executionId: z.string().uuid(), routineExerciseId: z.string().uuid(), setNumber: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [exec] = await db
        .select()
        .from(athleteSessionExecution)
        .where(and(eq(athleteSessionExecution.id, input.executionId), eq(athleteSessionExecution.athleteId, ctx.session.user.id)))
        .limit(1)
      if (!exec) throw new TRPCError({ code: "NOT_FOUND" })
      if (exec.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está en progreso" })

      await db
        .delete(athleteSetCompletion)
        .where(
          and(
            eq(athleteSetCompletion.executionId, input.executionId),
            eq(athleteSetCompletion.routineExerciseId, input.routineExerciseId),
            eq(athleteSetCompletion.setNumber, input.setNumber),
          ),
        )
    }),

  complete: protectedProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [exec] = await db
        .select()
        .from(athleteSessionExecution)
        .where(and(eq(athleteSessionExecution.id, input.executionId), eq(athleteSessionExecution.athleteId, ctx.session.user.id)))
        .limit(1)
      if (!exec) throw new TRPCError({ code: "NOT_FOUND" })
      if (exec.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está en progreso" })

      const [updated] = await db
        .update(athleteSessionExecution)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(athleteSessionExecution.id, input.executionId))
        .returning()

      await db.update(assignedSession).set({ status: "completed" }).where(eq(assignedSession.id, exec.assignedSessionId))

      return updated
    }),

  skip: protectedProcedure
    .input(z.object({ assignedSessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [s] = await db.select().from(assignedSession).where(eq(assignedSession.id, input.assignedSessionId)).limit(1)
      if (!s) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, s.teamId)
      await db.update(assignedSession).set({ status: "skipped" }).where(eq(assignedSession.id, input.assignedSessionId))
    }),

  progress: protectedProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [exec] = await db
        .select()
        .from(athleteSessionExecution)
        .where(and(eq(athleteSessionExecution.id, input.executionId), eq(athleteSessionExecution.athleteId, ctx.session.user.id)))
        .limit(1)
      if (!exec) throw new TRPCError({ code: "NOT_FOUND" })

      const [session] = await db.select().from(assignedSession).where(eq(assignedSession.id, exec.assignedSessionId)).limit(1)
      const [routineData] = session?.routineId
        ? await db.select().from(routine).where(eq(routine.id, session.routineId)).limit(1)
        : [null]

      const exercises =
        session?.routineId
          ? await db
              .select({
                id: routineExercise.id,
                exerciseId: routineExercise.exerciseId,
                exerciseName: exercise.name,
                order: routineExercise.order,
                tempo: routineExercise.tempo,
                restSeconds: routineExercise.restSeconds,
                goal: routineExercise.goal,
                notes: routineExercise.notes,
              })
              .from(routineExercise)
              .innerJoin(exercise, eq(routineExercise.exerciseId, exercise.id))
              .where(eq(routineExercise.routineId, session.routineId))
              .orderBy(asc(routineExercise.order))
          : []

      // Latest RM per exercise for the athlete (for % RM weight suggestion)
      const athleteId = exec.athleteId
      const exerciseIds = exercises.map((e) => e.exerciseId)
      const rmsRaw = exerciseIds.length > 0
        ? await db
            .select({ exerciseId: athleteExerciseRm.exerciseId, rmLbs: athleteExerciseRm.rmLbs })
            .from(athleteExerciseRm)
            .where(and(eq(athleteExerciseRm.athleteId, athleteId), inArray(athleteExerciseRm.exerciseId, exerciseIds)))
            .orderBy(desc(athleteExerciseRm.recordedAt))
        : []
      const rmByExercise = new Map<string, string>()
      for (const rm of rmsRaw) {
        if (!rmByExercise.has(rm.exerciseId)) rmByExercise.set(rm.exerciseId, rm.rmLbs)
      }

      const exercisesWithSets = await Promise.all(
        exercises.map(async (ex) => {
          const sets = await db
            .select()
            .from(routineSetTarget)
            .where(eq(routineSetTarget.routineExerciseId, ex.id))
            .orderBy(asc(routineSetTarget.setNumber))

          const completedSets = await db
            .select({ setNumber: athleteSetCompletion.setNumber })
            .from(athleteSetCompletion)
            .where(and(eq(athleteSetCompletion.executionId, input.executionId), eq(athleteSetCompletion.routineExerciseId, ex.id)))

          const completedSetNumbers = new Set(completedSets.map((c) => c.setNumber))
          const athleteRmLbs = rmByExercise.get(ex.exerciseId) ?? null  // string (numeric from pg)
          return {
            ...ex,
            athleteRmLbs,
            sets: sets.map((s) => ({ ...s, completed: completedSetNumbers.has(s.setNumber) })),
          }
        }),
      )

      return {
        execution: exec,
        routineType: routineData?.type ?? "sequential",
        circuitRounds: routineData?.circuitRounds ?? null,
        exercises: exercisesWithSets,
      }
    }),
})
