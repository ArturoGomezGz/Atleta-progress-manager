import { TRPCError, initTRPC } from "@trpc/server"
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify"
import { fromNodeHeaders } from "better-auth/node"
import { auth } from "./auth"
import { hideInternalErrors } from "./lib/error-format"
import { assertFeature, type FeatureKey } from "./lib/features"

export async function createContext({ req }: CreateFastifyContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  return { session, log: req.log }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({
  // Oculta mensaje y stack de errores internos en producción (ver lib/error-format.ts).
  errorFormatter: ({ shape, error }) =>
    hideInternalErrors(shape, error, process.env.NODE_ENV),
})

export const router = t.router
export const publicProcedure = t.procedure

// Requires a valid session
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" })
  return next({ ctx: { session: ctx.session } })
})

// Requires a valid session and the feature flag enabled for that user
export const featureProcedure = (key: FeatureKey) =>
  protectedProcedure.use(({ ctx, next }) => {
    assertFeature(ctx.session.user, key)
    return next()
  })
