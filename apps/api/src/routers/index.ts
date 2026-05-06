import { router } from "../trpc"
import { exercisesRouter } from "./exercises"
import { rmsRouter } from "./rms"
import { routinesRouter } from "./routines"
import { sessionsRouter } from "./sessions"
import { teamsRouter } from "./teams"

export const appRouter = router({
  teams: teamsRouter,
  exercises: exercisesRouter,
  routines: routinesRouter,
  sessions: sessionsRouter,
  rms: rmsRouter,
})

export type AppRouter = typeof appRouter
