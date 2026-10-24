import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { ErrorDetails, McpToolError, toToolError } from "../../src/mcp/errors"
import { RoutineEditError } from "../../src/services/ai-routine-edits"

function body(err: unknown, opts?: { production?: boolean; requestId?: string }) {
  const r = toToolError(err, opts)
  assert.equal(r.isError, true)
  const error = (r.structuredContent as { error: { code: string; message: string; details?: Record<string, unknown> } }).error
  const text = (r.content[0] as { text: string }).text
  assert.equal(text, `${error.code}: ${error.message}`)
  return error
}

describe("toToolError", () => {
  it("mapea los códigos de TRPCError", () => {
    assert.equal(body(new TRPCError({ code: "FORBIDDEN" })).code, "FORBIDDEN")
    assert.equal(body(new TRPCError({ code: "UNAUTHORIZED" })).code, "FORBIDDEN")
    assert.equal(body(new TRPCError({ code: "NOT_FOUND" })).code, "NOT_FOUND")
    assert.equal(body(new TRPCError({ code: "BAD_REQUEST", message: "x" })).code, "BAD_REQUEST")
    assert.equal(body(new TRPCError({ code: "TOO_MANY_REQUESTS" })).code, "RATE_LIMITED")
    assert.equal(body(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "boom" }), { production: true }).code, "INTERNAL")
  })

  it("conserva el mensaje de negocio y usa uno por defecto si no hay", () => {
    assert.equal(body(new TRPCError({ code: "BAD_REQUEST", message: "Rutina archivada" })).message, "Rutina archivada")
    assert.match(body(new TRPCError({ code: "FORBIDDEN" })).message, /whoami/)
  })

  it("CONFLICT sugiere releer y expone los details de la causa", () => {
    const e = body(new TRPCError({ code: "CONFLICT", message: "La rutina cambió.", cause: new ErrorDetails({ updatedAt: "2026-01-01T00:00:00.000Z" }) }))
    assert.equal(e.code, "CONFLICT")
    assert.match(e.message, /get_routine/)
    assert.deepEqual(e.details, { updatedAt: "2026-01-01T00:00:00.000Z" })
  })

  it("ZodError (directo o como causa de BAD_REQUEST) → INVALID_INPUT con 3 issues como máximo", () => {
    const parsed = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() }).safeParse({})
    assert.equal(parsed.success, false)
    const direct = body(parsed.error)
    assert.equal(direct.code, "INVALID_INPUT")
    assert.equal((direct.details?.issues as unknown[]).length, 3)
    assert.match(direct.message, /y 1 más/)
    const wrapped = body(new TRPCError({ code: "BAD_REQUEST", cause: parsed.error }))
    assert.equal(wrapped.code, "INVALID_INPUT")
  })

  it("RoutineEditError → BAD_REQUEST y McpToolError conserva su código", () => {
    assert.equal(body(new RoutineEditError("No existe el ítem")).code, "BAD_REQUEST")
    const e = body(new McpToolError("AMBIGUOUS_TEAM", "Indica teamId", { teams: [] }))
    assert.equal(e.code, "AMBIGUOUS_TEAM")
    assert.deepEqual(e.details, { teams: [] })
  })

  it("INTERNAL no filtra el mensaje en producción e incluye el requestId", () => {
    const prod = body(new Error("password=hunter2 en postgres"), { production: true, requestId: "req-1" })
    assert.equal(prod.code, "INTERNAL")
    assert.doesNotMatch(prod.message, /hunter2/)
    assert.deepEqual(prod.details, { requestId: "req-1" })
    assert.match(body(new Error("detalle"), { production: false }).message, /detalle/)
  })
})
