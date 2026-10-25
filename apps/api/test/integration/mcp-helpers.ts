// Utilidades de las pruebas de integración del conector MCP (Paquete B): cliente del SDK
// sobre HTTP, requests crudas a /mcp, PKCE y tokens personales insertados directo en la BD.
// Como fixtures.ts, no importa src/ de forma estática (setup.ts fija el entorno antes).

import { createHash, randomBytes } from "node:crypto"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

export const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "itest", version: "0.0.0" } },
} as const

/** POST /mcp con los headers que manda un cliente Streamable HTTP. */
export function postMcp(baseUrl: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

/** Cliente MCP del SDK conectado (initialize hecho) con `Authorization: Bearer <token>`. */
export async function connectMcp(baseUrl: string, token: string): Promise<Client> {
  const client = new Client({ name: "atleta-itest", version: "0.0.0" })
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  })
  await client.connect(transport)
  return client
}

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

/** PAT insertado directamente (p. ej. para un usuario sin el flag `mcp`, que no puede crearlo). */
export async function insertPat(
  userId: string,
  opts: { scopes?: string[]; expiresAt?: Date | null; revokedAt?: Date | null; name?: string } = {},
): Promise<{ id: string; token: string }> {
  const [{ db }, { mcpPersonalToken }, { generatePersonalToken }] = await Promise.all([
    import("@atleta/db/client"),
    import("@atleta/db/schema"),
    import("../../src/mcp/personal-tokens"),
  ])
  const { token, hash, prefix } = generatePersonalToken()
  const [row] = await db
    .insert(mcpPersonalToken)
    .values({
      userId,
      name: opts.name ?? "itest",
      tokenHash: hash,
      tokenPrefix: prefix,
      scopes: opts.scopes ?? ["atleta:read", "atleta:write"],
      expiresAt: opts.expiresAt ?? null,
      revokedAt: opts.revokedAt ?? null,
    })
    .returning({ id: mcpPersonalToken.id })
  return { id: row!.id, token }
}
