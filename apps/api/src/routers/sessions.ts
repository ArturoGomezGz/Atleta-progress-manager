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
  team,
  teamMember,
  trainingSession,
  user,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, desc, eq, gt, gte, inArray, lte, SQL, sql } from "drizzle-orm"
import { z } from "zod"
import { zoneProfileFromContent } from "@atleta/db/body-zones"
import { exerciseZones, withZoneProfiles } from "../services/body-zones"
import { notifyWorkoutAssigned } from "../services/push"
import { compareCalendarItems, calendarDate, MAX_CALENDAR_DAYS, type MyCalendarItem } from "../services/session-calendar"
import { routineKindSchema, scheduledTimeSchema, toHHMM } from "../services/routine-kind"
import { computeSessionLocks, lockForSession, startRefusalError, type LockCandidate, type SessionLockReason } from "../services/session-rules"
import { triggerExerciseReport } from "../services/report-trigger"
import { flattenContent } from "../services/routine-content"
import { assertAssignableAthletes, createAssignedSessions, resolveAthleteToday, todayUtc } from "../services/session-assign"
import { assertFeature, hasFeature } from "../lib/features"
import { protectedProcedure, router } from "../trpc"
import { assertAthleteInTeam, assertCoach, assertMember } from "./teams"



async function getRoutineCategory(routineId: string | null): Promise<"evaluation" | "training" | null> {
  if (!routineId) return null
  const [r] = await db.select({ category: routine.category }).from(routine).where(eq(routine.id, routineId)).limit(1)
  return r?.category ?? null
}

type FeatureUser = { id: string; email: string }

// Límites de sessions.createMany (y de la herramienta MCP assign_routine)
export const MAX_ASSIGN_ATHLETES = 50
export const MAX_ASSIGN_DATES = 60

// Límites de sessions.createSequence
export const MAX_SEQUENCE_STEPS = 10
export const MAX_SEQUENCE_SESSIONS = 120

// "Hoy" del atleta: el cliente puede mandar su fecha local (ver resolveAthleteToday)
const localDateInput = z.string().date().optional()
const positionInput = z.number().int().min(0).max(99)

type PendingCheck = {
  sessionId: string
  scheduledDate: string | null
  position: number
  category: "evaluation" | "training" | null
  sessionStatus: "scheduled" | "active" | "completed" | "cancelled"
  athleteStatus: "scheduled" | "active" | "completed" | "cancelled"
}

// Entrenamiento: pendiente = el atleta aún no la inicia. Evaluación: pendiente = el coach aún no la activa.
function lockCandidate(r: PendingCheck): LockCandidate {
  const isTraining = r.category !== "evaluation"
  const pending = r.sessionStatus !== "cancelled" && r.athleteStatus !== "cancelled" && r.athleteStatus !== "completed" &&
    (isTraining ? r.athleteStatus === "scheduled" : r.sessionStatus === "scheduled")
  return { sessionId: r.sessionId, scheduledDate: r.scheduledDate, position: r.position, isTraining, pending }
}

// locked / lockReason de cada fila del atleta (no pendientes: locked false)
async function lockFields(athleteId: string, rows: PendingCheck[], today: string) {
  const locks = await computeSessionLocks(athleteId, rows.map(lockCandidate), today)
  return (sessionId: string): { locked: boolean; lockReason: SessionLockReason | null } => {
    const lockReason = locks.get(sessionId) ?? null
    return { locked: lockReason !== null, lockReason }
  }
}

// Rutina a asignar: debe existir, ser del equipo y no estar archivada
async function loadAssignableRoutine(routineId: string, teamId: string) {
  const [r] = await db.select().from(routine).where(eq(routine.id, routineId)).limit(1)
  // Una rutina de otro equipo se trata como inexistente (no revela que existe)
  if (!r || r.teamId !== teamId) throw new TRPCError({ code: "NOT_FOUND" })
  if (r.archivedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "La rutina está archivada; restáurala para poder asignarla" })
  return r
}

// Las sesiones de evaluación solo son accesibles con el flag `evaluation`
async function assertSessionFeature(user: FeatureUser, routineId: string | null) {
  const category = await getRoutineCategory(routineId)
  if (category === "evaluation") assertFeature(user, "evaluation")
  return category
}

async function loadSetForCoach(setId: string, user: FeatureUser) {
  const [row] = await db
    .select({
      set: setRecord,
      teamId: trainingSession.teamId,
      routineId: trainingSession.routineId,
      sessionStatus: trainingSession.status,
    })
    .from(setRecord)
    .innerJoin(athleteSession, eq(setRecord.athleteSessionId, athleteSession.id))
    .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
    .where(eq(setRecord.id, setId))
    .limit(1)
  if (!row) throw new TRPCError({ code: "NOT_FOUND" })
  await assertCoach(user.id, row.teamId)
  await assertSessionFeature(user, row.routineId)
  if (await getRoutineCategory(row.routineId) === "training") throw new TRPCError({ code: "BAD_REQUEST", message: "No permitido en sesiones de entrenamiento" })
  return row
}

// Atletas asignados a cada sesión y su avance, para el seguimiento del entrenador.
// Los atletas no ven a los demás: sin rol de coach se devuelve la lista vacía.
async function withAssignedAthletes<T extends { id: string }>(isCoach: boolean, rows: T[]) {
  const byId = new Map<string, { userId: string; name: string | null; status: "scheduled" | "active" | "completed" }[]>()
  if (isCoach && rows.length > 0) {
    const assigned = await db
      .select({ sessionId: athleteSession.sessionId, userId: athleteSession.athleteId, name: user.name, status: athleteSession.status })
      .from(athleteSession)
      .innerJoin(user, eq(athleteSession.athleteId, user.id))
      .where(and(inArray(athleteSession.sessionId, rows.map((r) => r.id)), sql`${athleteSession.status} <> 'cancelled'`))
      .orderBy(asc(user.name))
    for (const a of assigned) {
      if (a.status === "cancelled") continue
      const list = byId.get(a.sessionId) ?? []
      list.push({ userId: a.userId, name: a.name, status: a.status })
      byId.set(a.sessionId, list)
    }
  }
  return rows.map((r) => ({ ...r, athletes: byId.get(r.id) ?? [] }))
}

export const sessionsRouter = router({
  myList: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), localDate: localDateInput }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const athleteId = ctx.session.user.id
      const rows = await db
        .select({
          id: trainingSession.id,
          status: trainingSession.status,
          startedAt: trainingSession.startedAt,
          scheduledDate: trainingSession.scheduledDate,
          kind: trainingSession.kind,
          position: trainingSession.position,
          scheduledTime: trainingSession.scheduledTime,
          routineName: routine.name,
          routineId: trainingSession.routineId,
          routineCategory: routine.category,
          athleteSessionStatus: athleteSession.status,
          content: trainingSession.content,
        })
        .from(athleteSession)
        .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
        .leftJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(and(eq(trainingSession.teamId, input.teamId), eq(athleteSession.athleteId, athleteId)))
        .orderBy(desc(trainingSession.startedAt))

      // Sin el flag las sesiones de evaluación quedan ocultas (no se borran)
      const visible = hasFeature(ctx.session.user, "evaluation") ? rows : rows.filter((r) => r.routineCategory !== "evaluation")
      const lockOf = await lockFields(athleteId, visible.map((r) => ({
        sessionId: r.id, scheduledDate: r.scheduledDate, position: r.position, category: r.routineCategory,
        sessionStatus: r.status, athleteStatus: r.athleteSessionStatus,
      })), resolveAthleteToday(input.localDate))
      return (await withZoneProfiles(visible)).map((row) => ({
        ...row,
        scheduledTime: toHHMM(row.scheduledTime),
        ...lockOf(row.id),
        // Si la sesión entera fue cancelada por el coach, tiene precedencia sobre el estado individual
        status: row.status === "cancelled" ? "cancelled" as const : row.athleteSessionStatus,
      }))
    }),

  // Pendientes del atleta en todos sus equipos (app móvil): las activas y las
  // de entrenamiento programadas, con el mismo criterio que "Mis rutinas" en web.
  myPending: protectedProcedure.input(z.object({ localDate: localDateInput }).optional()).query(async ({ ctx, input }) => {
    const athleteId = ctx.session.user.id
    const canSeeEvaluation = hasFeature(ctx.session.user, "evaluation")
    const rows = await db
      .select({
        id: trainingSession.id,
        teamId: trainingSession.teamId,
        teamName: team.name,
        sessionStatus: trainingSession.status,
        status: athleteSession.status,
        startedAt: trainingSession.startedAt,
        scheduledDate: trainingSession.scheduledDate,
        kind: trainingSession.kind,
        position: trainingSession.position,
        scheduledTime: trainingSession.scheduledTime,
        routineName: routine.name,
        routineCategory: routine.category,
      })
      .from(athleteSession)
      .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
      .innerJoin(team, eq(trainingSession.teamId, team.id))
      .innerJoin(teamMember, and(eq(teamMember.teamId, trainingSession.teamId), eq(teamMember.userId, athleteId)))
      .leftJoin(routine, eq(trainingSession.routineId, routine.id))
      .where(and(
        eq(athleteSession.athleteId, athleteId),
        inArray(athleteSession.status, ["active", "scheduled"]),
      ))
      // Sin fecha primero, como en web
      .orderBy(sql`${trainingSession.scheduledDate} asc nulls first`, desc(trainingSession.startedAt))

    const visible = rows
      .filter((r) => r.sessionStatus !== "cancelled")
      .filter((r) => r.status === "active" || r.routineCategory === "training")
      .filter((r) => canSeeEvaluation || r.routineCategory !== "evaluation")
    const lockOf = await lockFields(athleteId, visible.map((r) => ({
      sessionId: r.id, scheduledDate: r.scheduledDate, position: r.position, category: r.routineCategory,
      sessionStatus: r.sessionStatus, athleteStatus: r.status,
    })), resolveAthleteToday(input?.localDate))
    return visible.map(({ sessionStatus: _sessionStatus, ...r }) => ({ ...r, scheduledTime: toHHMM(r.scheduledTime), ...lockOf(r.id) }))
  }),

  // Fechas de las sesiones que el atleta completó en el último año, para el
  // tracker de momentum de la app móvil. Semanas y racha se calculan en el
  // cliente para respetar la zona horaria del dispositivo.
  myMomentum: protectedProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 365 * 86_400_000)
    const rows = await db
      .select({ completedAt: athleteSession.completedAt })
      .from(athleteSession)
      .where(and(
        eq(athleteSession.athleteId, ctx.session.user.id),
        eq(athleteSession.status, "completed"),
        gte(athleteSession.completedAt, since),
      ))
      .orderBy(desc(athleteSession.completedAt))
    return rows.flatMap((r) => (r.completedAt ? [r.completedAt.toISOString()] : []))
  }),

  // Calendario del atleta en todos sus equipos (como myPending) para un rango de fechas (máx. 62 días):
  // entrenamientos y evaluaciones, incluidos los completados y los saltados. Orden: fecha, position, hora sugerida.
  // Día de una sesión sin scheduledDate ("Ahora"): hoy mientras siga pendiente; ya terminada o cancelada,
  // el día en que se creó (ver `calendarDate`). Las que el coach canceló no salen (las que el atleta saltó sí); las evaluaciones, solo con el flag.
  myCalendar: protectedProcedure
    .input(z.object({ from: z.string().date(), to: z.string().date(), localDate: localDateInput }))
    .query(async ({ ctx, input }): Promise<MyCalendarItem[]> => {
      const span = (Date.parse(`${input.to}T00:00:00Z`) - Date.parse(`${input.from}T00:00:00Z`)) / 86_400_000
      if (span < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "La fecha inicial debe ser anterior o igual a la final" })
      if (span > MAX_CALENDAR_DAYS) throw new TRPCError({ code: "BAD_REQUEST", message: `El rango máximo es de ${MAX_CALENDAR_DAYS} días` })

      const athleteId = ctx.session.user.id
      const today = resolveAthleteToday(input.localDate)
      const canSeeEvaluation = hasFeature(ctx.session.user, "evaluation")
      const createdDay = sql`(${trainingSession.startedAt} at time zone 'UTC')::date`
      const rows = await db
        .select({
          sessionId: trainingSession.id,
          teamId: trainingSession.teamId,
          teamName: team.name,
          sessionStatus: trainingSession.status,
          athleteStatus: athleteSession.status,
          completedAt: athleteSession.completedAt,
          startedAt: trainingSession.startedAt,
          scheduledDate: trainingSession.scheduledDate,
          kind: trainingSession.kind,
          position: trainingSession.position,
          scheduledTime: trainingSession.scheduledTime,
          routineName: routine.name,
          category: routine.category,
          content: trainingSession.content,
        })
        .from(athleteSession)
        .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
        .innerJoin(team, eq(trainingSession.teamId, team.id))
        .innerJoin(teamMember, and(eq(teamMember.teamId, trainingSession.teamId), eq(teamMember.userId, athleteId)))
        .leftJoin(routine, eq(trainingSession.routineId, routine.id))
        .where(and(
          eq(athleteSession.athleteId, athleteId),
          // Las que canceló el coach no salen; las que el propio atleta saltó sí (estado "cancelled")
          sql`(${trainingSession.status} <> 'cancelled' or ${athleteSession.status} = 'cancelled')`,
          sql`(
            (${trainingSession.scheduledDate} between ${input.from}::date and ${input.to}::date)
            or (${trainingSession.scheduledDate} is null and (
              ${athleteSession.status} in ('scheduled', 'active')
              or ${createdDay} between ${input.from}::date and ${input.to}::date
            ))
          )`,
        ))

      const visible = rows
        .filter((r) => canSeeEvaluation || r.category !== "evaluation")
        .map((r) => ({ ...r, day: calendarDate({ scheduledDate: r.scheduledDate, startedAt: r.startedAt, athleteStatus: r.athleteStatus, today }) }))
        .filter((r) => r.day >= input.from && r.day <= input.to)

      const lockOf = await lockFields(athleteId, visible.map((r) => ({
        sessionId: r.sessionId, scheduledDate: r.scheduledDate, position: r.position, category: r.category,
        sessionStatus: r.sessionStatus, athleteStatus: r.athleteStatus,
      })), today)

      return visible
        .map((r): MyCalendarItem => ({
          sessionId: r.sessionId,
          teamId: r.teamId,
          teamName: r.teamName,
          routineName: r.routineName,
          category: r.category,
          kind: r.kind,
          position: r.position,
          scheduledDate: r.day,
          scheduledTime: toHHMM(r.scheduledTime),
          // Una evaluación futura ya nace "active" para el atleta; mientras el coach no la active, está programada
          status: r.category === "evaluation" && r.sessionStatus === "scheduled" && r.athleteStatus === "active" ? "scheduled" : r.athleteStatus,
          completedAt: r.completedAt ? r.completedAt.toISOString() : null,
          exerciseCount: flattenContent(r.content).length,
          ...lockOf(r.sessionId),
        }))
        .sort(compareCalendarItems)
    }),

  myProgress: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const athleteId = ctx.session.user.id
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(athleteId, session.teamId)
      await assertSessionFeature(ctx.session.user, session.routineId)

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
          description: exercise.description,
          youtubeVideoId: exercise.youtubeVideoId,
          youtubeTitle: exercise.youtubeTitle,
          videoOrientation: exercise.videoOrientation,
          order: sessionExercise.order,
        })
        .from(sessionExercise)
        .innerJoin(exercise, eq(sessionExercise.exerciseId, exercise.id))
        .where(eq(sessionExercise.sessionId, input.sessionId))
        .orderBy(asc(sessionExercise.order))

      if (exercises.length === 0) {
        return { id: session.id, status: session.status, startedAt: session.startedAt, routineName: r?.name ?? null, exercises: [] as never[] }
      }

      // Metadata desde el snapshot JSON (tempo, descanso, notas, circuito) por posición
      const flat = flattenContent(session.content)
      const metaFor = (order: number, exerciseId: string) => {
        const m = flat[order]
        return m && m.exerciseId === exerciseId ? m : null
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
          const meta = metaFor(ex.order, ex.exerciseId)
          return {
            ...ex,
            tempo: meta?.tempo ?? null,
            restSeconds: meta?.restSeconds ?? null,
            notes: meta?.notes ?? null,
            perSide: meta?.perSide === true,
            blockId: meta?.blockId ?? null,
            blockName: meta?.blockName ?? null,
            rounds: meta?.rounds ?? 1,
            roundNumber: meta?.roundNumber ?? null,
            targets: targets.filter((t) => t.sessionExerciseId === ex.id),
            sets: mySets.filter((s) => s.sessionExerciseId === ex.id),
          }
        }),
      }
    }),

  // Filtros opcionales (los usa la herramienta MCP list_assignments; la web solo manda category/athleteId):
  // `from`/`to` sobre la fecha de la sesión (programada o, sin fecha, el día en que se creó, en UTC),
  // `status` de la sesión, `planAssignmentId` y `limit` (sin límite por defecto).
  list: protectedProcedure
    .input(z.object({
      teamId:    z.string().uuid(),
      category:  z.enum(["evaluation", "training"]).optional(),
      athleteId: z.string().optional(),
      from:      z.string().date().optional(),
      to:        z.string().date().optional(),
      status:    z.array(z.enum(["scheduled", "active", "completed", "cancelled"])).min(1).optional(),
      planAssignmentId: z.string().uuid().optional(),
      limit:     z.number().int().min(1).max(500).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const member = await assertMember(ctx.session.user.id, input.teamId)
      const conditions: SQL[] = [eq(trainingSession.teamId, input.teamId)]
      // Sin el flag las sesiones de evaluación quedan ocultas (no se borran)
      if (!hasFeature(ctx.session.user, "evaluation")) {
        if (input.category === "evaluation") return []
        conditions.push(eq(routine.category, "training"))
      }
      if (input.category) conditions.push(eq(routine.category, input.category))
      const sessionDate = sql`coalesce(${trainingSession.scheduledDate}, (${trainingSession.startedAt} at time zone 'UTC')::date)`
      if (input.from) conditions.push(sql`${sessionDate} >= ${input.from}::date`)
      if (input.to) conditions.push(sql`${sessionDate} <= ${input.to}::date`)
      if (input.status) conditions.push(inArray(trainingSession.status, input.status))
      if (input.planAssignmentId) conditions.push(eq(trainingSession.planAssignmentId, input.planAssignmentId))

      const columns = {
        id: trainingSession.id,
        status: trainingSession.status,
        startedAt: trainingSession.startedAt,
        scheduledDate: trainingSession.scheduledDate,
        kind: trainingSession.kind,
        position: trainingSession.position,
        scheduledTime: trainingSession.scheduledTime,
        routineId: trainingSession.routineId,
        routineName: routine.name,
        planAssignmentId: trainingSession.planAssignmentId,
        content: trainingSession.content,
      }

      // Filtrar por atleta: la sesión solo aparece si ese atleta está asignado a ella
      const base = db.select(columns).from(trainingSession).innerJoin(routine, eq(trainingSession.routineId, routine.id))
      if (input.athleteId) conditions.push(eq(athleteSession.athleteId, input.athleteId))
      const filtered = (input.athleteId ? base.innerJoin(athleteSession, eq(athleteSession.sessionId, trainingSession.id)) : base)
        .where(and(...conditions))
        // Las de un mismo createMany comparten startedAt: desempata la fecha programada
        .orderBy(desc(trainingSession.startedAt), sql`${trainingSession.scheduledDate} desc nulls first`)
      const rows = await (input.limit ? filtered.limit(input.limit) : filtered)
      return withAssignedAthletes(member.role === "coach", (await withZoneProfiles(rows)).map((r) => ({ ...r, scheduledTime: toHHMM(r.scheduledTime) })))
    }),

  create: protectedProcedure
    .input(z.object({
      routineId: z.string().uuid(),
      teamId: z.string().uuid(),
      athleteIds: z.array(z.string()).min(1),
      scheduledDate: z.string().date().optional(),
      // Solo entrenamientos: por defecto el tipo de la rutina y el orden de ese tipo (warmup 0, main 1, recovery 2)
      kind: routineKindSchema.optional(),
      position: positionInput.optional(),
      scheduledTime: scheduledTimeSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      await assertAssignableAthletes(db, input.teamId, input.athleteIds)

      const r = await loadAssignableRoutine(input.routineId, input.teamId)
      if (r.category === "evaluation") assertFeature(ctx.session.user, "evaluation")
      if (input.scheduledDate != null) assertFeature(ctx.session.user, "scheduled_sessions")

      const today = todayUtc()
      const [session] = await db.transaction((tx) =>
        createAssignedSessions(tx, {
          routine: r,
          teamId: input.teamId,
          athleteIds: input.athleteIds,
          dates: [input.scheduledDate ?? null],
          startedBy: ctx.session.user.id,
          today,
          kind: input.kind,
          position: input.position,
          scheduledTime: input.scheduledTime,
        }),
      )
      void notifyWorkoutAssigned({
        coachId: ctx.session.user.id, athleteIds: input.athleteIds, routineId: r.id,
        sessionIds: [session!.id], dates: [input.scheduledDate ?? null], today,
      })
      return session!
    }),

  // Varias fechas a la vez (una sesión por fecha, todas con los mismos atletas), en una
  // sola transacción. A diferencia de `create`, solo las fechas futuras exigen el flag
  // `scheduled_sessions` (hoy o antes queda activa, igual que "Ahora").
  createMany: protectedProcedure
    .input(z.object({
      routineId: z.string().uuid(),
      teamId: z.string().uuid(),
      athleteIds: z.array(z.string()).min(1).max(MAX_ASSIGN_ATHLETES),
      dates: z.array(z.string().date()).min(1).max(MAX_ASSIGN_DATES)
        .refine((d) => new Set(d).size === d.length, "Las fechas no se pueden repetir"),
      kind: routineKindSchema.optional(),
      position: positionInput.optional(),
      scheduledTime: scheduledTimeSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const athleteIds = [...new Set(input.athleteIds)]
      await assertAssignableAthletes(db, input.teamId, athleteIds)

      const r = await loadAssignableRoutine(input.routineId, input.teamId)
      if (r.category === "evaluation") assertFeature(ctx.session.user, "evaluation")
      const today = todayUtc()
      if (input.dates.some((d) => d > today)) assertFeature(ctx.session.user, "scheduled_sessions")

      const dates = [...input.dates].sort()
      const sessions = await db.transaction((tx) =>
        createAssignedSessions(tx, {
          routine: r, teamId: input.teamId, athleteIds, dates, startedBy: ctx.session.user.id, today,
          kind: input.kind, position: input.position, scheduledTime: input.scheduledTime,
        }),
      )
      void notifyWorkoutAssigned({
        coachId: ctx.session.user.id, athleteIds, routineId: r.id, sessionIds: sessions.map((s) => s.id), dates, today,
      })
      return sessions
    }),

  // Secuencia de entrenamientos por día (p. ej. calentamiento → principal → recuperación): por cada fecha crea
  // una sesión por paso, con position = índice del paso, todo en una transacción. Solo rutinas de entrenamiento.
  // Mismas reglas de permisos y de flag que createMany. Un solo aviso push por asignación (no uno por paso).
  createSequence: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      athleteIds: z.array(z.string()).min(1).max(MAX_ASSIGN_ATHLETES),
      dates: z.array(z.string().date()).min(1).max(MAX_ASSIGN_DATES)
        .refine((d) => new Set(d).size === d.length, "Las fechas no se pueden repetir"),
      steps: z.array(z.object({
        routineId: z.string().uuid(),
        kind: routineKindSchema.optional(),
        scheduledTime: scheduledTimeSchema.optional(),
      })).min(1).max(MAX_SEQUENCE_STEPS),
    }).refine((i) => i.dates.length * i.steps.length <= MAX_SEQUENCE_SESSIONS, `Máximo ${MAX_SEQUENCE_SESSIONS} sesiones por secuencia (fechas × pasos)`))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const athleteIds = [...new Set(input.athleteIds)]
      await assertAssignableAthletes(db, input.teamId, athleteIds)

      const routines = new Map<string, Awaited<ReturnType<typeof loadAssignableRoutine>>>()
      for (const id of new Set(input.steps.map((st) => st.routineId))) {
        const r = await loadAssignableRoutine(id, input.teamId)
        if (r.category !== "training") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo los entrenamientos pueden formar una secuencia; las evaluaciones no" })
        }
        routines.set(id, r)
      }
      const today = todayUtc()
      if (input.dates.some((d) => d > today)) assertFeature(ctx.session.user, "scheduled_sessions")

      const dates = [...input.dates].sort()
      const sessions = await db.transaction(async (tx) => {
        const created: Awaited<ReturnType<typeof createAssignedSessions>> = []
        for (const date of dates) {
          for (const [index, step] of input.steps.entries()) {
            const [session] = await createAssignedSessions(tx, {
              routine: routines.get(step.routineId)!, teamId: input.teamId, athleteIds, dates: [date],
              startedBy: ctx.session.user.id, today, kind: step.kind, position: index, scheduledTime: step.scheduledTime,
            })
            created.push(session!)
          }
        }
        return created
      })
      void notifyWorkoutAssigned({
        coachId: ctx.session.user.id, athleteIds, routineId: input.steps[0]!.routineId,
        sessionIds: sessions.map((s) => s.id), dates, today, sequenceSteps: input.steps.length,
      })
      return sessions
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid(), localDate: localDateInput }))
    .query(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.id)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)
      await assertSessionFeature(ctx.session.user, session.routineId)

      const [r] = session.routineId
        ? await db.select({ name: routine.name, category: routine.category })
            .from(routine).where(eq(routine.id, session.routineId)).limit(1)
        : [null]

      const exercises = await db
        .select({
          id: sessionExercise.id,
          exerciseId: sessionExercise.exerciseId,
          exerciseName: exercise.name,
          youtubeVideoId: exercise.youtubeVideoId,
          videoOrientation: exercise.videoOrientation,
          order: sessionExercise.order,
        })
        .from(sessionExercise)
        .innerJoin(exercise, eq(sessionExercise.exerciseId, exercise.id))
        .where(eq(sessionExercise.sessionId, input.id))
        .orderBy(asc(sessionExercise.order))

      // Metadata desde el snapshot JSON (descanso, circuito, ronda) por posición
      const flat = flattenContent(session.content)
      const metaFor = (order: number, exerciseId: string) => {
        const m = flat[order]
        return m && m.exerciseId === exerciseId ? m : null
      }

      const exercisesWithTargets = await Promise.all(
        exercises.map(async (ex) => {
          const targets = await db
            .select()
            .from(sessionSetTarget)
            .where(eq(sessionSetTarget.sessionExerciseId, ex.id))
            .orderBy(asc(sessionSetTarget.setNumber))
          const meta = metaFor(ex.order, ex.exerciseId)
          return {
            ...ex,
            blockName: meta?.blockName ?? null,
            rounds: meta?.rounds ?? 1,
            roundNumber: meta?.roundNumber ?? null,
            perSide: meta?.perSide === true,
            targets,
          }
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

      // Ejercicios de la sesión + los del snapshot (pueden diferir si se agregaron sobre la marcha)
      const zones = await exerciseZones([
        ...exercises.map((e) => e.exerciseId),
        ...flat.map((e) => e.exerciseId),
      ])
      const zoneProfile = zoneProfileFromContent(session.content, (id) => zones.get(id))

      // ¿Puede quien consulta iniciarla ahora? (para mostrar u ocultar el botón de la vista previa)
      const mine = athletes.find((a) => a.athleteId === ctx.session.user.id)
      const category = r?.category ?? null
      const { locked, lockReason } = category === "evaluation" || mine
        ? (await lockFields(ctx.session.user.id, [{
            sessionId: session.id, scheduledDate: session.scheduledDate, position: session.position, category,
            sessionStatus: session.status, athleteStatus: mine?.status ?? "active",
          }], resolveAthleteToday(input.localDate)))(session.id)
        : { locked: false, lockReason: null }

      return {
        ...session,
        scheduledTime: toHHMM(session.scheduledTime),
        locked,
        lockReason,
        routineName: r?.name ?? null,
        routineCategory: category,
        zoneProfile,
        exercises: exercisesWithTargets.map((ex) => ({ ...ex, zone: zones.get(ex.exerciseId) ?? null })),
        athletes,
      }
    }),

  // Iniciar. Rechaza (BAD_REQUEST con `error.data.reason`): FUTURE_SESSION (fecha posterior a "hoy" del
  // atleta, ver resolveAthleteToday), PREVIOUS_STEP_PENDING y ANOTHER_ACTIVE (ver services/session-rules.ts).
  activate: protectedProcedure
    .input(z.object({ id: z.string().uuid(), localDate: localDateInput }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.id)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })

      const member = await assertMember(userId, session.teamId)
      const category = await assertSessionFeature(ctx.session.user, session.routineId)

      if (category === "training") {
        // En entrenamiento cada atleta activa su propia sesión
        const [as] = await db
          .select()
          .from(athleteSession)
          .where(and(eq(athleteSession.sessionId, input.id), eq(athleteSession.athleteId, userId)))
          .limit(1)
        if (!as) throw new TRPCError({ code: "FORBIDDEN" })
        if (as.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión ya fue iniciada" })
        if (session.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión fue cancelada" })

        const lock = await lockForSession(
          userId,
          { sessionId: session.id, scheduledDate: session.scheduledDate, position: session.position, isTraining: true, pending: true },
          resolveAthleteToday(input.localDate),
        )
        if (lock) throw startRefusalError(lock)

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
      // Las evaluaciones no forman secuencias, pero tampoco se inician antes de su fecha
      if (session.scheduledDate != null && session.scheduledDate > resolveAthleteToday(input.localDate)) throw startRefusalError("FUTURE")

      const [updated] = await db
        .update(trainingSession)
        .set({ status: "active" })
        .where(eq(trainingSession.id, input.id))
        .returning()
      return updated
    }),

  // El atleta salta un entrenamiento que aún no inició (su athlete_session pasa a "cancelled") para
  // desbloquear el siguiente del día. Solo hoy o antes (FUTURE_SESSION si es futuro); no aplica a evaluaciones.
  skipMyStep: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), localDate: localDateInput }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(userId, session.teamId)
      const category = await assertSessionFeature(ctx.session.user, session.routineId)
      if (category === "evaluation") throw new TRPCError({ code: "BAD_REQUEST", message: "Las evaluaciones no se pueden saltar" })

      const [as] = await db
        .select()
        .from(athleteSession)
        .where(and(eq(athleteSession.sessionId, input.sessionId), eq(athleteSession.athleteId, userId)))
        .limit(1)
      if (!as) throw new TRPCError({ code: "FORBIDDEN" })
      if (session.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión fue cancelada" })
      if (as.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "Solo puedes saltar un entrenamiento que aún no iniciaste" })
      if (session.scheduledDate != null && session.scheduledDate > resolveAthleteToday(input.localDate)) throw startRefusalError("FUTURE")

      const [updated] = await db.update(athleteSession).set({ status: "cancelled" }).where(eq(athleteSession.id, as.id)).returning()

      // Si ya nadie tiene pendiente la sesión, se cierra (completada si alguien la hizo; si no, cancelada)
      if (session.status === "active" || session.status === "scheduled") {
        const all = await db.select({ status: athleteSession.status }).from(athleteSession).where(eq(athleteSession.sessionId, input.sessionId))
        if (!all.some((a) => a.status === "active" || a.status === "scheduled")) {
          await db.update(trainingSession)
            .set({ status: all.some((a) => a.status === "completed") ? "completed" : "cancelled" })
            .where(eq(trainingSession.id, input.sessionId))
        }
      }
      return updated!
    }),

  athleteSets: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, session.teamId)
      await assertSessionFeature(ctx.session.user, session.routineId)

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

      // Coach puede registrar para cualquier atleta; atleta solo para sí mismo.
      // Si el coach registra para sí mismo (auto-entrenamiento), cuenta como atleta.
      const member = await assertMember(userId, session.teamId)
      await assertSessionFeature(ctx.session.user, session.routineId)
      const recordingForSelf = input.athleteId === userId
      if (member.role !== "coach" && !recordingForSelf) throw new TRPCError({ code: "FORBIDDEN" })
      if (member.role === "coach" && !recordingForSelf) {
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
      const { sessionStatus } = await loadSetForCoach(input.setId, ctx.session.user)
      if (sessionStatus !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "La sesión no está activa" })
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
      await loadSetForCoach(input.setId, ctx.session.user)
      const [updated] = await db.update(setRecord).set({ status: input.status }).where(eq(setRecord.id, input.setId)).returning()
      return updated
    }),

  deleteSet: protectedProcedure
    .input(z.object({ setId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadSetForCoach(input.setId, ctx.session.user)
      await db.delete(setRecord).where(eq(setRecord.id, input.setId))
    }),

  cancelAthlete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (!session) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, session.teamId)
      await assertSessionFeature(ctx.session.user, session.routineId)
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
      await assertSessionFeature(ctx.session.user, session.routineId)
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
      await assertSessionFeature(ctx.session.user, session.routineId)
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
      await assertSessionFeature(ctx.session.user, session.routineId)
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
      await assertSessionFeature(ctx.session.user, session.routineId)
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
      await assertSessionFeature(ctx.session.user, session.routineId)
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

      const category = await assertSessionFeature(ctx.session.user, session.routineId)

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
          const estimated = Number(s.weightLbs) * (1 + s.reps / 30)
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
        }).catch((err) => ctx.log.error({ err, ...params, sessionId: input.id, source: "auto" }, "report generation failed"))
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
      const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, input.sessionId)).limit(1)
      if (session) await assertSessionFeature(ctx.session.user, session.routineId)
      if (as.status === "completed") return as
      const [updated] = await db
        .update(athleteSession)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(athleteSession.id, as.id))
        .returning()

      // Auto-completar sesión de entrenamiento si todos los atletas terminaron
      if (session?.status === "active" && await getRoutineCategory(session.routineId) === "training") {
        const stillActive = await db
          .select({ id: athleteSession.id })
          .from(athleteSession)
          .where(and(eq(athleteSession.sessionId, input.sessionId), inArray(athleteSession.status, ["active", "scheduled"])))
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
      await assertAthleteInTeam(input.athleteId, session.teamId)

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
      await assertSessionFeature(ctx.session.user, session.routineId)
      const [updated] = await db.update(trainingSession).set({ status: "cancelled" }).where(eq(trainingSession.id, input.id)).returning()
      return updated
    }),
})
