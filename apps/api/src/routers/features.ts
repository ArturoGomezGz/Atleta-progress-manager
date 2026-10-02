import { activeFeatures } from "../lib/features"
import { protectedProcedure, router } from "../trpc"

export const featuresRouter = router({
  // Claves activas para el usuario autenticado; la web las usa para ocultar UI
  mine: protectedProcedure.query(({ ctx }) => activeFeatures(ctx.session.user)),
})
