// Conector MCP — capa HTTP de /mcp (casos 5 y 8 de docs/mcp.md): 405, Origin, CORS, 413,
// tasa por usuario con limitadores inyectados (429 + Retry-After) y respuesta JSON stateless.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { FastifyInstance } from "fastify"
import { createFixtures, type Fixtures } from "./fixtures"
import { INITIALIZE, insertPat, postMcp } from "./mcp-helpers"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

describe("conector MCP: HTTP", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let base: string
  let token: string

  before(async () => {
    server = await startTestServer({ env: { MCP_ALLOWED_ORIGINS: "http://localhost:6274" } })
    base = server.baseUrl
    fx = await createFixtures(base)
    token = (await insertPat(fx.users.coachA.id)).token
  })

  after(async () => {
    await server?.close()
  })

  it("initialize: 200 con respuesta JSON (stateless, sin Mcp-Session-Id)", async () => {
    const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${token}` })
    assert.equal(res.status, 200)
    assert.match(res.headers.get("content-type") ?? "", /application\/json/)
    assert.equal(res.headers.get("mcp-session-id"), null)
    const body = (await res.json()) as { result: { serverInfo: { name: string } } }
    assert.equal(body.result.serverInfo.name, "atleta")
  })

  it("GET y DELETE /mcp → 405 con Allow: POST", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await fetch(`${base}/mcp`, { method, headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" } })
      assert.equal(res.status, 405, method)
      assert.equal(res.headers.get("allow"), "POST")
    }
  })

  it("Origin: el web y MCP_ALLOWED_ORIGINS pasan; cualquier otro → 403 (anti DNS-rebinding)", async () => {
    const auth = { authorization: `Bearer ${token}` }
    const evil = await postMcp(base, INITIALIZE, { ...auth, origin: "https://evil.example.com" })
    assert.equal(evil.status, 403)
    assert.equal(evil.headers.get("access-control-allow-origin"), null)
    // También sin token: el Origin se revisa antes que la autenticación
    assert.equal((await postMcp(base, INITIALIZE, { origin: "https://evil.example.com" })).status, 403)

    const inspector = await postMcp(base, INITIALIZE, { ...auth, origin: "http://localhost:6274" })
    assert.equal(inspector.status, 200)
    assert.equal(inspector.headers.get("access-control-allow-origin"), "http://localhost:6274")
    assert.equal(inspector.headers.get("access-control-allow-credentials"), null)
    assert.match(inspector.headers.get("access-control-expose-headers") ?? "", /WWW-Authenticate/i)

    assert.equal((await postMcp(base, INITIALIZE, { ...auth, origin: base })).status, 200)
  })

  it("CORS: preflight de /mcp para un origen permitido; el 401 expone WWW-Authenticate", async () => {
    const pre = await fetch(`${base}/mcp`, {
      method: "OPTIONS",
      headers: { origin: "http://localhost:6274", "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    })
    assert.equal(pre.status, 204)
    assert.equal(pre.headers.get("access-control-allow-origin"), "http://localhost:6274")
    assert.match(pre.headers.get("access-control-allow-headers") ?? "", /authorization/i)

    const unauth = await postMcp(base, INITIALIZE, { origin: "http://localhost:6274" })
    assert.equal(unauth.status, 401)
    assert.equal(unauth.headers.get("access-control-allow-origin"), "http://localhost:6274")
    assert.match(unauth.headers.get("access-control-expose-headers") ?? "", /WWW-Authenticate/i)

    // El resto de la API sigue limitado al web con credenciales
    const trpc = await fetch(`${base}/trpc/features.mine`, { headers: { origin: "http://localhost:6274" } })
    assert.equal(trpc.headers.get("access-control-allow-origin"), base)
    assert.equal(trpc.headers.get("access-control-allow-credentials"), "true")

    const prm = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`, { headers: { origin: "http://localhost:6274" } })
    assert.equal(prm.headers.get("access-control-allow-origin"), "http://localhost:6274")
  })

  it("cuerpo de más de 256 KB → 413; justo debajo se procesa", async () => {
    const auth = { authorization: `Bearer ${token}` }
    const big = JSON.stringify({ ...INITIALIZE, params: { ...INITIALIZE.params, padding: "x".repeat(256 * 1024) } })
    assert.equal((await postMcp(base, big, auth)).status, 413)
    const small = JSON.stringify({ ...INITIALIZE, params: { ...INITIALIZE.params, padding: "x".repeat(200 * 1024) } })
    assert.equal((await postMcp(base, small, auth)).status, 200)
  })

  it("sin el flag mcp → 403 JSON-RPC -32001", async () => {
    const { token: noMcpToken } = await insertPat(fx.users.noMcp.id)
    const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${noMcpToken}` })
    assert.equal(res.status, 403)
    const body = (await res.json()) as { error: { code: number } }
    assert.equal(body.error.code, -32001)
  })

  it("tasa por usuario (limitador inyectado): 429 con Retry-After; otro usuario no se ve afectado", async () => {
    const [{ buildApp }, { createRateLimiter }] = await Promise.all([import("../../src/app"), import("../../src/lib/rate-limit")])
    const app: FastifyInstance = await buildApp({ logger: false, mcp: { limiters: { request: createRateLimiter({ max: 2, windowMs: 60_000 }) } } })
    await app.listen({ port: 0, host: "127.0.0.1" })
    try {
      const address = app.server.address()
      const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`
      const auth = { authorization: `Bearer ${token}` }
      assert.equal((await postMcp(url, INITIALIZE, auth)).status, 200)
      assert.equal((await postMcp(url, INITIALIZE, auth)).status, 200)
      const limited = await postMcp(url, INITIALIZE, auth)
      assert.equal(limited.status, 429)
      const retry = Number(limited.headers.get("retry-after"))
      assert.ok(retry >= 1 && retry <= 60, String(retry))
      const body = (await limited.json()) as { jsonrpc: string; error: { message: string } }
      assert.equal(body.jsonrpc, "2.0")
      assert.match(body.error.message, /Reintenta/)

      const { token: other } = await insertPat(fx.users.coachB.id)
      assert.equal((await postMcp(url, INITIALIZE, { authorization: `Bearer ${other}` })).status, 200)
    } finally {
      await app.close()
    }
  })
})
