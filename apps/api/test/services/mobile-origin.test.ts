import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { isAllowedAuthorizationURL, mobileOrigin } from "../../src/services/mobile-origin"

const BASE = "https://web.test"

function makeAuth() {
  return betterAuth({
    baseURL: BASE,
    secret: "test-secret-test-secret-test-secret-1234",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    socialProviders: { google: { clientId: "id", clientSecret: "secret" } },
    plugins: [mobileOrigin()],
    trustedOrigins: [BASE, "atleta://"],
  })
}

const proxy = (auth: ReturnType<typeof makeAuth>, query: Record<string, string>) =>
  auth.handler(new Request(`${BASE}/api/auth/expo-authorization-proxy?${new URLSearchParams(query)}`, { redirect: "manual" }))

describe("isAllowedAuthorizationURL", () => {
  it("solo acepta https hacia accounts.google.com", () => {
    assert.equal(isAllowedAuthorizationURL("https://accounts.google.com/o/oauth2/v2/auth?state=x"), true)
    assert.equal(isAllowedAuthorizationURL("http://accounts.google.com/o/oauth2/v2/auth"), false)
    assert.equal(isAllowedAuthorizationURL("https://evil.com/?u=accounts.google.com"), false)
    assert.equal(isAllowedAuthorizationURL("https://accounts.google.com.evil.com/"), false)
    assert.equal(isAllowedAuthorizationURL("https://accounts.google.com@evil.com/"), false)
    assert.equal(isAllowedAuthorizationURL("https://accounts.google.com:8443/"), false)
    assert.equal(isAllowedAuthorizationURL("javascript:alert(1)"), false)
    assert.equal(isAllowedAuthorizationURL("no es url"), false)
  })
})

describe("expo-authorization-proxy", () => {
  it("rechaza authorizationURL de un host no permitido", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: "https://evil.com/auth?state=abc" })
    assert.equal(res.status, 400)
    assert.equal(res.headers.get("location"), null)
    assert.equal(res.headers.get("set-cookie"), null)
  })

  it("rechaza authorizationURL de host no permitido aun con oauthState", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: "https://evil.com/auth", oauthState: "abc" })
    assert.equal(res.status, 400)
    assert.equal(res.headers.get("location"), null)
  })

  it("rechaza si la URL de Google no trae state", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth" })
    assert.equal(res.status, 400)
  })

  it("caso feliz: fija la cookie de estado firmada y redirige a Google", async () => {
    const url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=id&state=abc123"
    const res = await proxy(makeAuth(), { authorizationURL: url })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get("location"), url)
    const cookie = res.headers.get("set-cookie") ?? ""
    assert.match(cookie, /better-auth\.state=abc123\./)
  })

  it("con oauthState fija la cookie oauth_state y redirige a Google", async () => {
    const url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=id&state=abc123"
    const res = await proxy(makeAuth(), { authorizationURL: url, oauthState: "valor-de-estado" })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get("location"), url)
    assert.match(res.headers.get("set-cookie") ?? "", /better-auth\.oauth_state=valor-de-estado/)
  })
})

describe("onRequest (expo-origin)", () => {
  it("copia expo-origin a origin: un POST con cookies y origen atleta:// pasa la validación", async () => {
    const auth = makeAuth()
    const res = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "atleta://", cookie: "x=y" },
        body: JSON.stringify({ provider: "google", callbackURL: "atleta:///" }),
      }),
    )
    assert.equal(res.status, 200)
    const body = (await res.json()) as { url: string; redirect: boolean }
    assert.equal(body.redirect, true)
    assert.ok(body.url.startsWith("https://accounts.google.com/"))
  })

  it("rechaza un callbackURL de origen no confiable", async () => {
    const res = await makeAuth().handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "atleta://", cookie: "x=y" },
        body: JSON.stringify({ provider: "google", callbackURL: "evil://pwn" }),
      }),
    )
    assert.equal(res.status, 403)
  })
})

describe("hook de /callback/:id", () => {
  it("deja intactas las redirecciones web (state_mismatch va a la página de error, sin cookie)", async () => {
    const auth = makeAuth()
    const start = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "atleta://" },
        body: JSON.stringify({ provider: "google", callbackURL: "atleta:///", errorCallbackURL: "atleta:///login" }),
      }),
    )
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")!
    // Sin la cookie de estado, el callback falla y redirige al errorCallbackURL
    const res = await auth.handler(new Request(`${BASE}/api/auth/callback/google?code=x&state=${state}`, { redirect: "manual" }))
    assert.equal(res.status, 302)
    const location = res.headers.get("location") ?? ""
    assert.equal(location, `${BASE}/api/auth/error?error=state_mismatch`)
  })
})
