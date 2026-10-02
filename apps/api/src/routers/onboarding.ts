import { db } from "@atleta/db/client"
import { ONBOARDING_STEPS, athleteSession, routine, trainingSession, userPreferences, type OnboardingState } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"

// Onboarding de la web (docs/onboarding.md). El estado y el paso actual del tutorial viven en
// user_preferences.onboarding; además `get` calcula con datos existentes lo que la web necesita
// para guiar (entrenamiento creado, asignado propio, asignado terminado).
const stepSchema = z.enum(ONBOARDING_STEPS)

async function readState(userId: string): Promise<OnboardingState | null> {
  const [prefs] = await db
    .select({ onboarding: userPreferences.onboarding })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)
  return prefs?.onboarding ?? null
}

export const onboardingRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const state = await readState(userId)
    if (!state) return null
    if (state.status !== "active") return { status: state.status, teamId: state.teamId }

    const { teamId } = state
    // Entrenamientos que el usuario creó en el equipo, el más antiguo primero. Si los borra
    // todos, el tutorial vuelve a pedirle que cree uno.
    const own = await db
      .select({ id: routine.id, content: routine.content })
      .from(routine)
      .where(and(eq(routine.teamId, teamId), eq(routine.createdBy, userId), eq(routine.category, "training")))
      .orderBy(asc(routine.createdAt))
    const scope = own.map((r) => r.id)
    // El tutorial asigna el más reciente que ya tiene ejercicios (el que acaba de armar); si ninguno
    // los tiene aún, el más reciente
    const withExercises = own.filter((r) => r.content.items.length > 0)

    const mine = scope.length === 0 ? [] : await db
      .select({ sessionId: trainingSession.id, status: athleteSession.status })
      .from(athleteSession)
      .innerJoin(trainingSession, eq(athleteSession.sessionId, trainingSession.id))
      .where(and(
        eq(athleteSession.athleteId, userId),
        eq(trainingSession.teamId, teamId),
        inArray(trainingSession.routineId, scope),
        ne(trainingSession.status, "cancelled"),
        ne(athleteSession.status, "cancelled"),
      ))
    const pending = mine.find((s) => s.status === "active") ?? mine.find((s) => s.status === "scheduled")

    // Un valor guardado que ya no existe (o su ausencia, en estados anteriores al tutorial) = primer paso
    const parsed = stepSchema.safeParse(state.step)
    return {
      status: state.status,
      teamId,
      step: parsed.success ? parsed.data : ("create" as const),
      assignRoutineId: (withExercises[withExercises.length - 1] ?? own[own.length - 1])?.id ?? null,
      // El más reciente: es el que se está armando en el editor
      lastRoutineId: own[own.length - 1]?.id ?? null,
      hasRoutine: scope.length > 0,
      hasExercises: withExercises.length > 0,
      assigned: mine.length > 0,
      completed: mine.some((s) => s.status === "completed"),
      pendingSessionId: pending?.sessionId ?? null,
    }
  }),

  // Omitir ("dismissed"), reiniciar ("active", vuelve al primer paso, también tras omitir o
  // completar) o terminar ("completed"). Quien no tiene onboarding no puede crearlo desde aquí.
  setStatus: protectedProcedure
    .input(z.object({ status: z.enum(["active", "dismissed", "completed"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const state = await readState(userId)
      if (!state) throw new TRPCError({ code: "NOT_FOUND" })
      // Un onboarding ya completado solo cambia para reiniciarlo
      if (state.status === "completed" && input.status !== "active") return { status: state.status }
      const next: OnboardingState =
        input.status === "active"
          ? { status: "active", teamId: state.teamId, step: "create" }
          : { ...state, status: input.status }
      await db.update(userPreferences).set({ onboarding: next }).where(eq(userPreferences.userId, userId))
      return { status: input.status }
    }),

  // Guarda el paso actual del tutorial para retomarlo tras un refresh o en otro dispositivo.
  // Solo con el tutorial en curso: un paso tardío tras omitir no lo reactiva.
  setStep: protectedProcedure
    .input(z.object({ step: stepSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const state = await readState(userId)
      if (!state) throw new TRPCError({ code: "NOT_FOUND" })
      if (state.status !== "active") return { step: null }
      await db
        .update(userPreferences)
        .set({ onboarding: { ...state, step: input.step } })
        .where(eq(userPreferences.userId, userId))
      return { step: input.step }
    }),
})
