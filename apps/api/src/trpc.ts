import { TRPCError, initTRPC } from "@trpc/server"
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify"
import { fromNodeHeaders } from "better-auth/node"
import { auth } from "./auth"

export async function createContext({ req }: CreateFastifyContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  return { session }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

// Requires a valid session
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" })
  return next({ ctx: { session: ctx.session } })
})
