import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { type Context, featureProcedure, protectedProcedure, publicProcedure, router } from "../src/trpc"

// Importar ../src/trpc arrastra ./auth y @atleta/db/client, pero postgres.js es perezoso:
// no abre conexión hasta la primera consulta. Ningún procedure de este router toca la DB,
// así que el contexto se arma a mano y no hace falta base de datos ni better-auth real.

const GENERIC_MESSAGE = "Ocurrió un error interno. Intenta de nuevo más tarde."

const noopLog = { info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, child() { return noopLog } }

function ctx(user: { id: string; email: string } | null): Context {
  return {
    session: user ? ({ user, session: { id: "s1", userId: user.id } } as unknown as NonNullable<Context["session"]>) : null,
    log: noopLog as unknown as Context["log"],
  }
}

const USER = { id: "user-1", email: "coach@example.com" }

const testRouter = router({
  ping: publicProcedure.query(() => "pong"),
  me: protectedProcedure.query(({ ctx }) => ctx.session.user.id),
  progress: featureProcedure("progress").query(() => "ok"),
  crashUnknown: publicProcedure.query(() => {
    throw new Error("pg: relation \"secret_table\" does not exist")
  }),
  crashInternalTRPC: publicProcedure.query(() => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La IA no logró generar el reporte" })
  }),
  crashForbidden: publicProcedure.query(() => {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a este equipo" })
  }),
})

type ErrorBody = { error: { message: string; data: { code: string; stack?: string } } }

// createCaller lanza el TRPCError original; el errorFormatter solo se aplica al serializar la
// respuesta. Se pasa la petición por el adapter fetch de tRPC para ver exactamente lo que recibe
// el cliente. Como isDev se fija al importar (NODE_ENV no es "production" en los tests), la forma
// base siempre trae `stack`: si sale sin él, es porque el errorFormatter lo quitó.
async function clientError(path: keyof typeof testRouter._def.procedures): Promise<ErrorBody["error"]> {
  const res = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://localhost/trpc/${path}`),
    router: testRouter,
    createContext: () => ctx(null),
  })
  assert.ok(!res.ok, "se esperaba una respuesta de error")
  return ((await res.json()) as ErrorBody).error
}

async function callAndCatch(fn: () => Promise<unknown>): Promise<TRPCError> {
  try {
    await fn()
  } catch (err) {
    assert.ok(err instanceof TRPCError, "se esperaba un TRPCError")
    return err
  }
  assert.fail("se esperaba que el procedure fallara")
}

const ENV_KEYS = ["NODE_ENV", "FEATURE_ALL_USERS", "FEATURE_PROGRESS_USERS", "FEATURE_EVALUATION_USERS"] as const
let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

describe("protectedProcedure", () => {
  it("rechaza con UNAUTHORIZED cuando no hay sesión", async () => {
    const err = await callAndCatch(() => testRouter.createCaller(ctx(null)).me())
    assert.equal(err.code, "UNAUTHORIZED")
  })

  it("deja pasar con sesión y expone el usuario", async () => {
    assert.equal(await testRouter.createCaller(ctx(USER)).me(), USER.id)
  })
})

describe("featureProcedure", () => {
  it("rechaza con UNAUTHORIZED antes de revisar la feature cuando no hay sesión", async () => {
    process.env.FEATURE_ALL_USERS = "*"
    const err = await callAndCatch(() => testRouter.createCaller(ctx(null)).progress())
    assert.equal(err.code, "UNAUTHORIZED")
  })

  it("rechaza con el FORBIDDEN de assertFeature cuando la feature no está activada", async () => {
    const err = await callAndCatch(() => testRouter.createCaller(ctx(USER)).progress())
    assert.equal(err.code, "FORBIDDEN")
    assert.equal(err.message, "Esta función aún no está disponible para tu cuenta")
  })

  it("rechaza si falta la dependencia de la feature (progress requiere evaluation)", async () => {
    process.env.FEATURE_PROGRESS_USERS = USER.email
    const err = await callAndCatch(() => testRouter.createCaller(ctx(USER)).progress())
    assert.equal(err.code, "FORBIDDEN")
  })

  it("deja pasar cuando la feature y sus dependencias están activadas", async () => {
    process.env.FEATURE_PROGRESS_USERS = USER.email
    process.env.FEATURE_EVALUATION_USERS = USER.id
    assert.equal(await testRouter.createCaller(ctx(USER)).progress(), "ok")
  })
})

describe("errorFormatter", () => {
  it("en producción oculta mensaje y stack de errores que no son TRPCError", async () => {
    process.env.NODE_ENV = "production"
    const error = await clientError("crashUnknown")
    assert.equal(error.data.code, "INTERNAL_SERVER_ERROR")
    assert.equal(error.message, GENERIC_MESSAGE)
    assert.ok(!("stack" in error.data), "no debe incluir stack")
    assert.ok(!JSON.stringify(error).includes("secret_table"), "no debe filtrar el mensaje original")
  })

  it("en producción conserva el mensaje de un TRPCError INTERNAL_SERVER_ERROR explícito", async () => {
    process.env.NODE_ENV = "production"
    const error = await clientError("crashInternalTRPC")
    assert.equal(error.data.code, "INTERNAL_SERVER_ERROR")
    assert.equal(error.message, "La IA no logró generar el reporte")
  })

  it("en producción conserva el mensaje de un TRPCError FORBIDDEN", async () => {
    process.env.NODE_ENV = "production"
    const error = await clientError("crashForbidden")
    assert.equal(error.data.code, "FORBIDDEN")
    assert.equal(error.message, "No tienes acceso a este equipo")
  })

  it("fuera de producción no oculta el mensaje original", async () => {
    process.env.NODE_ENV = "development"
    const error = await clientError("crashUnknown")
    assert.equal(error.message, "pg: relation \"secret_table\" does not exist")
    assert.ok(error.data.stack, "en desarrollo conserva el stack")
  })

  it("los procedures públicos siguen respondiendo con normalidad", async () => {
    assert.equal(await testRouter.createCaller(ctx(null)).ping(), "pong")
  })
})
