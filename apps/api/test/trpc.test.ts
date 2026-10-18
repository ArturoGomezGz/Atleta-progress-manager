import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { TRPCError, type TRPCDefaultErrorShape } from "@trpc/server"
import { formatError } from "../src/trpc"

/** Shape por defecto que tRPC pasa al errorFormatter (incluye el stack fuera de producción). */
function defaultShape(error: TRPCError, jsonCode: number, httpStatus: number): TRPCDefaultErrorShape {
  return {
    message: error.message,
    code: jsonCode as TRPCDefaultErrorShape["code"],
    data: { code: error.code, httpStatus, path: "share.get", stack: error.stack },
  }
}

/** Lo que hace tRPC cuando un procedimiento lanza algo que no es TRPCError. */
function wrappedPostgresError() {
  const cause = new Error('relation "foo" does not exist')
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: cause.message, cause })
}

describe("formatError", () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  })

  it("en producción oculta mensaje y stack de un INTERNAL_SERVER_ERROR con causa", () => {
    process.env.NODE_ENV = "production"
    const error = wrappedPostgresError()
    const result = formatError({ shape: defaultShape(error, -32603, 500), error })

    assert.ok(!result.message.includes("does not exist"))
    assert.equal(result.message, "Ocurrió un error interno. Intenta de nuevo más tarde.")
    assert.ok(!("stack" in result.data))
    assert.equal(result.data.code, "INTERNAL_SERVER_ERROR")
  })

  it("en producción conserva el mensaje de un INTERNAL_SERVER_ERROR lanzado a mano sin causa", () => {
    process.env.NODE_ENV = "production"
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "algo salió mal en el servidor" })
    const result = formatError({ shape: defaultShape(error, -32603, 500), error })

    assert.equal(result.message, "algo salió mal en el servidor")
  })

  for (const env of ["production", "development", "test"]) {
    it(`conserva el mensaje de un FORBIDDEN con NODE_ENV=${env}`, () => {
      process.env.NODE_ENV = env
      const error = new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a este recurso" })
      const result = formatError({ shape: defaultShape(error, -32003, 403), error })

      assert.equal(result.message, "No tienes acceso a este recurso")
    })
  }

  for (const env of ["development", "test"]) {
    it(`con NODE_ENV=${env} deja pasar intacto un INTERNAL_SERVER_ERROR con causa`, () => {
      process.env.NODE_ENV = env
      const error = wrappedPostgresError()
      const shape = defaultShape(error, -32603, 500)
      const result = formatError({ shape, error })

      assert.equal(result.message, 'relation "foo" does not exist')
      assert.deepEqual(result, shape)
    })
  }
})
