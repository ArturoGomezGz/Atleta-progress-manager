import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { trustProxyFrom, withClientIp } from "../../src/lib/client-ip"

describe("trustProxyFrom (TRUST_PROXY)", () => {
  it("sin valor: 1 salto en producción (edge de Railway) y ninguno fuera de producción", () => {
    assert.equal(trustProxyFrom(undefined, "production"), 1)
    assert.equal(trustProxyFrom("", "production"), 1)
    assert.equal(trustProxyFrom(undefined, "test"), false)
    assert.equal(trustProxyFrom(undefined, undefined), false)
  })

  it("acepta número de saltos, booleanos y listas de IPs/CIDR", () => {
    assert.equal(trustProxyFrom("2", "production"), 2)
    assert.equal(trustProxyFrom("0", "production"), false)
    assert.equal(trustProxyFrom("false", "production"), false)
    assert.equal(trustProxyFrom("TRUE", "test"), true)
    assert.deepEqual(trustProxyFrom("10.0.0.0/8, 127.0.0.1", "production"), ["10.0.0.0/8", "127.0.0.1"])
  })
})

describe("withClientIp", () => {
  it("reemplaza X-Forwarded-For por la IP resuelta y quita otros headers de IP del cliente", () => {
    const h = withClientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2", "x-real-ip": "3.3.3.3", cookie: "a=b", origin: "https://web" }), "203.0.113.5")
    assert.equal(h.get("x-forwarded-for"), "203.0.113.5")
    assert.equal(h.get("x-real-ip"), null)
    assert.equal(h.get("cookie"), "a=b")
    assert.equal(h.get("origin"), "https://web")
  })
})
