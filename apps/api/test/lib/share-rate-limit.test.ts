import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { createRateLimiter } from "../../src/lib/rate-limit"
import { SHARE_RATE_MAX, SHARE_RATE_WINDOW_MS, assertShareRate, shareRateKey } from "../../src/lib/share-rate-limit"

describe("assertShareRate (share.preview / share.start)", () => {
  it("usa una clave por IP con prefijo share:", () => {
    assert.equal(shareRateKey("203.0.113.7"), "share:203.0.113.7")
  })

  it("permite hasta SHARE_RATE_MAX intentos por IP y luego lanza TOO_MANY_REQUESTS con el tiempo de espera", () => {
    const rl = createRateLimiter({ max: SHARE_RATE_MAX, windowMs: SHARE_RATE_WINDOW_MS })
    for (let i = 0; i < SHARE_RATE_MAX; i++) assertShareRate("1.1.1.1", rl, i)
    assert.throws(
      () => assertShareRate("1.1.1.1", rl, 1000),
      (err: unknown) =>
        err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS" && /Intenta de nuevo en 59 s\./.test(err.message),
    )
  })

  it("separa la cubeta de cada IP y libera al avanzar la ventana", () => {
    const rl = createRateLimiter({ max: 1, windowMs: SHARE_RATE_WINDOW_MS })
    assertShareRate("1.1.1.1", rl, 0)
    assertShareRate("2.2.2.2", rl, 0)
    assert.throws(() => assertShareRate("1.1.1.1", rl, 10))
    assertShareRate("1.1.1.1", rl, SHARE_RATE_WINDOW_MS + 1)
  })
})
