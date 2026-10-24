// Conector MCP — tokens personales (caso 3 de docs/mcp.md): crear con mcp.createToken, usar con
// el cliente del SDK, revocado/vencido → 401, solo lectura sin escrituras, límites del router.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { createFixtures, type Fixtures } from "./fixtures"
import { INITIALIZE, connectMcp, insertPat, postMcp } from "./mcp-helpers"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

describe("conector MCP: tokens personales", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let base: string

  before(async () => {
    server = await startTestServer()
    base = server.baseUrl
    fx = await createFixtures(base)
  })

  after(async () => {
    await server?.close()
  })

  it("crear → usar con el cliente del SDK → aparece en la lista con last_used_at", async () => {
    const created = await fx.callers.coachA.mcp.createToken({ name: "Claude Code", scopes: ["atleta:read", "atleta:write"], expiresInDays: 30 })
    assert.match(created.token, /^atl_pat_/)
    assert.equal(created.prefix, created.token.slice(0, 12))
    assert.ok(created.expiresAt && created.expiresAt.getTime() > Date.now() + 29 * 86_400_000)

    const client = await connectMcp(base, created.token)
    assert.equal(client.getServerVersion()?.name, "atleta")
    await client.ping()
    if (client.getServerCapabilities()?.tools) await client.listTools()
    await client.close()

    const list = await fx.callers.coachA.mcp.listTokens()
    const row = list.find((t) => t.id === created.id)
    assert.ok(row)
    assert.equal(row.name, "Claude Code")
    assert.equal(row.prefix, created.prefix)
    assert.deepEqual(row.scopes, ["atleta:read", "atleta:write"])
    assert.ok(row.lastUsedAt, "el uso actualiza last_used_at")
    assert.ok(!JSON.stringify(list).includes(created.token), "la lista nunca trae el token")

    // Otro usuario no ve ni revoca tokens ajenos
    assert.equal((await fx.callers.coachB.mcp.listTokens()).length, 0)
    await assert.rejects(fx.callers.coachB.mcp.revokeToken({ id: created.id }), (e: unknown) => e instanceof TRPCError && e.code === "NOT_FOUND")
  })

  it("revocado → 401 y desaparece de la lista", async () => {
    const { id, token } = await fx.callers.coachA.mcp.createToken({ name: "Revocable", scopes: ["atleta:read"], expiresInDays: null })
    const auth = { authorization: `Bearer ${token}` }
    assert.equal((await postMcp(base, INITIALIZE, auth)).status, 200)
    await fx.callers.coachA.mcp.revokeToken({ id })
    const res = await postMcp(base, INITIALIZE, auth)
    assert.equal(res.status, 401)
    assert.match(res.headers.get("www-authenticate") ?? "", /error="invalid_token"/)
    assert.ok(!(await fx.callers.coachA.mcp.listTokens()).some((t) => t.id === id))
  })

  it("vencido → 401", async () => {
    const { token } = await insertPat(fx.users.coachA.id, { expiresAt: new Date(Date.now() - 1000) })
    assert.equal((await postMcp(base, INITIALIZE, { authorization: `Bearer ${token}` })).status, 401)
  })

  it("solo lectura: el principal no tiene atleta:write y no ve herramientas de escritura", async () => {
    const { token } = await fx.callers.coachA.mcp.createToken({ name: "Lectura", scopes: ["atleta:read"], expiresInDays: 90 })
    const [{ db }, { createAuthRepo, resolveMcpPrincipal }] = await Promise.all([import("@atleta/db/client"), import("../../src/mcp/auth")])
    const p = await resolveMcpPrincipal(`Bearer ${token}`, createAuthRepo(db))
    assert.ok(p)
    assert.deepEqual([...p.scopes], ["atleta:read"])

    const client = await connectMcp(base, token)
    if (client.getServerCapabilities()?.tools) {
      const { tools } = await client.listTools()
      const writes = tools.filter((t) => t.annotations?.readOnlyHint === false)
      assert.deepEqual(writes.map((t) => t.name), [])
    }
    await client.close()
  })

  it("atleta:write implica atleta:read; nombre y vigencia validados", async () => {
    const { id } = await fx.callers.coachA.mcp.createToken({ name: "  Solo escritura  ", scopes: ["atleta:write"] })
    const row = (await fx.callers.coachA.mcp.listTokens()).find((t) => t.id === id)!
    assert.deepEqual(row.scopes, ["atleta:read", "atleta:write"])
    assert.equal(row.name, "Solo escritura")
    // Sin expiresInDays: 90 días
    const days = (row.expiresAt!.getTime() - row.createdAt.getTime()) / 86_400_000
    assert.ok(Math.abs(days - 90) < 0.01, String(days))

    await assert.rejects(fx.callers.coachA.mcp.createToken({ name: "", scopes: ["atleta:read"] }))
    await assert.rejects(fx.callers.coachA.mcp.createToken({ name: "x", scopes: [] }))
    await assert.rejects(fx.callers.coachA.mcp.createToken({ name: "x", scopes: ["atleta:read"], expiresInDays: 7 as 30 }))
  })

  it("máximo de 10 tokens activos por usuario", async () => {
    const caller = fx.callers.athleteA
    for (let i = 0; i < 10; i++) await caller.mcp.createToken({ name: `t${i}`, scopes: ["atleta:read"] })
    await assert.rejects(caller.mcp.createToken({ name: "once", scopes: ["atleta:read"] }), /10 tokens activos/)
  })

  it("sin el flag mcp: el router responde FORBIDDEN y /mcp 403 con JSON-RPC -32001", async () => {
    await assert.rejects(fx.callers.noMcp.mcp.listTokens(), (e: unknown) => e instanceof TRPCError && e.code === "FORBIDDEN")
    await assert.rejects(fx.callers.noMcp.mcp.createToken({ name: "x", scopes: ["atleta:read"] }), (e: unknown) => e instanceof TRPCError && e.code === "FORBIDDEN")

    const { token } = await insertPat(fx.users.noMcp.id)
    const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${token}` })
    assert.equal(res.status, 403)
    const body = (await res.json()) as { jsonrpc: string; error: { code: number; message: string }; id: null }
    assert.equal(body.jsonrpc, "2.0")
    assert.equal(body.error.code, -32001)
    assert.match(body.error.message, /no está disponible/)
  })

  it("un token sin scopes de Atleta → 403 insufficient_scope", async () => {
    const { token } = await insertPat(fx.users.coachA.id, { scopes: ["offline_access"] })
    const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${token}` })
    assert.equal(res.status, 403)
    assert.match(res.headers.get("www-authenticate") ?? "", /error="insufficient_scope"/)
  })

  it("una sesión sintética del conector no puede administrar tokens", async () => {
    const [{ createMcpCaller }, { db }, { createAuthRepo, resolveMcpPrincipal }] = await Promise.all([
      import("../../src/mcp/context"),
      import("@atleta/db/client"),
      import("../../src/mcp/auth"),
    ])
    const { token } = await insertPat(fx.users.coachB.id)
    const p = await resolveMcpPrincipal(`Bearer ${token}`, createAuthRepo(db))
    assert.ok(p)
    const noop = () => {}
    const log = { info: noop, warn: noop, error: noop, debug: noop, child: () => log } as never
    const caller = createMcpCaller(p, log)
    await assert.rejects(caller.mcp.createToken({ name: "x", scopes: ["atleta:read"] }), (e: unknown) => e instanceof TRPCError && e.code === "FORBIDDEN")
    await assert.rejects(caller.mcp.listConnectedApps(), (e: unknown) => e instanceof TRPCError && e.code === "FORBIDDEN")
  })
})
