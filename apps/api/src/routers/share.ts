import { db } from "@atleta/db/client"
import {
  athleteSession,
  exercise,
  guestSetRecord,
  guestWorkout,
  routine,
  routineShare,
  sessionExercise,
  sessionSetTarget,
  setRecord,
  team,
  teamMember,
  trainingSession,
  user,
  type RoutineContent,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm"
import { randomBytes } from "node:crypto"
import { z } from "zod"
import { flattenContent, targetsForExercise } from "../services/routine-content"
import { protectedProcedure, publicProcedure, router } from "../trpc"
import { assertCoach } from "./teams"

// ─── Códigos ──────────────────────────────────────────────────────────────────

// Sin 0/O/1/I para que el código pueda dictarse por teléfono sin ambigüedad
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 8

function generateCode(): string {
  // Rejection sampling: 256 no es múltiplo de 32, pero sí lo es 224 (7 × 32),
  // así que descartar los bytes ≥ 224 mantiene la distribución uniforme.
  let out = ""
  while (out.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte >= 224) continue
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      if (out.length === CODE_LENGTH) break
    }
  }
  return out
}

const codeSchema = z.string().trim().toUpperCase().length(CODE_LENGTH).regex(/^[A-Z2-9]+$/)
const tokenSchema = z.string().length(48).regex(/^[a-f0-9]+$/)

// Tope de entrenamientos por enlace y hora: evita que un enlace público sea
// usado para inflar la base de datos. Muy por encima de cualquier uso real.
const MAX_STARTS_PER_HOUR = 300

// ─── Forma de los datos que consume el ejecutor de rutinas ────────────────────
//
// Replica la salida de `sessions.myProgress` para que la misma UI sirva a un
// atleta con cuenta y a un invitado. Como todavía no existen filas de
// `session_exercise` / `session_set_target`, los ids se derivan de la posición
// en el contenido aplanado: `e{order}` y `e{order}s{setNumber}`.

const exerciseKey = (order: number) => `e${order}`
const targetKey = (order: number, setNumber: number) => `e${order}s${setNumber}`

async function buildProgress(options: {
  content: RoutineContent
  routineName: string
  workoutId: string
  status: string
  startedAt: Date
  sets: Array<{ id: string; exerciseId: string; exerciseOrder: number; setNumber: number; reps: number; weightLbs: string }>
}) {
  const flat = flattenContent(options.content)
  const exerciseIds = [...new Set(flat.map((f) => f.exerciseId))]
  // Alternativas del snapshot: se resuelven junto al catálogo principal, con el mismo select.
  const alternativeIds = flat.map((f) => f.alternative?.exerciseId).filter((id): id is string => !!id)
  const allIds = [...new Set([...exerciseIds, ...alternativeIds])]

  const catalog = allIds.length
    ? await db
        .select({
          id: exercise.id,
          name: exercise.name,
          description: exercise.description,
          youtubeVideoId: exercise.youtubeVideoId,
          youtubeTitle: exercise.youtubeTitle,
          videoOrientation: exercise.videoOrientation,
        })
        .from(exercise)
        .where(inArray(exercise.id, allIds))
    : []
  const infoById = new Map(catalog.map((e) => [e.id, e]))

  return {
    id: options.workoutId,
    status: options.status,
    startedAt: options.startedAt,
    routineName: options.routineName,
    exercises: flat.map((ex, order) => {
      const info = infoById.get(ex.exerciseId)
      const altInfo = ex.alternative ? infoById.get(ex.alternative.exerciseId) : undefined
      return {
        id: exerciseKey(order),
        exerciseId: ex.exerciseId,
        exerciseName: info?.name ?? "Ejercicio",
        description: info?.description ?? null,
        youtubeVideoId: info?.youtubeVideoId ?? null,
        youtubeTitle: info?.youtubeTitle ?? null,
        videoOrientation: info?.videoOrientation ?? ("horizontal" as const),
        order,
        tempo: ex.tempo ?? null,
        restSeconds: ex.restSeconds ?? null,
        notes: ex.notes ?? null,
        blockId: ex.blockId,
        blockName: ex.blockName,
        rounds: ex.rounds,
        roundNumber: ex.roundNumber,
        alternative: altInfo ? {
          exerciseId: altInfo.id,
          exerciseName: altInfo.name,
          description: altInfo.description,
          youtubeVideoId: altInfo.youtubeVideoId,
          youtubeTitle: altInfo.youtubeTitle,
          videoOrientation: altInfo.videoOrientation,
          notes: ex.alternative?.notes ?? null,
        } : null,
        targets: targetsForExercise(ex.sets).map((t) => ({
          ...t,
          id: targetKey(order, t.setNumber),
          sessionExerciseId: exerciseKey(order),
        })),
        sets: options.sets
          .filter((s) => s.exerciseOrder === order)
          .map((s) => ({
            id: s.id,
            sessionExerciseId: exerciseKey(order),
            sessionSetTargetId: targetKey(order, s.setNumber),
            setNumber: s.setNumber,
            reps: s.reps,
            weightLbs: s.weightLbs,
            status: "valid" as const,
            // guest_set_record no tiene columna propia: si el ejercicio grabado no es
            // el planeado, es porque el invitado cambió a la alternativa.
            performedExerciseId: s.exerciseId !== ex.exerciseId ? s.exerciseId : null,
          })),
      }
    }),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findActiveShare(code: string) {
  const [share] = await db
    .select({
      id: routineShare.id,
      routineId: routineShare.routineId,
      teamId: routineShare.teamId,
      code: routineShare.code,
      routineName: routine.name,
      routineContent: routine.content,
      routineCategory: routine.category,
      teamName: team.name,
      teamLogoDataUrl: team.logoDataUrl,
      coachName: user.name,
    })
    .from(routineShare)
    .innerJoin(routine, eq(routineShare.routineId, routine.id))
    .innerJoin(team, eq(routineShare.teamId, team.id))
    .innerJoin(user, eq(routineShare.createdBy, user.id))
    .where(and(eq(routineShare.code, code), isNull(routineShare.revokedAt)))
    .limit(1)

  if (!share) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Este enlace ya no está disponible" })
  }
  return share
}

async function loadWorkout(token: string) {
  const [workout] = await db.select().from(guestWorkout).where(eq(guestWorkout.token, token)).limit(1)
  if (!workout) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos este entrenamiento" })
  return workout
}

/**
 * Equipo donde queda registrado el entrenamiento reclamado.
 *
 * Preferimos el equipo del coach que compartió la rutina — es lo que ambos
 * esperan. Si ese equipo ya llegó a su límite de atletas, el entrenamiento no
 * se pierde: se guarda en el equipo personal del usuario (creándolo si hace
 * falta), que es exactamente lo que obtendría creando un equipo por su cuenta.
 */
async function resolveClaimTeam(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  userName: string,
  shareTeamId: string,
) {
  const [existing] = await tx
    .select()
    .from(teamMember)
    .where(and(eq(teamMember.teamId, shareTeamId), eq(teamMember.userId, userId)))
    .limit(1)
  if (existing) return { teamId: shareTeamId, joinedTeam: false, personal: false }

  const [teamData] = await tx.select().from(team).where(eq(team.id, shareTeamId)).limit(1)
  const [{ athleteCount }] = await tx
    .select({ athleteCount: count() })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, shareTeamId), eq(teamMember.role, "athlete")))

  if (teamData && athleteCount < teamData.maxAthletes) {
    await tx.insert(teamMember).values({ teamId: shareTeamId, userId, role: "athlete" })
    return { teamId: shareTeamId, joinedTeam: true, personal: false }
  }

  // Equipo personal: reutilizamos el que ya tenga si entrena por su cuenta
  const [ownTeam] = await tx
    .select({ teamId: teamMember.teamId })
    .from(teamMember)
    .where(and(eq(teamMember.userId, userId), eq(teamMember.role, "coach"), eq(teamMember.selfAthlete, true)))
    .limit(1)
  if (ownTeam) return { teamId: ownTeam.teamId, joinedTeam: false, personal: true }

  const [newTeam] = await tx.insert(team).values({ name: `Entrenamientos de ${userName}` }).returning()
  await tx.insert(teamMember).values({ teamId: newTeam.id, userId, role: "coach", selfAthlete: true })
  return { teamId: newTeam.id, joinedTeam: false, personal: true }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const shareRouter = router({
  // ── Coach ──────────────────────────────────────────────────────────────────

  /** Enlace activo de una rutina, con el resumen de lo que ha generado. */
  forRoutine: protectedProcedure
    .input(z.object({ routineId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)

      const [share] = await db
        .select()
        .from(routineShare)
        .where(and(eq(routineShare.routineId, input.routineId), isNull(routineShare.revokedAt)))
        .orderBy(desc(routineShare.createdAt))
        .limit(1)
      if (!share) return null

      const [stats] = await db
        .select({
          started: count(),
          completed: sql<number>`count(*) filter (where ${guestWorkout.status} <> 'active')::int`,
          claimed: sql<number>`count(*) filter (where ${guestWorkout.claimedBy} is not null)::int`,
        })
        .from(guestWorkout)
        .where(eq(guestWorkout.shareId, share.id))

      return { code: share.code, createdAt: share.createdAt, stats }
    }),

  /** Crea el enlace (o devuelve el vigente). Solo rutinas de entrenamiento: las
   *  de evaluación las registra el coach en persona. */
  createLink: protectedProcedure
    .input(z.object({ routineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)

      if (r.category !== "training") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo puedes compartir rutinas de entrenamiento",
        })
      }
      if (r.content.items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Agrega ejercicios antes de compartir la rutina" })
      }

      const [existing] = await db
        .select()
        .from(routineShare)
        .where(and(eq(routineShare.routineId, input.routineId), isNull(routineShare.revokedAt)))
        .limit(1)
      if (existing) return { code: existing.code }

      const [share] = await db
        .insert(routineShare)
        .values({
          routineId: input.routineId,
          teamId: r.teamId,
          code: generateCode(),
          createdBy: ctx.session.user.id,
        })
        .returning()
      return { code: share.code }
    }),

  /** Desactiva el enlace. Los entrenamientos ya hechos se conservan. */
  revokeLink: protectedProcedure
    .input(z.object({ routineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)

      await db
        .update(routineShare)
        .set({ revokedAt: new Date() })
        .where(and(eq(routineShare.routineId, input.routineId), isNull(routineShare.revokedAt)))
    }),

  /**
   * Enlaces activos del equipo, para mostrarlos junto a las sesiones en curso:
   * un `routine_share` sin revocar es, para el entrenador, una "sesión" abierta
   * mientras nadie sabe cuántos invitados van a pasar por ella.
   */
  listForTeam: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)

      const shares = await db
        .select({
          id: routineShare.id,
          routineId: routineShare.routineId,
          code: routineShare.code,
          createdAt: routineShare.createdAt,
          routineName: routine.name,
        })
        .from(routineShare)
        .innerJoin(routine, eq(routineShare.routineId, routine.id))
        .where(and(eq(routineShare.teamId, input.teamId), isNull(routineShare.revokedAt)))
        .orderBy(desc(routineShare.createdAt))

      if (shares.length === 0) return []

      const shareIds = shares.map((s) => s.id)
      const stats = await db
        .select({
          shareId: guestWorkout.shareId,
          started: count(),
          completed: sql<number>`count(*) filter (where ${guestWorkout.status} <> 'active')::int`,
          claimed: sql<number>`count(*) filter (where ${guestWorkout.claimedBy} is not null)::int`,
        })
        .from(guestWorkout)
        .where(inArray(guestWorkout.shareId, shareIds))
        .groupBy(guestWorkout.shareId)
      const statsByShare = new Map(stats.map((s) => [s.shareId, s]))

      return shares.map((s) => ({
        ...s,
        stats: statsByShare.get(s.id) ?? { started: 0, completed: 0, claimed: 0 },
      }))
    }),

  /** Detalle de asistencia de un enlace: cada entrenamiento, quién lo hizo y cuánto avanzó. */
  attendance: protectedProcedure
    .input(z.object({ routineId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.routineId)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)

      const [share] = await db
        .select()
        .from(routineShare)
        .where(and(eq(routineShare.routineId, input.routineId), isNull(routineShare.revokedAt)))
        .limit(1)
      if (!share) return null

      const workouts = await db
        .select({
          id: guestWorkout.id,
          status: guestWorkout.status,
          startedAt: guestWorkout.startedAt,
          completedAt: guestWorkout.completedAt,
          content: guestWorkout.content,
          claimedByName: user.name,
        })
        .from(guestWorkout)
        .leftJoin(user, eq(guestWorkout.claimedBy, user.id))
        .where(eq(guestWorkout.shareId, share.id))
        .orderBy(desc(guestWorkout.startedAt))

      const workoutIds = workouts.map((w) => w.id)
      const setCounts = workoutIds.length
        ? await db
            .select({ guestWorkoutId: guestSetRecord.guestWorkoutId, n: count() })
            .from(guestSetRecord)
            .where(inArray(guestSetRecord.guestWorkoutId, workoutIds))
            .groupBy(guestSetRecord.guestWorkoutId)
        : []
      const doneByWorkout = new Map(setCounts.map((c) => [c.guestWorkoutId, c.n]))

      return {
        code: share.code,
        createdAt: share.createdAt,
        routineName: r.name,
        workouts: workouts.map((w) => ({
          id: w.id,
          status: w.status,
          startedAt: w.startedAt,
          completedAt: w.completedAt,
          claimedByName: w.claimedByName,
          doneSets: doneByWorkout.get(w.id) ?? 0,
          // Snapshot propio de este entrenamiento: si el coach editó la
          // plantilla entre dos invitados, cada uno se compara contra el suyo.
          totalSets: flattenContent(w.content).reduce((n, e) => n + e.sets.length, 0),
        })),
      }
    }),

  // ── Invitado (sin cuenta) ──────────────────────────────────────────────────

  /** Vista previa de la rutina antes de empezar. No crea nada. */
  preview: publicProcedure
    .input(z.object({ code: codeSchema }))
    .query(async ({ input }) => {
      const share = await findActiveShare(input.code)
      const progress = await buildProgress({
        content: share.routineContent,
        routineName: share.routineName,
        workoutId: share.code,
        status: "scheduled",
        startedAt: new Date(),
        sets: [],
      })
      return {
        ...progress,
        teamName: share.teamName,
        teamLogoDataUrl: share.teamLogoDataUrl,
        coachName: share.coachName,
      }
    }),

  /** Empieza el entrenamiento. Devuelve el token que el navegador guarda. */
  start: publicProcedure
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ input }) => {
      const share = await findActiveShare(input.code)

      const [{ recent }] = await db
        .select({ recent: count() })
        .from(guestWorkout)
        .where(
          and(
            eq(guestWorkout.shareId, share.id),
            gte(guestWorkout.startedAt, new Date(Date.now() - 60 * 60 * 1000)),
          ),
        )
      if (recent >= MAX_STARTS_PER_HOUR) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Este enlace recibió demasiadas visitas. Inténtalo en un rato.",
        })
      }

      const [workout] = await db
        .insert(guestWorkout)
        .values({
          shareId: share.id,
          routineId: share.routineId,
          teamId: share.teamId,
          token: randomBytes(24).toString("hex"),
          routineName: share.routineName,
          // Snapshot: el invitado termina la rutina como estaba al empezar
          content: share.routineContent,
        })
        .returning()

      return { token: workout.token }
    }),

  /** Estado del entrenamiento del invitado, en el mismo formato que myProgress. */
  workout: publicProcedure
    .input(z.object({ token: tokenSchema }))
    .query(async ({ input }) => {
      const workout = await loadWorkout(input.token)
      const sets = await db
        .select()
        .from(guestSetRecord)
        .where(eq(guestSetRecord.guestWorkoutId, workout.id))
        .orderBy(asc(guestSetRecord.exerciseOrder), asc(guestSetRecord.setNumber))

      const progress = await buildProgress({
        content: workout.content,
        routineName: workout.routineName,
        workoutId: workout.id,
        status: workout.status === "active" ? "active" : "completed",
        startedAt: workout.startedAt,
        sets,
      })
      return { ...progress, claimed: workout.claimedBy != null }
    }),

  recordSet: publicProcedure
    .input(z.object({
      token: tokenSchema,
      exerciseOrder: z.number().int().min(0),
      setNumber: z.number().int().min(1),
      reps: z.number().int().min(0).max(1000),
      weightLbs: z.string().default("0"),
      // Ejercicio realmente ejecutado si el invitado cambió a la alternativa. null = el planeado.
      performedExerciseId: z.string().uuid().nullable().default(null),
    }))
    .mutation(async ({ input }) => {
      const workout = await loadWorkout(input.token)
      if (workout.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este entrenamiento ya terminó" })
      }

      // La serie debe existir en el snapshot: acota lo que un enlace público
      // puede escribir a exactamente las series que el coach planeó.
      const flat = flattenContent(workout.content)
      const planned = flat[input.exerciseOrder]
      if (!planned || input.setNumber > planned.sets.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esa serie no existe en la rutina" })
      }

      if (input.performedExerciseId && input.performedExerciseId !== planned.alternative?.exerciseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esa alternativa no está definida para este ejercicio" })
      }
      // guest_set_record no tiene columna propia para el ejercicio realmente hecho:
      // el id que se guarda como exerciseId ya representa esa elección.
      const performedExerciseId = input.performedExerciseId ?? planned.exerciseId

      const weightLbs = Number(input.weightLbs)
      if (!Number.isFinite(weightLbs) || weightLbs < 0 || weightLbs > 9999) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Peso no válido" })
      }

      // Reintentar la misma serie actualiza en vez de duplicar
      const [existing] = await db
        .select({ id: guestSetRecord.id })
        .from(guestSetRecord)
        .where(
          and(
            eq(guestSetRecord.guestWorkoutId, workout.id),
            eq(guestSetRecord.exerciseOrder, input.exerciseOrder),
            eq(guestSetRecord.setNumber, input.setNumber),
          ),
        )
        .limit(1)

      if (existing) {
        await db
          .update(guestSetRecord)
          .set({ reps: input.reps, weightLbs: weightLbs.toFixed(2), exerciseId: performedExerciseId })
          .where(eq(guestSetRecord.id, existing.id))
        return { id: existing.id }
      }

      const [created] = await db
        .insert(guestSetRecord)
        .values({
          guestWorkoutId: workout.id,
          exerciseId: performedExerciseId,
          exerciseOrder: input.exerciseOrder,
          setNumber: input.setNumber,
          reps: input.reps,
          weightLbs: weightLbs.toFixed(2),
        })
        .returning({ id: guestSetRecord.id })
      return { id: created.id }
    }),

  complete: publicProcedure
    .input(z.object({ token: tokenSchema }))
    .mutation(async ({ input }) => {
      const workout = await loadWorkout(input.token)
      if (workout.status === "active") {
        await db
          .update(guestWorkout)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(guestWorkout.id, workout.id))
      }

      const [{ sets }] = await db
        .select({ sets: count() })
        .from(guestSetRecord)
        .where(eq(guestSetRecord.guestWorkoutId, workout.id))

      return {
        routineName: workout.routineName,
        exercises: flattenContent(workout.content).length,
        sets,
        claimed: workout.claimedBy != null,
      }
    }),

  // ── Con cuenta ─────────────────────────────────────────────────────────────

  /**
   * Convierte el entrenamiento anónimo en una sesión real del usuario: ya con
   * cuenta, su primer entrenamiento aparece en su historial desde el minuto uno.
   */
  claim: protectedProcedure
    .input(z.object({ token: tokenSchema }))
    .mutation(async ({ ctx, input }) => {
      const workout = await loadWorkout(input.token)

      if (workout.claimedBy && workout.claimedBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este entrenamiento ya fue guardado por otra cuenta" })
      }

      if (workout.claimedBy === ctx.session.user.id) {
        // El equipo lo dicta la sesión creada al reclamar, que pudo ser el
        // espacio personal y no el del coach.
        const [previous] = workout.claimedSessionId
          ? await db
              .select({ teamId: trainingSession.teamId })
              .from(trainingSession)
              .where(eq(trainingSession.id, workout.claimedSessionId))
              .limit(1)
          : []
        const teamId = previous?.teamId ?? workout.teamId
        const [teamData] = await db.select({ name: team.name }).from(team).where(eq(team.id, teamId)).limit(1)
        return {
          sessionId: workout.claimedSessionId,
          teamId,
          teamName: teamData?.name ?? null,
          alreadyClaimed: true,
          joinedTeam: false,
          personalTeam: false,
        }
      }

      const sets = await db
        .select()
        .from(guestSetRecord)
        .where(eq(guestSetRecord.guestWorkoutId, workout.id))
        .orderBy(asc(guestSetRecord.exerciseOrder), asc(guestSetRecord.setNumber))

      const flat = flattenContent(workout.content)

      const { sessionId, target } = await db.transaction(async (tx) => {
        // Tomamos el entrenamiento primero y solo si sigue sin dueño: dos
        // pestañas reclamando a la vez no pueden generar dos sesiones.
        const locked = await tx
          .update(guestWorkout)
          .set({
            status: "claimed",
            claimedBy: ctx.session.user.id,
            claimedAt: new Date(),
            completedAt: workout.completedAt ?? new Date(),
          })
          .where(and(eq(guestWorkout.id, workout.id), isNull(guestWorkout.claimedBy)))
          .returning({ id: guestWorkout.id })
        if (locked.length === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Este entrenamiento ya fue guardado" })
        }

        const target = await resolveClaimTeam(tx, ctx.session.user.id, ctx.session.user.name, workout.teamId)

        const [session] = await tx
          .insert(trainingSession)
          .values({
            // La rutina vive en el equipo del coach: si el entrenamiento se
            // guarda en el equipo personal, no se referencia para no cruzar datos.
            routineId: target.personal ? null : workout.routineId,
            teamId: target.teamId,
            startedBy: ctx.session.user.id,
            startedAt: workout.startedAt,
            status: "completed",
            content: workout.content,
          })
          .returning()

        // Mismo snapshot que una sesión normal: el historial se lee igual
        const exerciseRowIdByOrder = new Map<number, string>()
        const targetRowIdByKey = new Map<string, string>()

        for (const [order, ex] of flat.entries()) {
          const [se] = await tx
            .insert(sessionExercise)
            .values({ sessionId: session.id, exerciseId: ex.exerciseId, order })
            .returning()
          exerciseRowIdByOrder.set(order, se.id)

          const targets = targetsForExercise(ex.sets)
          if (targets.length > 0) {
            const inserted = await tx
              .insert(sessionSetTarget)
              .values(targets.map((t) => ({ ...t, sessionExerciseId: se.id })))
              .returning({ id: sessionSetTarget.id, setNumber: sessionSetTarget.setNumber })
            for (const row of inserted) targetRowIdByKey.set(targetKey(order, row.setNumber), row.id)
          }
        }

        const [as] = await tx
          .insert(athleteSession)
          .values({
            sessionId: session.id,
            athleteId: ctx.session.user.id,
            status: "completed",
            startedAt: workout.startedAt,
            completedAt: workout.completedAt ?? new Date(),
          })
          .returning()

        if (sets.length > 0) {
          await tx.insert(setRecord).values(
            sets.map((s) => ({
              athleteSessionId: as.id,
              sessionExerciseId: exerciseRowIdByOrder.get(s.exerciseOrder)!,
              sessionSetTargetId: targetRowIdByKey.get(targetKey(s.exerciseOrder, s.setNumber)) ?? null,
              setNumber: s.setNumber,
              reps: s.reps,
              weightLbs: s.weightLbs,
              recordedBy: ctx.session.user.id,
              recordedAt: s.recordedAt,
              // guest_set_record.exerciseId guarda el ejercicio realmente hecho; si no
              // coincide con el planeado en el snapshot, fue la alternativa.
              performedExerciseId: s.exerciseId !== flat[s.exerciseOrder]?.exerciseId ? s.exerciseId : null,
            })),
          )
        }

        await tx
          .update(guestWorkout)
          .set({ claimedSessionId: session.id })
          .where(eq(guestWorkout.id, workout.id))

        return { sessionId: session.id, target }
      })

      const [claimTeam] = await db.select({ name: team.name }).from(team).where(eq(team.id, target.teamId)).limit(1)

      return {
        sessionId,
        teamId: target.teamId,
        teamName: claimTeam?.name ?? null,
        alreadyClaimed: false,
        joinedTeam: target.joinedTeam,
        personalTeam: target.personal,
      }
    }),
})
