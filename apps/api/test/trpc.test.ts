import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { featureProcedure, protectedProcedure, router, type Context } from "../src/trpc"

// Cobertura de la frontera de autorización y del errorFormatter de src/trpc.ts.

const GENERIC_MESSAGE = "Ocurrió un error interno. Intenta de nuevo más tarde."
const PG_MESSAGE = 'duplicate key value violates unique constraint "user_email_key"'

const noopLog = { info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, child() { return noopLog } }

const anonCtx = { session: null, log: noopLog } as unknown as Context
const userCtx = {
  session: { user: { id: "user-1", email: "atleta@example.com" }, session: { id: "s-1" } },
  log: noopLog,
} as unknown as Context

const testRouter = router({
  protectedPing: protectedProcedure.query(() => "ok"),
  featurePing: featureProcedure("groups").query(() => "ok"),
  dbFailure: protectedProcedure.query(() => {
    throw new Error(PG_MESSAGE)
  }),
  businessError: protectedProcedure.query(() => {
    throw new TRPCError({ code: "BAD_REQUEST", message: "mensaje de negocio" })
  }),
})

const createCaller = testRouter.createCaller

// createCaller lanza el TRPCError crudo y no pasa por errorFormatter; para ver lo que
// recibe el cliente se ejecuta el router con el adaptador fetch, en memoria y sin red.
async function callOverHttp(path: string, ctx: Context) {
  const res = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://localhost/trpc/${path}`),
    router: testRouter,
    createContext: () => ctx,
  })
  return (await res.json()) as { error?: { message: string; data: Record<string, unknown> } }
}

const ENV_KEYS = ["NODE_ENV", "FEATURE_ALL_USERS", "FEATURE_GROUPS_USERS"] as const
let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  delete process.env.FEATURE_ALL_USERS
  delete process.env.FEATURE_GROUPS_USERS
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

describe("protectedProcedure", () => {
  it("rechaza con UNAUTHORIZED cuando no hay sesión", async () => {
    await assert.rejects(createCaller(anonCtx).protectedPing(), (err: unknown) => {
      assert.ok(err instanceof TRPCError)
      assert.equal(err.code, "UNAUTHORIZED")
      return true
    })
  })

  it("deja pasar cuando hay sesión", async () => {
    assert.equal(await createCaller(userCtx).protectedPing(), "ok")
  })
})

describe("featureProcedure", () => {
  it("rechaza cuando el flag está apagado para el usuario", async () => {
    process.env.FEATURE_GROUPS_USERS = "otra-persona@example.com"
    await assert.rejects(createCaller(userCtx).featurePing(), (err: unknown) => {
      assert.ok(err instanceof TRPCError)
      assert.equal(err.code, "FORBIDDEN")
      return true
    })
  })

  it("rechaza sin sesión aunque el flag esté activo para todos", async () => {
    process.env.FEATURE_GROUPS_USERS = "*"
    await assert.rejects(createCaller(anonCtx).featurePing(), (err: unknown) => {
      assert.ok(err instanceof TRPCError)
      assert.equal(err.code, "UNAUTHORIZED")
      return true
    })
  })

  it("deja pasar cuando el flag está activo para el usuario", async () => {
    process.env.FEATURE_GROUPS_USERS = "atleta@example.com"
    assert.equal(await createCaller(userCtx).featurePing(), "ok")
  })
})

describe("errorFormatter", () => {
  it("en producción oculta el mensaje y el stack de errores que no son TRPCError", async () => {
    process.env.NODE_ENV = "production"
    const body = await callOverHttp("dbFailure", userCtx)
    assert.ok(body.error)
    assert.equal(body.error.message, GENERIC_MESSAGE)
    assert.equal("stack" in body.error.data, false)
    assert.equal(JSON.stringify(body).includes("user_email_key"), false)
  })

  it("fuera de producción conserva el mensaje original", async () => {
    process.env.NODE_ENV = "development"
    const body = await callOverHttp("dbFailure", userCtx)
    assert.ok(body.error)
    assert.equal(body.error.message, PG_MESSAGE)
  })

  it("en producción conserva el mensaje de un TRPCError lanzado a mano", async () => {
    process.env.NODE_ENV = "production"
    const body = await callOverHttp("businessError", userCtx)
    assert.ok(body.error)
    assert.equal(body.error.message, "mensaje de negocio")
    assert.equal(body.error.data.code, "BAD_REQUEST")
  })
})
