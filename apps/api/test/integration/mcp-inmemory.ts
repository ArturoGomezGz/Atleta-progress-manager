// Cliente MCP del SDK conectado en memoria (InMemoryTransport) a createMcpServer con un
// McpToolContext real: principal del usuario fixture, caller tRPC (createMcpCaller), flags reales
// (activeFeatures) y limitadores reales o inyectados. No pasa por /mcp (eso lo prueba la capa HTTP).
//
// Igual que fixtures.ts, no importa src/ de forma estática: setup.ts fija el entorno antes.

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { FastifyBaseLogger } from "fastify"
import type { RateLimiter } from "../../src/lib/rate-limit"
import type { McpLimiters, McpScope, McpToolContext } from "../../src/mcp/types"
import type { FixtureUser } from "./fixtures"

const silentLog = (() => {
  const noop = () => {}
  const log = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, child: () => log, level: "silent" }
  return log as unknown as FastifyBaseLogger
})()

export type ToolResult = Awaited<ReturnType<Client["callTool"]>>
export type ToolError = { code: string; message: string; details?: Record<string, unknown> }

export type McpTestClient = {
  client: Client
  ctx: McpToolContext
  /** Llama la herramienta y devuelve el resultado crudo. */
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>
  /** Llama y exige éxito; devuelve structuredContent. */
  ok<T = Record<string, unknown>>(name: string, args?: Record<string, unknown>): Promise<T>
  /** Llama y exige isError; devuelve el error. */
  fail(name: string, args?: Record<string, unknown>): Promise<ToolError>
  close(): Promise<void>
}

export async function mcpClientFor(
  u: FixtureUser,
  opts: { scopes?: McpScope[]; limiters?: Partial<McpLimiters> } = {},
): Promise<McpTestClient> {
  const [{ db }, { user }, { eq }, { activeFeatures }, { createRateLimiter }, { createMcpCaller }, { createMcpServer }] = await Promise.all([
    import("@atleta/db/client"),
    import("@atleta/db/schema"),
    import("drizzle-orm"),
    import("../../src/lib/features"),
    import("../../src/lib/rate-limit"),
    import("../../src/mcp/context"),
    import("../../src/mcp/server"),
  ])
  const [row] = await db.select().from(user).where(eq(user.id, u.id)).limit(1)
  if (!row) throw new Error(`usuario ${u.email} no existe`)

  const principal = {
    kind: "pat" as const,
    user: { id: row.id, email: row.email, name: row.name, emailVerified: row.emailVerified, image: row.image, createdAt: row.createdAt, updatedAt: row.updatedAt },
    scopes: new Set<McpScope>(opts.scopes ?? ["atleta:read", "atleta:write"]),
    tokenId: `itest-${row.id}`,
  }
  const big = (): RateLimiter => createRateLimiter({ max: 10_000, windowMs: 60_000 })
  const ctx: McpToolContext = {
    principal,
    caller: createMcpCaller(principal, silentLog),
    features: new Set(activeFeatures(row)),
    log: silentLog,
    now: () => new Date(),
    limiters: { write: big(), exerciseCreate: big(), schedule: big(), ...opts.limiters },
    requestId: "itest",
  }

  const server = createMcpServer(ctx)
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: "itest", version: "0.0.0" })
  await client.connect(clientT)

  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args })
  return {
    client,
    ctx,
    call,
    async ok<T>(name: string, args?: Record<string, unknown>) {
      const r = await call(name, args)
      if (r.isError) throw new Error(`${name} falló: ${(r.content as { text: string }[])[0]?.text}`)
      return r.structuredContent as T
    },
    async fail(name: string, args?: Record<string, unknown>) {
      const r = await call(name, args)
      if (!r.isError) throw new Error(`${name} debía fallar y devolvió ${JSON.stringify(r.structuredContent)}`)
      return (r.structuredContent as { error: ToolError }).error
    },
    async close() {
      await client.close()
      await server.close()
    },
  }
}

/** Fecha UTC (YYYY-MM-DD) a `days` días de hoy. */
export function utcDate(days = 0): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0]!
}
