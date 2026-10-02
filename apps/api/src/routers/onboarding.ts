import { db } from "@atleta/db/client"
import { athleteSession, routine, trainingSession, userPreferences } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"

// Onboarding de la web (docs/onboarding.md). El estado vive en user_preferences.onboarding;
// los pasos se calculan aquí con datos existentes, no se guardan.
export const onboardingRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const [prefs] = await db
      .select({ onboarding: userPreferences.onboarding })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1)
    const state = prefs?.onboarding
    if (!state) return null
    if (state.status === "completed") return { status: state.status, teamId: state.teamId }

    const { teamId } = state
    // Entrenamientos que el usuario creó en el equipo, el más antiguo primero. Si los borra
    // todos, el paso 1 vuelve a "Crea tu primer entrenamiento".
    const own = await db
      .select({ id: routine.id })
      .from(routine)
      .where(and(eq(routine.teamId, teamId), eq(routine.createdBy, userId), eq(routine.category, "training")))
      .orderBy(asc(routine.createdAt))
    const scope = own.map((r) => r.id)

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

    return {
      status: state.status,
      teamId,
      firstRoutineId: scope[0] ?? null,
      hasRoutine: scope.length > 0,
      assigned: mine.length > 0,
      completed: mine.some((s) => s.status === "completed"),
      pendingSessionId: pending?.sessionId ?? null,
    }
  }),

  // Cerrar ("dismissed"), reabrir ("active") o terminar ("completed"). Quien no tiene
  // onboarding no puede crearlo desde aquí, y uno completado no se reabre.
  setStatus: protectedProcedure
    .input(z.object({ status: z.enum(["active", "dismissed", "completed"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [prefs] = await db
        .select({ onboarding: userPreferences.onboarding })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1)
      const state = prefs?.onboarding
      if (!state) throw new TRPCError({ code: "NOT_FOUND" })
      if (state.status === "completed") return { status: state.status }
      await db
        .update(userPreferences)
        .set({ onboarding: { ...state, status: input.status } })
        .where(eq(userPreferences.userId, userId))
      return { status: input.status }
    }),
})
