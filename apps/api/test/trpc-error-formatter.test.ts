import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { type TRPCDefaultErrorShape, TRPCError } from "@trpc/server"
import { errorFormatter } from "../src/trpc"

const GENERIC_MESSAGE = "Ocurrió un error interno. Intenta de nuevo más tarde."

function makeShape(message: string, code: number, httpStatus: number): TRPCDefaultErrorShape {
  return {
    message,
    code,
    data: {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus,
      path: "test.procedure",
      stack: "Error: detalle interno\n    at algo (archivo.ts:1:1)",
    },
  }
}

describe("errorFormatter", () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  })

  it("oculta mensaje y stack de un error interno envuelto en producción", () => {
    process.env.NODE_ENV = "production"
    const error = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      cause: new Error('relation "users" does not exist'),
    })
    const shape = makeShape('relation "users" does not exist', -32603, 500)

    const result = errorFormatter({ shape, error })

    assert.equal(result.message, GENERIC_MESSAGE)
    assert.equal("stack" in result.data, false)
    assert.equal(result.data.httpStatus, 500)
    assert.equal(result.data.path, "test.procedure")
  })

  it("devuelve el shape original fuera de producción", () => {
    for (const env of ["development", "test"]) {
      process.env.NODE_ENV = env
      const error = new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        cause: new Error("detalle interno"),
      })
      const shape = makeShape("detalle interno", -32603, 500)

      const result = errorFormatter({ shape, error })

      assert.equal(result, shape)
      assert.equal(result.message, "detalle interno")
      assert.equal(result.data.stack, shape.data.stack)
    }
  })

  it("conserva el mensaje de un TRPCError INTERNAL_SERVER_ERROR sin cause en producción", () => {
    process.env.NODE_ENV = "production"
    const error = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No se pudo generar la rutina",
    })
    assert.equal(error.cause, undefined)
    const shape = makeShape("No se pudo generar la rutina", -32603, 500)

    const result = errorFormatter({ shape, error })

    assert.equal(result, shape)
    assert.equal(result.message, "No se pudo generar la rutina")
  })

  it("no filtra errores con otro código aunque tengan cause en producción", () => {
    process.env.NODE_ENV = "production"
    for (const code of ["BAD_REQUEST", "FORBIDDEN"] as const) {
      const error = new TRPCError({ code, message: "mensaje de negocio", cause: new Error("x") })
      assert.notEqual(error.cause, undefined)
      const shape = makeShape("mensaje de negocio", -32600, 400)

      const result = errorFormatter({ shape, error })

      assert.equal(result, shape)
      assert.equal(result.message, "mensaje de negocio")
    }
  })
})
