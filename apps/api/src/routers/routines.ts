import { db } from "@atleta/db/client"
import { exercise, routine, type RoutineContent } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { aiRoutineInputSchema, generateRoutineWithAI } from "../services/ai-routines"
import { createTweakDeps } from "../services/ai-routine-editor/deps-real"
import { tweakInputSchema } from "../services/ai-routine-editor/input"
import { tweakRoutineWithAI } from "../services/ai-routine-editor/tweak"
import { routineContentSchema } from "../services/routine-content-schema"
import { exerciseZones, zoneProfiles } from "../services/body-zones"
import { assertExercisesVisible } from "../services/exercise-visibility"
import { canUseAiRoutines } from "../services/feature-access"
import { assertRoutineLimits } from "../services/routine-content-input"
import { assertFeature, hasFeature } from "../lib/features"
import { ErrorDetails } from "../mcp/errors"
import { createRateLimiter } from "../lib/rate-limit"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

// Límite por usuario para los ajustes (tweaks) con IA (en memoria, por proceso)
const TWEAK_RATE_MAX = 20
const TWEAK_RATE_WINDOW_MS = 10 * 60 * 1000
const tweakRateLimiter = createRateLimiter({ max: TWEAK_RATE_MAX, windowMs: TWEAK_RATE_WINDOW_MS })

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractExerciseIds(content: RoutineContent): string[] {
  return content.items.flatMap((item) =>
    item.type === "exercise"
      ? [item.exerciseId]
      : item.exercises.map((e) => e.exerciseId),
  )
}

// Clona el contenido de una rutina generando nuevos ids para cada item/ejercicio,
// ya que RoutineExerciseContent.id es referenciado por athleteSetCompletion.routineExerciseId.
function cloneRoutineContent(content: RoutineContent): RoutineContent {
  return {
    ...content,
    items: content.items.map((item) =>
      item.type === "exercise"
        ? { ...item, id: crypto.randomUUID(), sets: item.sets.map((s) => ({ ...s })) }
        : {
            ...item,
            id: crypto.randomUUID(),
            exercises: item.exercises.map((e) => ({ ...e, id: crypto.randomUUID(), sets: e.sets.map((s) => ({ ...s })) })),
          },
    ),
  }
}

// Cada ejercicio que el contenido nuevo agrega (no estaba en el anterior) debe ser visible
// para quien edita; así no se pueden referenciar ejercicios privados de otro equipo (y
// filtrar su información por routines.get). Los que ya estaban se respetan aunque hoy no
// sean visibles (p. ej. un ejercicio borrado después). `previous` null = rutina nueva.
async function assertNewExercisesVisible(
  previous: RoutineContent | null,
  next: RoutineContent,
  ctx: { userId: string; teamId: string },
) {
  const before = new Set(previous ? extractExerciseIds(previous) : [])
  const added = extractExerciseIds(next).filter((id) => !before.has(id))
  await assertExercisesVisible(added, ctx)
}

// Concurrencia optimista: bloquea la fila (SELECT … FOR UPDATE) dentro de la transacción y, si
// el cliente indicó la versión que leyó (`expectedUpdatedAt`), exige que siga siendo la actual.
// Si no coincide falla con CONFLICT y devuelve el updatedAt vigente en `details` (herramientas MCP).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const expectedUpdatedAtSchema = z.string().datetime({ offset: true }).optional()

async function lockRoutine(tx: Tx, id: string, expectedUpdatedAt: string | undefined) {
  const [r] = await tx.select().from(routine).where(eq(routine.id, id)).limit(1).for("update")
  if (!r) throw new TRPCError({ code: "NOT_FOUND" })
  return {
    routine: r,
    // Se comprueba después de los permisos para no revelar nada a quien no puede editarla
    assertVersion() {
      if (expectedUpdatedAt !== undefined && r.updatedAt.getTime() !== Date.parse(expectedUpdatedAt)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "La rutina cambió desde que la leíste.",
          cause: new ErrorDetails({ updatedAt: r.updatedAt.toISOString() }),
        })
      }
    },
  }
}

// Las rutinas de evaluación solo se pueden ver/tocar con el flag `evaluation`
function assertRoutineFeature(user: { id: string; email: string }, category: "evaluation" | "training") {
  if (category === "evaluation") assertFeature(user, "evaluation")
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const routinesRouter = router({
  create: protectedProcedure
    .input(z.object({
      teamId:   z.string().uuid(),
      name:     z.string().min(1),
      category: z.enum(["evaluation", "training"]).default("training"),
      // Opcional (herramientas MCP): la rutina nace con contenido en vez de vacía
      content:  routineContentSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      if (input.category === "evaluation") assertFeature(ctx.session.user, "evaluation")
      const content = input.content ?? { v: 1 as const, items: [] }
      if (input.content) {
        assertRoutineLimits(content)
        await assertNewExercisesVisible(null, content, { userId: ctx.session.user.id, teamId: input.teamId })
      }
      const [r] = await db
        .insert(routine)
        .values({ teamId: input.teamId, name: input.name, category: input.category, createdBy: ctx.session.user.id, content })
        .returning()
      return r
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      assertRoutineFeature(ctx.session.user, r.category)

      const [copy] = await db
        .insert(routine)
        .values({
          name: input.name ?? `${r.name} (copia)`,
          teamId: r.teamId,
          createdBy: ctx.session.user.id,
          category: r.category,
          content: cloneRoutineContent(r.content),
        })
        .returning()
      return copy
    }),

  list: protectedProcedure
    .input(z.object({
      teamId:   z.string().uuid(),
      category: z.enum(["evaluation", "training"]).optional(),
      // Las archivadas quedan fuera salvo que se pidan
      includeArchived: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const conditions = [eq(routine.teamId, input.teamId)]
      if (!input.includeArchived) conditions.push(isNull(routine.archivedAt))
      // Sin el flag las rutinas de evaluación quedan ocultas (no se borran)
      if (!hasFeature(ctx.session.user, "evaluation")) {
        if (input.category === "evaluation") return []
        conditions.push(eq(routine.category, "training"))
      }
      if (input.category) conditions.push(eq(routine.category, input.category))
      const rows = await db.select().from(routine).where(and(...conditions))
      const profiles = await zoneProfiles(rows.map((r) => r.content))
      return rows.map((r, i) => ({ ...r, zoneProfile: profiles[i] }))
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertMember(ctx.session.user.id, r.teamId)
      assertRoutineFeature(ctx.session.user, r.category)

      const exerciseIds = extractExerciseIds(r.content)
      const exercises = exerciseIds.length > 0
        ? await db
            .select({
              id: exercise.id,
              name: exercise.name,
              description: exercise.description,
              youtubeVideoId: exercise.youtubeVideoId,
              videoOrientation: exercise.videoOrientation,
            })
            .from(exercise)
            .where(inArray(exercise.id, exerciseIds))
        : []

      const zones = await exerciseZones(exerciseIds)
      const nameById = Object.fromEntries(exercises.map((e) => [e.id, e.name ?? "Ejercicio eliminado"]))
      const exerciseInfo = Object.fromEntries(exercises.map((e) => [e.id, { ...e, zone: zones.get(e.id) ?? null }]))
      return { ...r, exerciseNames: nameById, exerciseInfo }
    }),

  // `expectedUpdatedAt` (opcional): concurrencia optimista, CONFLICT si la rutina cambió desde esa
  // versión. `name` (opcional) renombra en la misma escritura (update_routine del MCP).
  updateContent: protectedProcedure
    .input(z.object({
      id:      z.string().uuid(),
      content: routineContentSchema,
      name:    z.string().min(1).optional(),
      expectedUpdatedAt: expectedUpdatedAtSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        const { routine: r, assertVersion } = await lockRoutine(tx, input.id, input.expectedUpdatedAt)
        await assertCoach(ctx.session.user.id, r.teamId)
        assertRoutineFeature(ctx.session.user, r.category)
        assertVersion()
        await assertNewExercisesVisible(r.content, input.content, { userId: ctx.session.user.id, teamId: r.teamId })

        const [updated] = await tx
          .update(routine)
          .set({ content: input.content, ...(input.name !== undefined && { name: input.name }), updatedAt: new Date() })
          .where(eq(routine.id, input.id))
          .returning()
        return updated!
      })
    }),

  // Archivar (sale de routines.list y no se puede asignar) o restaurar (`archived: false`)
  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      assertRoutineFeature(ctx.session.user, r.category)
      const now = new Date()
      const [updated] = await db
        .update(routine)
        .set({ archivedAt: input.archived ? (r.archivedAt ?? now) : null, updatedAt: now })
        .where(eq(routine.id, input.id))
        .returning()
      return updated!
    }),

  aiAvailable: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      return canUseAiRoutines(ctx.session.user, input.teamId)
    }),

  // Experimental: devuelve una propuesta; el entrenador la revisa y guarda con updateContent
  generateWithAI: protectedProcedure
    .input(aiRoutineInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      if (!canUseAiRoutines(ctx.session.user, input.teamId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La generación con IA no está habilitada para este equipo" })
      }
      const result = await generateRoutineWithAI(input, ctx.session.user.id, ctx.log)
      return { ...result, content: routineContentSchema.parse(result.content) }
    }),

  // Experimental (flag ai_routine_tweaks): AI Routine Editor. Un tweak = una tarea, sin historial. No guarda
  // nada: devuelve una pregunta de aclaración (máx. una) o la propuesta (mensaje, contenido y cambios);
  // el cliente aplica al borrador y guarda con updateContent.
  tweakWithAI: protectedProcedure
    .input(tweakInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      assertFeature(ctx.session.user, "ai_routine_tweaks")
      if (!canUseAiRoutines(ctx.session.user, input.teamId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La IA para rutinas no está habilitada para este equipo" })
      }
      const limit = tweakRateLimiter.hit(ctx.session.user.id)
      if (!limit.ok) {
        ctx.log.warn({ userId: ctx.session.user.id, retryAfterSeconds: limit.retryAfterSeconds }, "[ai-routines] tweak limitado por tasa")
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Demasiados ajustes con IA seguidos. Intenta de nuevo en ${limit.retryAfterSeconds} s.` })
      }
      return tweakRoutineWithAI(input, ctx.session.user.id, ctx.log, createTweakDeps())
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1), expectedUpdatedAt: expectedUpdatedAtSchema }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        const { routine: r, assertVersion } = await lockRoutine(tx, input.id, input.expectedUpdatedAt)
        await assertCoach(ctx.session.user.id, r.teamId)
        assertRoutineFeature(ctx.session.user, r.category)
        assertVersion()
        const [updated] = await tx
          .update(routine)
          .set({ name: input.name, updatedAt: new Date() })
          .where(eq(routine.id, input.id))
          .returning()
        return updated!
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)
      if (!r) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, r.teamId)
      assertRoutineFeature(ctx.session.user, r.category)
      await db.delete(routine).where(eq(routine.id, input.id))
    }),
})
