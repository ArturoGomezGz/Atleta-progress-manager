import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError, type TRPCDefaultErrorShape } from "@trpc/server"
import { hideInternalErrors } from "../../src/lib/error-format"

const GENERIC_MESSAGE = "Ocurrió un error interno. Intenta de nuevo más tarde."

// Construye un shape con la misma forma que arma el defaultFormatter de tRPC.
function makeShape(error: TRPCError, httpStatus: number): TRPCDefaultErrorShape {
  return {
    message: error.message,
    code: httpStatus === 500 ? -32603 : -32003,
    data: {
      code: error.code,
      httpStatus,
      path: "routine.create",
      stack: "Error: stack interno\n    at db.ts:42",
    },
  }
}

describe("hideInternalErrors", () => {
  it("en producción oculta mensaje y stack de un INTERNAL_SERVER_ERROR con cause", () => {
    const error = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: 'duplicate key value violates unique constraint "user_email_key"',
      cause: new Error('duplicate key value violates unique constraint "user_email_key"'),
    })
    const shape = makeShape(error, 500)
    const out = hideInternalErrors(shape, error, "production")

    assert.equal(out.message, GENERIC_MESSAGE)
    assert.equal("stack" in out.data, false)
    assert.deepEqual(out.data, {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      path: "routine.create",
    })
    assert.equal(out.code, shape.code)
  })

  it("en producción conserva un INTERNAL_SERVER_ERROR sin cause (mensaje de negocio)", () => {
    const error = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "La IA no logró procesar el ajuste. Intenta de nuevo.",
    })
    const shape = makeShape(error, 500)
    const out = hideInternalErrors(shape, error, "production")

    assert.deepEqual(out, shape)
    assert.equal(out.message, "La IA no logró procesar el ajuste. Intenta de nuevo.")
  })

  it("en producción no toca otros códigos aunque tengan cause", () => {
    const error = new TRPCError({
      code: "FORBIDDEN",
      message: "No tienes acceso a este equipo",
      cause: new Error("detalle interno"),
    })
    const shape = makeShape(error, 403)
    const out = hideInternalErrors(shape, error, "production")

    assert.deepEqual(out, shape)
  })

  for (const nodeEnv of [undefined, "development"]) {
    it(`fuera de producción (${nodeEnv}) conserva mensaje y stack`, () => {
      const error = new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "relation \"foo\" does not exist",
        cause: new Error("relation \"foo\" does not exist"),
      })
      const shape = makeShape(error, 500)
      const out = hideInternalErrors(shape, error, nodeEnv)

      assert.deepEqual(out, shape)
      assert.equal(out.data.stack, shape.data.stack)
    })
  }
})
