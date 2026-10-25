import { createCallerFactory, router } from "../trpc"
import { exercisesRouter } from "./exercises"
import { featuresRouter } from "./features"
import { groupsRouter } from "./groups"
import { mcpRouter } from "./mcp"
import { onboardingRouter } from "./onboarding"
import { plansRouter } from "./plans"
import { preferencesRouter } from "./preferences"
import { rmsRouter } from "./rms"
import { routinesRouter } from "./routines"
import { sessionsRouter } from "./sessions"
import { shareRouter } from "./share"
import { teamsRouter } from "./teams"

export const appRouter = router({
  teams: teamsRouter,
  exercises: exercisesRouter,
  features: featuresRouter,
  routines: routinesRouter,
  sessions: sessionsRouter,
  rms: rmsRouter,
  groups: groupsRouter,
  preferences: preferencesRouter,
  onboarding: onboardingRouter,
  share: shareRouter,
  mcp: mcpRouter,
  plans: plansRouter,
})

export type AppRouter = typeof appRouter

// Caller del servidor: las herramientas MCP llaman a los procedimientos con un contexto
// sintético del usuario (ver mcp/context.ts), así pasan por los mismos asserts que la web.
export const createCaller = createCallerFactory(appRouter)
