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
import { and, asc, desc, eq, gt, gte, inArray, lte, SQL } from "drizzle-orm"
import type { RoutineExerciseContent } from "@atleta/db/schema"
import { z } from "zod"
import { epley } from "../lib/epley"
import { triggerExerciseReport } from "../services/report-trigger"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"



async function getRoutineCategory(routineId: string | null): Promise<"evaluation" | "training" | null> {
  if (!routineId) return null
  const [r] = await db.select({ category: routine.category }).from(routine).where(eq(routine.id, routineId)).limit(1)
  return r?.category ?? null
}

export const sessionsRouter = router({
  myList: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const athleteId = ctx.session.user.id
      const rows = await db
        .select({
          id: trainingSession.id,
          status: trainingSession.status,
          startedAt: trainingSession.startedAt,
          scheduledDate: trainingSession.scheduledDate,
          routineName: routine.name,
          routineId: trainingSession.routineId,
          routineCategory: routine.category,
          athleteSessionStatus: athleteSession.status,
        })
        .from(athleteSession)
        .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
        .leftJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(and(eq(trainingSession.teamId, input.teamId), eq(athleteSession.athleteId, athleteId)))
        .orderBy(desc(trainingSession.startedAt))

      return rows.map((row) => ({
        ...row,
        // Si la sesión entera fue cancelada por el coach, tiene precedencia sobre el estado individual
        status: row.status === "cancelled" ? "cancelled" as const : row.athleteSessionStatus,
      }))
    }),

  myProgress: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const athleteId = ctx.session.user.id
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(athleteId, session.teamId)

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "FORBIDDEN" })

      const [r] = session.routineId
        ? await db.select({ name: routine.name }).from(routine).where(eq(routine.id, session.routineId)).limit(1)
        : [null]

      const exercises = await db
        .select({
          id: sessionExercise.id,
          exerciseId: sessionExercise.exerciseId,
          exerciseName: exercise.name,
          videoUrl: exercise.videoUrl,
          order: sessionExercise.order,
        })
        .from(sessionExercise)
        .innerJoin(exercise, eq(sessionExercise.exerciseId, exercise.id))
        .where(eq(sessionExercise.sessionId, input.sessionId))
        .orderBy(asc(sessionExercise.order))

      if (exercises.length === 0) {
        return { id: session.id, status: session.status, startedAt: session.startedAt, routineName: r?.name ?? null, exercises: [] as never[] }
      }

      // Construir mapa de metadata desde el snapshot JSON (tempo, restSeconds, etc.)
      const contentItems = session.content?.items ?? []
      const exerciseMeta = new Map<string, { tempo?: string; restSeconds?: number; notes?: string }>()
      for (const item of contentItems) {
        if (item.type === "exercise") {
          exerciseMeta.set(item.exerciseId, { tempo: item.tempo, restSeconds: item.restSeconds, notes: item.notes })
        } else {
          for (const ex of item.exercises) {
            exerciseMeta.set(ex.exerciseId, { tempo: ex.tempo, restSeconds: ex.restSeconds, notes: ex.notes })
          }
        }
      }

      const exerciseIds = exercises.map((e) => e.id)
      const [targets, mySets] = await Promise.all([
        db.select().from(sessionSetTarget)
          .where(inArray(sessionSetTarget.sessionExerciseId, exerciseIds))
          .orderBy(asc(sessionSetTarget.setNumber)),
        db.select().from(setRecord)
          .where(eq(setRecord.athleteSessionId, as.id))
          .orderBy(asc(setRecord.setNumber)),
      ])

      // Si la sesión entera fue cancelada por el coach, tiene precedencia
      const effectiveStatus = session.status === "cancelled" ? "cancelled" as const : as.status

      return {
        id: session.id,
        status: effectiveStatus,
        startedAt: session.startedAt,
        routineName: r?.name ?? null,
        exercises: exercises.map((ex) => {
          const meta = exerciseMeta.get(ex.exerciseId) ?? {}
          return {
            ...ex,
            tempo: meta.tempo ?? null,
            restSeconds: meta.restSeconds ?? null,
            notes: meta.notes ?? null,
            targets: targets.filter((t) => t.sessionExerciseId === ex.id),
            sets: mySets.filter((s) => s.sessionExerciseId === ex.id),
          }
        }),
      }
    }),

  list: protectedProcedure
    .input(z.object({
      teamId:   z.string().uuid(),
      category: z.enum(["evaluation", "training"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const conditions: SQL[] = [eq(trainingSession.teamId, input.teamId)]
      if (input.category) conditions.push(eq(routine.category, input.category))
      return db
        .select({
          id: trainingSession.id,
          status: trainingSession.status,
          startedAt: trainingSession.startedAt,
          scheduledDate: trainingSession.scheduledDate,
          routineId: trainingSession.routineId,
          routineName: routine.name,
        })
        .from(trainingSession)
        .innerJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(and(...conditions))
        .orderBy(desc(trainingSession.startedAt))
    }),

  create: protectedProcedure
    .input(z.object({
      routineId: z.string().uuid(),
      teamId: z.string().uuid(),
      athleteIds: z.array(z.string()).min(1),
      scheduledDate: z.string().date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)

      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })

      // Aplanar ejercicios del content (ejercicios individuales + ejercicios dentro de bloques)
      const allExercises: RoutineExerciseContent[] = r.content.items.flatMap((item) =>
        item.type === "exercise" ? [item] : item.exercises,
      ).sort((a, b) => a.order - b.order)

      const today = new Date().toISOString().split("T")[0]
      const isScheduled = input.scheduledDate != null && input.scheduledDate > today

      return db.transaction(async (tx) => {
        const [session] = await tx
          .insert(trainingSession)
          .values({
            routineId: input.routineId,
            teamId: input.teamId,
            startedBy: ctx.session.user.id,
            scheduledDate: input.scheduledDate ?? null,
            status: isScheduled ? "scheduled" : "active",
            content: r.content,
          })
          .returning()

        // Snapshot exercises + set targets desde el content JSON
        for (const ex of allExercises) {
          const [se] = await tx
            .insert(sessionExercise)
            .values({ sessionId: session.id, exerciseId: ex.exerciseId, order: ex.order })
            .returning()

          const targets = ex.sets.map((s) => ({
            sessionExerciseId: se.id,
            setNumber: s.setNumber,
            targetReps: s.targetReps ?? null,
            targetPercent: s.loadType === "percent_rm" && s.loadValue != null
              ? String(s.loadValue)
              : null,
          }))

          if (targets.length > 0) {
            await tx.insert(sessionSetTarget).values(targets)
          }
        }

        // En entrenamiento el atleta activa su propia sesión; en evaluación el coach controla todo
        const athleteInitialStatus = r.category === "training" ? "scheduled" as const : "active" as const
        await tx.insert(athleteSession).values(
          input.athleteIds.map((athleteId) => ({ sessionId: session.id, athleteId, status: athleteInitialStatus })),
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

      const [r] = session.routineId
        ? await db.select({ name: routine.name, category: routine.category })
            .from(routine).where(eq(routine.id, session.routineId)).limit(1)
        : [null]

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

      return {
        ...session,
        routineName: r?.name ?? null,
        routineCategory: r?.category ?? null,
        exercises: exercisesWithTargets,
        athletes,
      }
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.id)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })

      const member = await assertMember(userId, session.teamId)
      const category = await getRoutineCategory(session.routineId)

      if (category === "training") {
        // En entrenamiento cada atleta activa su propia sesión
        const [as] = await db
          .select()
          .from(athleteSession)
          .where(and(eq(athleteSession.sessionId, input.id), eq(athleteSession.athleteId, userId)))
          .limit(1)
        if (!as) throw new TRPCError({ code: "FORBIDDEN" })
        if (as.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión ya fue iniciada" })

        const now = new Date()
        await db.update(athleteSession).set({ status: "active", startedAt: now }).where(eq(athleteSession.id, as.id))

        // Activar el trainingSession padre si aún estaba programado
        if (session.status === "scheduled") {
          await db.update(trainingSession).set({ status: "active" }).where(eq(trainingSession.id, input.id))
        }

        return { ...session, status: "active" as const }
      }

      // Evaluación: el coach activa toda la sesión
      if (member.role !== "coach") throw new TRPCError({ code: "FORBIDDEN" })
      if (session.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está programada" })

      const [updated] = await db
        .update(trainingSession)
        .set({ status: "active" })
        .where(eq(trainingSession.id, input.id))
        .returning()
      return updated
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
      const userId = ctx.session.user.id
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está activa" })

      // Coach puede registrar para cualquier atleta; atleta solo para sí mismo
      const member = await assertMember(userId, session.teamId)
      if (member.role !== "coach" && input.athleteId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
      if (member.role === "coach") {
        const category = await getRoutineCategory(session.routineId)
        if (category === "training") throw new TRPCError({ code: "FORBIDDEN", message: "El entrenador no puede registrar series en sesiones de entrenamiento" })
      }

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, input.athleteId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      if (as.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "El atleta está cancelado en esta sesión" })
      if (as.status === "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "El atleta no ha iniciado la sesión" })

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
      if (await getRoutineCategory(session!.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
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
      if (await getRoutineCategory(session!.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
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
      if (await getRoutineCategory(session!.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
      await db.delete(setRecord).where(eq(setRecord.id, input.setId))
    }),

  cancelAthlete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)
      if (await getRoutineCategory(session.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
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
      if (await getRoutineCategory(session.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
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
      if (await getRoutineCategory(session.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })

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
      if (await getRoutineCategory(session.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
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
      if (await getRoutineCategory(session.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
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

      const category = await getRoutineCategory(session.routineId)

      // Entrenamiento: cerrar y guardar progreso, sin calcular PR
      if (category === "training") {
        return db.transaction(async (tx) => {
          await tx
            .update(athleteSession)
            .set({ status: "completed", completedAt: new Date() })
            .where(and(eq(athleteSession.sessionId, input.id), eq(athleteSession.status, "active")))
          const [updated] = await tx
            .update(trainingSession)
            .set({ status: "completed" })
            .where(eq(trainingSession.id, input.id))
            .returning()
          return updated
        })
      }

      // Evaluación: calcular PRs (Epley: 1RM = weight × (1 + reps/30))
      const newRms: { athleteId: string; exerciseId: string; teamId: string; rmId: string }[] = []

      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(trainingSession)
          .set({ status: "completed" })
          .where(eq(trainingSession.id, input.id))
          .returning()

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

        const rmMap = new Map<string, { athleteId: string; exerciseId: string; rmLbs: number }>()
        for (const s of validSets) {
          const key = `${s.athleteId}:${s.exerciseId}`
          const estimated = epley(Number(s.weightLbs), s.reps)
          const existing = rmMap.get(key)
          if (!existing || estimated > existing.rmLbs) {
            rmMap.set(key, { athleteId: s.athleteId, exerciseId: s.exerciseId, rmLbs: estimated })
          }
        }

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

  completeMySession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, userId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "NOT_FOUND" })
      if (as.status === "completed") return as
      const [updated] = await db
        .update(athleteSession)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(athleteSession.id, as.id))
        .returning()

      // Auto-completar sesión de entrenamiento si todos los atletas terminaron
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (session?.status === "active" && await getRoutineCategory(session.routineId) === "training") {
        const stillActive = await db
          .select({ id: athleteSession.id })
          .from(athleteSession)
          .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.status, "active")))
        if (stillActive.length === 0) {
          await db.update(trainingSession).set({ status: "completed" }).where(eq(trainingSession.id, input.sessionId))
        }
      }

      return updated
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
