import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isWebProxySignature, trustProxyFrom, webProxiedClientIp, withClientIp } from "../../src/lib/client-ip"

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

  it("quita siempre la firma del web (x-atleta-web-proxy)", () => {
    const h = withClientIp(new Headers({ "x-atleta-web-proxy": "secreto" }), "203.0.113.5")
    assert.equal(h.get("x-atleta-web-proxy"), null)
  })
})

describe("isWebProxySignature (WEB_PROXY_SECRET)", () => {
  it("solo acepta el secreto exacto", () => {
    assert.equal(isWebProxySignature("s3cr3t", "s3cr3t"), true)
    assert.equal(isWebProxySignature("s3cr3T", "s3cr3t"), false)
    assert.equal(isWebProxySignature("s3cr3t-extra", "s3cr3t"), false)
    assert.equal(isWebProxySignature("", "s3cr3t"), false)
    assert.equal(isWebProxySignature(undefined, "s3cr3t"), false)
    assert.equal(isWebProxySignature(["s3cr3t", "s3cr3t"], "s3cr3t"), false)
  })

  it("sin secreto configurado nunca hay firma válida", () => {
    assert.equal(isWebProxySignature("", ""), false)
    assert.equal(isWebProxySignature("algo", undefined), false)
    assert.equal(isWebProxySignature("algo", ""), false)
  })
})

describe("webProxiedClientIp", () => {
  // Railway: socket = proxy interno del edge; X-Forwarded-For = "<lo que mandó el web>, <IP del web>"
  it("con TRUST_PROXY=1 toma el salto anterior al web (la IP que el web puso en X-Forwarded-For)", () => {
    const ip = webProxiedClientIp({ xff: "1.2.3.4, 76.76.21.9", socketIp: "10.0.0.2", trustedAddrs: ["10.0.0.2", "76.76.21.9"], fallback: "76.76.21.9" })
    assert.equal(ip, "1.2.3.4")
  })

  it("lo que el cliente ponga antes de la IP del usuario no cuenta", () => {
    const ip = webProxiedClientIp({ xff: "6.6.6.6, 1.2.3.4, 76.76.21.9", socketIp: "10.0.0.2", trustedAddrs: ["10.0.0.2", "76.76.21.9"], fallback: "76.76.21.9" })
    assert.equal(ip, "1.2.3.4")
  })

  it("sin trustProxy (local) el salto siguiente al socket es el último valor del header", () => {
    assert.equal(webProxiedClientIp({ xff: "1.2.3.4", socketIp: "127.0.0.1", trustedAddrs: undefined, fallback: "127.0.0.1" }), "1.2.3.4")
  })

  it("si no hay un salto más o no es una IP válida, se queda req.ip", () => {
    assert.equal(webProxiedClientIp({ xff: "76.76.21.9", socketIp: "10.0.0.2", trustedAddrs: ["10.0.0.2", "76.76.21.9"], fallback: "76.76.21.9" }), "76.76.21.9")
    assert.equal(webProxiedClientIp({ xff: undefined, socketIp: "10.0.0.2", trustedAddrs: ["10.0.0.2"], fallback: "10.0.0.2" }), "10.0.0.2")
    assert.equal(webProxiedClientIp({ xff: "nope, 76.76.21.9", socketIp: "10.0.0.2", trustedAddrs: ["10.0.0.2", "76.76.21.9"], fallback: "76.76.21.9" }), "76.76.21.9")
  })
})
