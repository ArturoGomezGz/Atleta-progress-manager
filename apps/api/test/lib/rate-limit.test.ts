import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createRateLimiter } from "../../src/lib/rate-limit"

describe("createRateLimiter", () => {
  it("permite hasta max intentos por ventana y luego bloquea con retryAfter", () => {
    const rl = createRateLimiter({ max: 2, windowMs: 60_000 })
    assert.deepEqual(rl.hit("u1", 0), { ok: true })
    assert.deepEqual(rl.hit("u1", 1000), { ok: true })
    const blocked = rl.hit("u1", 2000)
    assert.equal(blocked.ok, false)
    assert.equal(!blocked.ok && blocked.retryAfterSeconds, 58)
  })

  it("libera cuando la ventana avanza y separa usuarios", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 })
    assert.equal(rl.hit("a", 0).ok, true)
    assert.equal(rl.hit("b", 0).ok, true)
    assert.equal(rl.hit("a", 500).ok, false)
    assert.equal(rl.hit("a", 1001).ok, true)
  })

  it("no crece sin límite", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 10 })
    for (let i = 0; i < 100; i++) rl.hit(`k${i}`, i)
    assert.equal(rl.hit("k99", 100).ok, false)
  })
})
