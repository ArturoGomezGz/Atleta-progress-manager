import { router } from "../trpc"
import { exercisesRouter } from "./exercises"
import { featuresRouter } from "./features"
import { groupsRouter } from "./groups"
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
  share: shareRouter,
})

export type AppRouter = typeof appRouter
