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

const t = initTRPC.context<Context>().create({
  // En producción no enviamos al cliente el mensaje ni el stack de errores internos
  // (p. ej. errores de Postgres); los demás códigos conservan su mensaje de negocio.
  // Solo se ocultan los errores que tRPC envolvió porque se lanzó algo que no era
  // TRPCError (en ese caso expone el original en `error.cause`); un TRPCError lanzado
  // a mano con INTERNAL_SERVER_ERROR y mensaje para el usuario se conserva.
  errorFormatter({ shape, error }) {
    const wrappedUnknownError = error.cause !== undefined
    if (
      error.code === "INTERNAL_SERVER_ERROR" &&
      wrappedUnknownError &&
      process.env.NODE_ENV === "production"
    ) {
      const { stack: _stack, ...data } = shape.data
      return {
        ...shape,
        message: "Ocurrió un error interno. Intenta de nuevo más tarde.",
        data,
      }
    }
    return shape
  },
})

export const router = t.router
export const publicProcedure = t.procedure

// Requires a valid session
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" })
  return next({ ctx: { session: ctx.session } })
})
