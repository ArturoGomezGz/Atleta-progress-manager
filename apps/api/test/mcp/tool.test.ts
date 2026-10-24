import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { FastifyBaseLogger } from "fastify"
import { z } from "zod"
import type { FeatureKey } from "../../src/lib/features"
import { createRateLimiter } from "../../src/lib/rate-limit"
import { registerAtletaTool } from "../../src/mcp/tool"
import type { AppCaller, McpScope, McpToolContext } from "../../src/mcp/types"

type LogLine = { obj: Record<string, unknown>; msg: string }

function fakeLog(lines: LogLine[]): FastifyBaseLogger {
  const push = (obj: Record<string, unknown>, msg: string) => lines.push({ obj, msg })
  const log = { info: push, warn: push, error: push, debug: push, child: () => log }
  return log as unknown as FastifyBaseLogger
}

function makeCtx(opts: { scopes: McpScope[]; features?: FeatureKey[]; writeMax?: number; lines?: LogLine[] }): McpToolContext {
  const big = () => createRateLimiter({ max: 1000, windowMs: 60_000 })
  return {
    principal: {
      kind: "pat",
      user: { id: "u1", email: "c@x.com", name: "Coach", emailVerified: true, image: null, createdAt: new Date(0), updatedAt: new Date(0) },
      scopes: new Set(opts.scopes),
      tokenId: "tok-1",
    },
    caller: {} as unknown as AppCaller,
    features: new Set(opts.features ?? ["mcp"]),
    log: fakeLog(opts.lines ?? []),
    now: () => new Date(),
    limiters: { write: createRateLimiter({ max: opts.writeMax ?? 1000, windowMs: 60_000 }), exerciseCreate: big(), schedule: big() },
    requestId: "req-1",
  }
}

async function connect(ctx: McpToolContext) {
  const server = new McpServer({ name: "test", version: "0.0.0" })
  registerAtletaTool(server, ctx, {
    name: "leer",
    title: "Leer",
    description: "lectura",
    scope: "atleta:read",
    input: { teamId: z.string().uuid().optional(), n: z.number().int().max(3) },
    run: async (args) => ({ doble: args.n * 2 }),
  })
  registerAtletaTool(server, ctx, {
    name: "escribir",
    title: "Escribir",
    description: "escritura",
    scope: "atleta:write",
    input: {},
    run: async () => ["ok"],
  })
  registerAtletaTool(server, ctx, {
    name: "con_flag",
    title: "Con flag",
    description: "requiere training_plans",
    scope: "atleta:read",
    feature: "training_plans",
    input: {},
    run: async () => ({}),
  })
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: "c", version: "0.0.0" })
  await client.connect(clientT)
  return client
}

const errorOf = (r: Awaited<ReturnType<Client["callTool"]>>) => (r.structuredContent as { error: { code: string } }).error.code

describe("registerAtletaTool", () => {
  it("oculta las herramientas sin scope o sin flag y publica el JSON Schema completo", async () => {
    const client = await connect(makeCtx({ scopes: ["atleta:read"] }))
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name), ["leer"])
    const leer = tools[0]!
    assert.deepEqual(Object.keys(leer.inputSchema.properties ?? {}), ["teamId", "n"])
    assert.deepEqual(leer.inputSchema.required, ["n"])
    assert.equal(leer.annotations?.readOnlyHint, true)
    assert.equal(leer.annotations?.openWorldHint, false)

    const full = await connect(makeCtx({ scopes: ["atleta:read", "atleta:write"], features: ["mcp", "training_plans"] }))
    const names = (await full.listTools()).tools.map((t) => t.name)
    assert.deepEqual(names, ["leer", "escribir", "con_flag"])
  })

  it("devuelve structuredContent y envuelve los arreglos", async () => {
    const client = await connect(makeCtx({ scopes: ["atleta:read", "atleta:write"] }))
    const r = await client.callTool({ name: "leer", arguments: { n: 2 } })
    assert.equal(r.isError, undefined)
    assert.deepEqual(r.structuredContent, { doble: 4 })
    assert.deepEqual(JSON.parse((r.content as { text: string }[])[0]!.text), { doble: 4 })
    const w = await client.callTool({ name: "escribir", arguments: {} })
    assert.deepEqual(w.structuredContent, { result: ["ok"] })
  })

  it("valida con nuestro formato: INVALID_INPUT", async () => {
    const client = await connect(makeCtx({ scopes: ["atleta:read"] }))
    const r = await client.callTool({ name: "leer", arguments: { n: 9 } })
    assert.equal(r.isError, true)
    assert.equal(errorOf(r), "INVALID_INPUT")
  })

  it("aplica el límite de escrituras: RATE_LIMITED con retryAfterSeconds", async () => {
    const client = await connect(makeCtx({ scopes: ["atleta:read", "atleta:write"], writeMax: 1 }))
    assert.equal((await client.callTool({ name: "escribir", arguments: {} })).isError, undefined)
    const r = await client.callTool({ name: "escribir", arguments: {} })
    assert.equal(errorOf(r), "RATE_LIMITED")
    // Las lecturas no cuentan para el límite de escrituras
    assert.equal((await client.callTool({ name: "leer", arguments: { n: 1 } })).isError, undefined)
  })

  it("registra una línea de log por llamada sin argumentos", async () => {
    const lines: LogLine[] = []
    const client = await connect(makeCtx({ scopes: ["atleta:read"], lines }))
    await client.callTool({ name: "leer", arguments: { n: 1, teamId: "11111111-1111-4111-8111-111111111111" } })
    const toolLines = lines.filter((l) => l.msg === "[mcp] tool")
    assert.equal(toolLines.length, 1)
    const mcp = toolLines[0]!.obj.mcp as Record<string, unknown>
    assert.equal(mcp.tool, "leer")
    assert.equal(mcp.ok, true)
    assert.equal(mcp.tokenId, "tok-1")
    assert.equal(mcp.teamId, "11111111-1111-4111-8111-111111111111")
    assert.equal("n" in mcp, false)
  })
})
