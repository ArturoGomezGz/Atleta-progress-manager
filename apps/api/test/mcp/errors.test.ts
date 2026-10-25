import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { ErrorDetails, McpToolError, ROUTINE_CONFLICT_HINT, toToolError } from "../../src/mcp/errors"
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

  it("CONFLICT añade la pista de la causa y expone solo sus details", () => {
    const e = body(new TRPCError({ code: "CONFLICT", message: "La rutina cambió.", cause: new ErrorDetails({ updatedAt: "2026-01-01T00:00:00.000Z" }, { hint: ROUTINE_CONFLICT_HINT }) }))
    assert.equal(e.code, "CONFLICT")
    assert.equal(e.message, `La rutina cambió. ${ROUTINE_CONFLICT_HINT}`)
    assert.deepEqual(e.details, { updatedAt: "2026-01-01T00:00:00.000Z" })

    const plan = body(new TRPCError({ code: "CONFLICT", message: "El plan cambió.", cause: new ErrorDetails({ updatedAt: "x" }, { hint: "Vuelve a leerlo con get_plan." }) }))
    assert.equal(plan.message, "El plan cambió. Vuelve a leerlo con get_plan.")
    assert.doesNotMatch(plan.message, /get_routine/)
  })

  it("CONFLICT sin pista sugiere releer sin nombrar una herramienta", () => {
    for (const err of [
      new TRPCError({ code: "CONFLICT" }),
      new TRPCError({ code: "CONFLICT", message: "Ya cambió.", cause: new ErrorDetails({ updatedAt: "x" }) }),
    ]) {
      const e = body(err)
      assert.equal(e.code, "CONFLICT")
      assert.match(e.message, /Vuelve a leerlo y reintenta/)
      assert.doesNotMatch(e.message, /get_\w+/)
    }
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

  it("mensajes de zod en español, con la ruta del campo", () => {
    const schema = z.object({
      id: z.string().uuid(),
      at: z.string().datetime(),
      n: z.number().int().min(1).max(5),
      name: z.string().min(1).max(3),
      list: z.array(z.string()).min(1),
      kind: z.enum(["a", "b"]),
      req: z.string(),
      tempo: z.string().regex(/^x$/),
      own: z.string().regex(/^x$/, "Mensaje propio"),
    }).strict()
    const msg = (data: Record<string, unknown>) => {
      const base = { id: "11111111-1111-4111-8111-111111111111", at: "2026-01-01T00:00:00.000Z", n: 1, name: "ab", list: ["x"], kind: "a", req: "r", tempo: "x", own: "x" }
      const r = schema.safeParse({ ...base, ...data })
      assert.equal(r.success, false)
      return body(r.error).message
    }
    assert.match(msg({ id: "x" }), /id: debe ser un UUID/)
    assert.match(msg({ at: "ayer" }), /at: debe ser una fecha y hora ISO 8601/)
    assert.match(msg({ n: 9 }), /n: debe ser menor o igual que 5/)
    assert.match(msg({ n: 0 }), /n: debe ser mayor o igual que 1/)
    assert.match(msg({ n: 1.5 }), /n: se esperaba entero y llegó decimal/)
    assert.match(msg({ name: "" }), /name: no puede estar vacío/)
    assert.match(msg({ name: "abcd" }), /name: debe tener como máximo 3 caracteres/)
    assert.match(msg({ list: [] }), /list: debe tener al menos 1 elemento/)
    assert.match(msg({ kind: "z" }), /kind: valor no válido "z"; opciones: "a", "b"/)
    assert.match(msg({ req: undefined }), /req: es obligatorio/)
    assert.match(msg({ req: 3 }), /req: se esperaba texto y llegó número/)
    assert.match(msg({ tempo: "y" }), /tempo: no tiene el formato esperado/)
    assert.match(msg({ own: "y" }), /own: Mensaje propio/)
    assert.match(msg({ extraField: 1 }), /\(raíz\): campo desconocido: "extraField"/)
    assert.doesNotMatch(msg({ id: "x" }), /Invalid|Expected/)
  })

  it("las uniones se aplanan al issue más profundo (no 'Invalid input')", () => {
    const sets = z.union([z.array(z.object({ reps: z.number() }).strict()).min(1), z.object({ count: z.number(), loadValue: z.number().optional() }).strict()])
    const schema = z.object({ items: z.array(z.object({ sets })) })
    const atajo = body(schema.safeParse({ items: [{ sets: { count: 1, loadValue: null } }] }).error)
    assert.match(atajo.message, /items\.0\.sets\.loadValue: se esperaba número y llegó null/)
    assert.deepEqual((atajo.details?.issues as { path: string }[])[0]!.path, "items.0.sets.loadValue")
    const lista = body(schema.safeParse({ items: [{ sets: [{ reps: "x" }] }] }).error)
    assert.match(lista.message, /items\.0\.sets\.0\.reps: se esperaba número y llegó texto/)
    assert.doesNotMatch(atajo.message + lista.message, /Invalid input/)
  })
})
