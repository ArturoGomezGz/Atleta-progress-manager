import assert from "node:assert/strict"
import { afterEach, before, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

// trpc.ts importa auth.ts, que inicializa betterAuth y el cliente de Postgres al cargarse.
// postgres() no abre conexión hasta la primera consulta, así que una URL ficticia basta.
// Se carga con import dinámico para que estas variables existan antes de evaluar el módulo.
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret"
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test"

type Context = import("../src/trpc").Context

const GENERIC = "Ocurrió un error interno. Intenta de nuevo más tarde."
const AI_MESSAGE = "La IA no logró generar la rutina. Intenta de nuevo."

async function buildRouter() {
  const { router, publicProcedure, protectedProcedure } = await import("../src/trpc")
  return router({
    dbError: publicProcedure.query(() => {
      throw new Error('relation "user" does not exist')
    }),
    manualInternal: publicProcedure.query(() => {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: AI_MESSAGE })
    }),
    badRequest: publicProcedure.query(() => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Datos inválidos" })
    }),
    secret: protectedProcedure.query(() => "ok"),
  })
}

let appRouter: Awaited<ReturnType<typeof buildRouter>>
before(async () => {
  appRouter = await buildRouter()
})

const noop = () => {}
const log = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, child: () => log }

async function call(path: string) {
  const res = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://localhost/trpc/${path}`),
    router: appRouter,
    createContext: () => ({ session: null, log }) as unknown as Context,
    onError: noop,
  })
  const body = (await res.json()) as {
    error: { message: string; data: { code: string; httpStatus: number; stack?: string } }
  }
  return body.error
}

const originalEnv = process.env.NODE_ENV
afterEach(() => {
  process.env.NODE_ENV = originalEnv
})

describe("errorFormatter de tRPC", () => {
  it("en producción oculta el mensaje y el stack de un error no TRPCError", async () => {
    process.env.NODE_ENV = "production"
    const error = await call("dbError")
    assert.equal(error.data.code, "INTERNAL_SERVER_ERROR")
    assert.equal(error.message, GENERIC)
    assert.equal(error.data.stack, undefined)
    assert.doesNotMatch(JSON.stringify(error), /relation/)
  })

  it("en producción conserva el mensaje de un INTERNAL_SERVER_ERROR lanzado a mano", async () => {
    process.env.NODE_ENV = "production"
    const error = await call("manualInternal")
    assert.equal(error.data.code, "INTERNAL_SERVER_ERROR")
    assert.equal(error.message, AI_MESSAGE)
  })

  it("en producción conserva el mensaje de otros códigos", async () => {
    process.env.NODE_ENV = "production"
    const error = await call("badRequest")
    assert.equal(error.data.code, "BAD_REQUEST")
    assert.equal(error.message, "Datos inválidos")
  })

  it("fuera de producción expone el mensaje original", async () => {
    process.env.NODE_ENV = "development"
    const error = await call("dbError")
    assert.equal(error.data.code, "INTERNAL_SERVER_ERROR")
    assert.equal(error.message, 'relation "user" does not exist')
  })

  it("protectedProcedure sin sesión responde UNAUTHORIZED", async () => {
    const error = await call("secret")
    assert.equal(error.data.code, "UNAUTHORIZED")
    assert.equal(error.data.httpStatus, 401)
  })
})
