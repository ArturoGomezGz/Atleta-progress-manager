// QA del conector MCP con NODE_ENV=production: los errores INTERNAL no filtran detalles, los logs
// no contienen tokens ni contenido, y los límites de tasa del servidor de autorización (que
// better-auth solo aplica en producción) funcionan.

import assert from "node:assert/strict"
import { Writable } from "node:stream"
import { after, before, describe, it } from "node:test"
import type { FastifyInstance } from "fastify"
import { catalogExerciseIds, createFixtures, type Fixtures } from "./fixtures"
import { connectMcp, insertPat } from "./mcp-helpers"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

describe("conector MCP en modo producción", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let app: FastifyInstance
  let base: string
  const logs: string[] = []

  before(async () => {
    server = await startTestServer({ env: { NODE_ENV: "production" } })
    fx = await createFixtures(server.baseUrl)
    // Una segunda app con logger a memoria para revisar lo que se escribe en los logs
    const { buildApp } = await import("../../src/app")
    const stream = new Writable({ write(chunk, _enc, cb) { logs.push(String(chunk)); cb() } })
    app = await buildApp({ logger: { level: "info", stream } })
    await app.listen({ port: 0, host: "127.0.0.1" })
    const addr = app.server.address()
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`
  })

  after(async () => {
    await app?.close()
    await server?.close()
  })

  it("INTERNAL no expone el error interno (solo el requestId) y los logs no tienen tokens ni contenido", async () => {
    const { token } = await insertPat(fx.users.coachA.id)
    const [ex] = await catalogExerciseIds(1)
    const c = await connectMcp(base, token)
    try {
      // Un NUL en el nombre hace fallar a Postgres → INTERNAL
      const r = await c.callTool({ name: "create_routine", arguments: { name: "MARCADOR-SECRETO-1\u0000" } })
      assert.equal(r.isError, true)
      const error = (r.structuredContent as { error: { code: string; message: string; details?: { requestId?: string } } }).error
      assert.equal(error.code, "INTERNAL")
      assert.equal(error.message, "Ocurrió un error interno. Intenta de nuevo más tarde.")
      assert.ok(error.details?.requestId)
      assert.doesNotMatch(JSON.stringify(r), /UTF8|0x00|postgres|insert|stack/i)

      // Escrituras normales con contenido identificable
      const ok = await c.callTool({
        name: "create_routine",
        arguments: { name: "MARCADOR-SECRETO-2", content: { items: [{ type: "exercise", exerciseId: ex, sets: { count: 1, setType: "reps" }, notes: "MARCADOR-SECRETO-3" }] } },
      })
      assert.equal(ok.isError, undefined)
      await c.callTool({ name: "search_exercises", arguments: { query: "MARCADOR-SECRETO-4" } })
    } finally {
      await c.close()
    }
    await new Promise((r) => setTimeout(r, 50))

    const all = logs.join("")
    assert.ok(!all.includes(token), "el token no aparece")
    assert.ok(!all.includes(token.slice("atl_pat_".length)), "ni sin prefijo")
    assert.ok(!all.includes("MARCADOR-SECRETO"), "ni el contenido ni los argumentos")
    // Pero sí hay una línea estructurada por herramienta
    const toolLines = logs.filter((l) => l.includes('"[mcp] tool"')).map((l) => JSON.parse(l) as { mcp: Record<string, unknown> })
    assert.ok(toolLines.some((l) => l.mcp.tool === "create_routine" && l.mcp.code === "INTERNAL" && l.mcp.ok === false))
    assert.ok(toolLines.every((l) => l.mcp.userId === fx.users.coachA.id && typeof l.mcp.ms === "number"))
    // Un header Authorization inválido se registra solo con el motivo
    await fetch(`${base}/mcp`, { method: "POST", headers: { authorization: "Bearer atl_pat_TOKEN-INVENTADO-123456", "content-type": "application/json" }, body: "{}" })
    await new Promise((r) => setTimeout(r, 50))
    assert.ok(!logs.join("").includes("TOKEN-INVENTADO"))
  })

  it("registro dinámico: límite de 20 por hora por IP", async () => {
    const register = (ip: string) =>
      fetch(`${server.baseUrl}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ client_name: "spam", redirect_uris: ["http://127.0.0.1:1/cb"], token_endpoint_auth_method: "none" }),
      })
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) statuses.push((await register("203.0.113.7")).status)
    assert.deepEqual(statuses.slice(0, 20), Array(20).fill(200))
    assert.equal(statuses[20], 429)
  })

  it("el límite del registro dinámico no se evade rotando X-Forwarded-For", { todo: "BUG-12: better-auth toma la IP del primer valor de X-Forwarded-For (lo controla el cliente) y sin ese header no limita: llamando directo a la API se registran clientes sin límite" }, async () => {
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${server.baseUrl}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${i}` },
        body: JSON.stringify({ client_name: "spam", redirect_uris: ["http://127.0.0.1:1/cb"], token_endpoint_auth_method: "none" }),
      })
      statuses.push(res.status)
    }
    assert.ok(statuses.includes(429), "25 registros desde 'IPs' distintas pasaron sin límite")
  })
})
