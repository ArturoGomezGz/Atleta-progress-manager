import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import {
  allowedOrigins,
  authIssuer,
  isOriginAllowed,
  mcpResourceUrl,
  protectedResourceMetadataUrl,
} from "../../src/mcp/config"

const KEYS = ["WEB_URL", "API_PUBLIC_URL", "MCP_RESOURCE_URL", "MCP_ALLOWED_ORIGINS", "BETTER_AUTH_URL"] as const

describe("configuración del conector MCP", () => {
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
    for (const k of KEYS) delete process.env[k]
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it("URLs derivadas: recurso en la API, issuer en el web (BETTER_AUTH_URL)", () => {
    process.env.API_PUBLIC_URL = "https://api.example.com/"
    process.env.BETTER_AUTH_URL = "https://web.example.com"
    assert.equal(mcpResourceUrl(), "https://api.example.com/mcp")
    assert.equal(protectedResourceMetadataUrl(), "https://api.example.com/.well-known/oauth-protected-resource/mcp")
    assert.equal(authIssuer(), "https://web.example.com/api/auth")
    process.env.MCP_RESOURCE_URL = "https://mcp.example.com/"
    assert.equal(mcpResourceUrl(), "https://mcp.example.com")
    assert.equal(protectedResourceMetadataUrl(), "https://mcp.example.com/.well-known/oauth-protected-resource")
  })

  it("Origin: sin header se acepta; solo WEB_URL y MCP_ALLOWED_ORIGINS (normalizados)", () => {
    process.env.WEB_URL = "https://web.example.com"
    process.env.MCP_ALLOWED_ORIGINS = " http://localhost:6274/ , basura, https://inspector.example.com"
    assert.deepEqual([...allowedOrigins()].sort(), ["http://localhost:6274", "https://inspector.example.com", "https://web.example.com"])
    assert.equal(isOriginAllowed(undefined), true)
    assert.equal(isOriginAllowed("https://web.example.com"), true)
    assert.equal(isOriginAllowed("http://localhost:6274"), true)
    assert.equal(isOriginAllowed("https://evil.example.com"), false)
    assert.equal(isOriginAllowed("null"), false)
    assert.equal(isOriginAllowed("https://web.example.com.evil.com"), false)
  })
})
