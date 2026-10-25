import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import {
  PAT_PREFIX,
  PAT_TOUCH_INTERVAL_MS,
  generatePersonalToken,
  hashPersonalToken,
  isPersonalToken,
  patExpiresAt,
  shouldTouchPat,
} from "../../src/mcp/personal-tokens"

describe("tokens personales (PAT)", () => {
  it("genera atl_pat_ + 30 bytes en base64url, con hash SHA-256 hex y prefijo de 12", () => {
    const { token, hash, prefix } = generatePersonalToken()
    assert.match(token, /^atl_pat_[A-Za-z0-9_-]{40}$/)
    assert.ok(token.startsWith(PAT_PREFIX))
    assert.equal(Buffer.from(token.slice(PAT_PREFIX.length), "base64url").length, 30)
    assert.equal(hash, createHash("sha256").update(token).digest("hex"))
    assert.match(hash, /^[0-9a-f]{64}$/)
    assert.equal(prefix, token.slice(0, 12))
    assert.ok(prefix.startsWith("atl_pat_"))
    assert.ok(!hash.includes(token.slice(PAT_PREFIX.length)))
  })

  it("cada token es distinto", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generatePersonalToken().token))
    assert.equal(tokens.size, 50)
  })

  it("hashPersonalToken es determinista y distingue tokens", () => {
    assert.equal(hashPersonalToken("atl_pat_abc"), hashPersonalToken("atl_pat_abc"))
    assert.notEqual(hashPersonalToken("atl_pat_abc"), hashPersonalToken("atl_pat_abd"))
  })

  it("isPersonalToken solo reconoce el prefijo atl_pat_", () => {
    assert.equal(isPersonalToken("atl_pat_xyz"), true)
    assert.equal(isPersonalToken("atl_oat_xyz"), false)
    assert.equal(isPersonalToken("ATL_PAT_xyz"), false)
  })

  it("patExpiresAt suma días o devuelve null (no expira)", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    assert.equal(patExpiresAt(30, now)?.toISOString(), "2026-01-31T00:00:00.000Z")
    assert.equal(patExpiresAt(365, now)?.toISOString(), "2027-01-01T00:00:00.000Z")
    assert.equal(patExpiresAt(null, now), null)
  })

  it("last_used_at se actualiza como mucho cada 5 minutos", () => {
    const now = new Date("2026-01-01T00:10:00Z")
    assert.equal(shouldTouchPat(null, now), true)
    assert.equal(shouldTouchPat(new Date(now.getTime() - PAT_TOUCH_INTERVAL_MS + 1000), now), false)
    assert.equal(shouldTouchPat(new Date(now.getTime() - PAT_TOUCH_INTERVAL_MS), now), true)
  })
})
