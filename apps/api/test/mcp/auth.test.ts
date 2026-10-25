import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import {
  hashOAuthToken,
  parseBearer,
  resolveMcpAuth,
  resolveMcpPrincipal,
  type AuthRepo,
  type OAuthTokenRow,
  type PatRow,
} from "../../src/mcp/auth"
import { generatePersonalToken } from "../../src/mcp/personal-tokens"
import type { McpPrincipal } from "../../src/mcp/types"

const NOW = new Date("2026-06-01T12:00:00Z")
const later = (ms: number) => new Date(NOW.getTime() + ms)

const USER: McpPrincipal["user"] = {
  id: "user-1",
  email: "coach@x.com",
  name: "Coach",
  emailVerified: true,
  image: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

// AuthRepo en memoria que registra qué se consultó (nunca debería ver el token en claro)
function fakeRepo(opts: { pats?: Record<string, PatRow>; oauth?: Record<string, OAuthTokenRow>; users?: McpPrincipal["user"][] } = {}) {
  const calls = { findPat: [] as string[], findOAuthToken: [] as string[], touched: [] as { id: string; at: Date }[] }
  const repo: AuthRepo = {
    async findPat(hash) {
      calls.findPat.push(hash)
      return opts.pats?.[hash] ?? null
    },
    async touchPat(id, at) {
      calls.touched.push({ id, at })
    },
    async findOAuthToken(hash) {
      calls.findOAuthToken.push(hash)
      return opts.oauth?.[hash] ?? null
    },
    async findUser(id) {
      return (opts.users ?? [USER]).find((u) => u.id === id) ?? null
    },
  }
  return { repo, calls }
}

function patRow(over: Partial<PatRow> = {}): PatRow {
  return { id: "pat-1", userId: USER.id, scopes: ["atleta:read", "atleta:write"], expiresAt: later(86_400_000), revokedAt: null, lastUsedAt: null, ...over }
}

function oauthRow(over: Partial<OAuthTokenRow> = {}): OAuthTokenRow {
  return { id: "oat-1", userId: USER.id, clientId: "client-1", scopes: ["atleta:read", "offline_access"], expiresAt: later(3_600_000), clientDisabled: false, ...over }
}

describe("parseBearer", () => {
  it("acepta Bearer (sin distinguir mayúsculas) y rechaza otras formas", () => {
    const t = "atl_pat_" + "a".repeat(40)
    assert.equal(parseBearer(`Bearer ${t}`), t)
    assert.equal(parseBearer(`bearer   ${t}  `), t)
    assert.equal(parseBearer(undefined), undefined)
    assert.equal(parseBearer(""), undefined)
    assert.equal(parseBearer(`Basic ${t}`), null)
    assert.equal(parseBearer(`Bearer`), null)
    assert.equal(parseBearer(`Bearer ${t} extra`), null)
    assert.equal(parseBearer(`Bearer abc`), null) // demasiado corto
    assert.equal(parseBearer(`Bearer ${"a".repeat(20)}%$`), null) // caracteres fuera de base64url
    assert.equal(parseBearer(`Bearer ${"a".repeat(600)}`), null) // demasiado largo
  })
})

describe("resolveMcpPrincipal: tokens personales", () => {
  it("PAT válido → principal pat con sus scopes; busca por SHA-256 hex y actualiza last_used_at", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo, calls } = fakeRepo({ pats: { [hash]: patRow() } })
    const p = await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW)
    assert.ok(p)
    assert.equal(p.kind, "pat")
    assert.equal(p.tokenId, "pat-1")
    assert.equal(p.user.id, USER.id)
    assert.equal(p.clientId, undefined)
    assert.deepEqual([...p.scopes].sort(), ["atleta:read", "atleta:write"])
    assert.deepEqual(calls.findPat, [hash])
    assert.equal(calls.findOAuthToken.length, 0)
    assert.deepEqual(calls.touched, [{ id: "pat-1", at: NOW }])
  })

  it("no actualiza last_used_at si se usó hace menos de 5 minutos", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo, calls } = fakeRepo({ pats: { [hash]: patRow({ lastUsedAt: later(-60_000) }) } })
    assert.ok(await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW))
    assert.equal(calls.touched.length, 0)
  })

  it("si falla la actualización de last_used_at, autentica igual", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo } = fakeRepo({ pats: { [hash]: patRow() } })
    repo.touchPat = async () => {
      throw new Error("bd caída")
    }
    assert.ok(await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW))
  })

  it("PAT sin vencimiento es válido y no tiene expiresAt", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo } = fakeRepo({ pats: { [hash]: patRow({ expiresAt: null }) } })
    const p = await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW)
    assert.ok(p)
    assert.equal(p.expiresAt, undefined)
  })

  it("PAT revocado → revoked", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo } = fakeRepo({ pats: { [hash]: patRow({ revokedAt: later(-1000) }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo, NOW), { ok: false, reason: "revoked" })
  })

  it("PAT vencido (incluido el instante exacto) → expired", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo } = fakeRepo({ pats: { [hash]: patRow({ expiresAt: later(-1) }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo, NOW), { ok: false, reason: "expired" })
    const { repo: repo2 } = fakeRepo({ pats: { [hash]: patRow({ expiresAt: NOW }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo2, NOW), { ok: false, reason: "expired" })
  })

  it("PAT inexistente → not_found; usuario borrado → user_not_found", async () => {
    const { token, hash } = generatePersonalToken()
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, fakeRepo().repo, NOW), { ok: false, reason: "not_found" })
    const { repo } = fakeRepo({ pats: { [hash]: patRow({ userId: "otro" }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo, NOW), { ok: false, reason: "user_not_found" })
  })

  it("PAT de solo lectura → solo atleta:read", async () => {
    const { token, hash } = generatePersonalToken()
    const { repo } = fakeRepo({ pats: { [hash]: patRow({ scopes: ["atleta:read"] }) } })
    const p = await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW)
    assert.ok(p)
    assert.equal(p.scopes.has("atleta:read"), true)
    assert.equal(p.scopes.has("atleta:write"), false)
  })
})

describe("resolveMcpPrincipal: tokens OAuth", () => {
  const raw = "AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEf"
  const token = `atl_oat_${raw}`

  it("replica el hasher del plugin: SHA-256 base64url sin padding del token sin prefijo", () => {
    const expected = createHash("sha256").update(raw).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    assert.equal(hashOAuthToken(raw), expected)
    assert.ok(!hashOAuthToken(raw).includes("="))
  })

  it("token válido → principal oauth con clientId; offline_access no cuenta como scope MCP", async () => {
    const { repo, calls } = fakeRepo({ oauth: { [hashOAuthToken(raw)]: oauthRow() } })
    const p = await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW)
    assert.ok(p)
    assert.equal(p.kind, "oauth")
    assert.equal(p.clientId, "client-1")
    assert.equal(p.tokenId, "oat-1")
    assert.deepEqual([...p.scopes], ["atleta:read"])
    assert.equal(p.expiresAt?.getTime(), later(3_600_000).getTime())
    assert.deepEqual(calls.findOAuthToken, [hashOAuthToken(raw)])
    assert.equal(calls.findPat.length, 0)
  })

  it("token expirado o sin expiración → expired", async () => {
    const { repo } = fakeRepo({ oauth: { [hashOAuthToken(raw)]: oauthRow({ expiresAt: later(-1000) }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo, NOW), { ok: false, reason: "expired" })
    const { repo: repo2 } = fakeRepo({ oauth: { [hashOAuthToken(raw)]: oauthRow({ expiresAt: null }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo2, NOW), { ok: false, reason: "expired" })
  })

  it("cliente deshabilitado → client_disabled", async () => {
    const { repo } = fakeRepo({ oauth: { [hashOAuthToken(raw)]: oauthRow({ clientDisabled: true }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo, NOW), { ok: false, reason: "client_disabled" })
  })

  it("token sin usuario (client_credentials) o inexistente → not_found", async () => {
    const { repo } = fakeRepo({ oauth: { [hashOAuthToken(raw)]: oauthRow({ userId: null }) } })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, repo, NOW), { ok: false, reason: "not_found" })
    assert.deepEqual(await resolveMcpAuth(`Bearer ${token}`, fakeRepo().repo, NOW), { ok: false, reason: "not_found" })
  })

  it("scopes desconocidos se ignoran (token sin permisos de Atleta → scopes vacíos)", async () => {
    const { repo } = fakeRepo({ oauth: { [hashOAuthToken(raw)]: oauthRow({ scopes: ["offline_access", "openid", "admin"] }) } })
    const p = await resolveMcpPrincipal(`Bearer ${token}`, repo, NOW)
    assert.ok(p)
    assert.equal(p.scopes.size, 0)
  })
})

describe("resolveMcpPrincipal: headers inválidos", () => {
  it("sin header → missing; mal formado → malformed; prefijo desconocido → unknown_prefix (sin tocar la BD)", async () => {
    const { repo, calls } = fakeRepo()
    assert.deepEqual(await resolveMcpAuth(undefined, repo, NOW), { ok: false, reason: "missing" })
    assert.deepEqual(await resolveMcpAuth("Token abc", repo, NOW), { ok: false, reason: "malformed" })
    assert.deepEqual(await resolveMcpAuth("Bearer atl_oat_", repo, NOW), { ok: false, reason: "malformed" })
    assert.deepEqual(await resolveMcpAuth(`Bearer ghp_${"x".repeat(36)}`, repo, NOW), { ok: false, reason: "unknown_prefix" })
    // Un token OAuth sin nuestro prefijo tampoco se acepta
    assert.deepEqual(await resolveMcpAuth(`Bearer ${"A".repeat(32)}`, repo, NOW), { ok: false, reason: "unknown_prefix" })
    assert.equal(calls.findPat.length + calls.findOAuthToken.length, 0)
    assert.equal(await resolveMcpPrincipal(undefined, repo, NOW), null)
  })
})
