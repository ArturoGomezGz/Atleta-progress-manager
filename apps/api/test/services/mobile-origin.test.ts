import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { allowedAuthorizationURL, mobileOrigin } from "../../src/services/mobile-origin"

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

const proxy = (auth: ReturnType<typeof makeAuth>, query: Record<string, string>, hop = "1") =>
  auth.handler(new Request(`${BASE}/api/auth/expo-authorization-proxy?${new URLSearchParams({ ...query, ...(hop ? { hop } : {}) })}`, { redirect: "manual" }))

const GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth"

describe("allowedAuthorizationURL", () => {
  it("solo acepta https hacia accounts.google.com con la ruta de autorización", () => {
    assert.equal(allowedAuthorizationURL(`${GOOGLE}?state=x`), `${GOOGLE}?state=x`)
    assert.equal(allowedAuthorizationURL("http://accounts.google.com/o/oauth2/v2/auth"), null)
    assert.equal(allowedAuthorizationURL("https://evil.com/?u=accounts.google.com"), null)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com.evil.com/o/oauth2/v2/auth"), null)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com@evil.com/o/oauth2/v2/auth"), null)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com:8443/o/oauth2/v2/auth"), null)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com/otra/ruta"), null)
    assert.equal(allowedAuthorizationURL("javascript:alert(1)"), null)
    assert.equal(allowedAuthorizationURL("no es url"), null)
  })

  it("normaliza mayúsculas y :443, y rechaza punto final y barra invertida", () => {
    assert.equal(allowedAuthorizationURL("HTTPS://ACCOUNTS.GOOGLE.COM/o/oauth2/v2/auth?state=x"), `${GOOGLE}?state=x`)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com:443/o/oauth2/v2/auth?state=x"), `${GOOGLE}?state=x`)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com./o/oauth2/v2/auth"), null)
    assert.equal(allowedAuthorizationURL("https://evil.com\\@accounts.google.com/o/oauth2/v2/auth"), null)
    assert.equal(allowedAuthorizationURL("https://accounts.google.com\\@evil.com/o/oauth2/v2/auth"), null)
  })

  it("con client_id conocido exige que coincida", () => {
    assert.equal(allowedAuthorizationURL(`${GOOGLE}?client_id=id&state=x`, "id"), `${GOOGLE}?client_id=id&state=x`)
    assert.equal(allowedAuthorizationURL(`${GOOGLE}?client_id=otro&state=x`, "id"), null)
    assert.equal(allowedAuthorizationURL(`${GOOGLE}?state=x`, "id"), null)
  })
})

describe("expo-authorization-proxy", () => {
  it("rechaza authorizationURL de un host no permitido", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: "https://evil.com/o/oauth2/v2/auth?state=abc" })
    assert.equal(res.status, 400)
    assert.equal(res.headers.get("location"), null)
    assert.equal(res.headers.get("set-cookie"), null)
  })

  it("rechaza authorizationURL de host no permitido aun con oauthState", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: "https://evil.com/o/oauth2/v2/auth", oauthState: "abc" })
    assert.equal(res.status, 400)
    assert.equal(res.headers.get("location"), null)
  })

  it("rechaza si la URL de Google no trae state", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: GOOGLE })
    assert.equal(res.status, 400)
  })

  it("sin hop rebota una vez a BETTER_AUTH_URL con hop=1, sin cookies", async () => {
    const url = `${GOOGLE}?client_id=id&state=abc123`
    const res = await proxy(makeAuth(), { authorizationURL: url, oauthState: "ost" }, "")
    assert.equal(res.status, 302)
    assert.equal(res.headers.get("set-cookie"), null)
    const next = new URL(res.headers.get("location")!)
    assert.equal(`${next.origin}${next.pathname}`, `${BASE}/api/auth/expo-authorization-proxy`)
    assert.equal(next.searchParams.get("authorizationURL"), url)
    assert.equal(next.searchParams.get("oauthState"), "ost")
    assert.equal(next.searchParams.get("hop"), "1")
  })

  it("el rebote también valida el destino", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: "https://evil.com/o/oauth2/v2/auth?state=x" }, "")
    assert.equal(res.status, 400)
    assert.equal(res.headers.get("location"), null)
  })

  it("rechaza un hop distinto de 1", async () => {
    const res = await proxy(makeAuth(), { authorizationURL: `${GOOGLE}?state=x` }, "2")
    assert.equal(res.status, 400)
  })

  it("caso feliz: fija la cookie de estado firmada y redirige a Google", async () => {
    const url = `${GOOGLE}?client_id=id&state=abc123`
    const res = await proxy(makeAuth(), { authorizationURL: url })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get("location"), url)
    const cookie = res.headers.get("set-cookie") ?? ""
    assert.match(cookie, /better-auth\.state=abc123\./)
  })

  it("con oauthState fija la cookie oauth_state y redirige a Google", async () => {
    const url = `${GOOGLE}?client_id=id&state=abc123`
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
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const idToken = `${b64({ alg: "none" })}.${b64({
    sub: "g-1", email: "a@b.com", email_verified: true, name: "A", iss: "https://accounts.google.com", aud: "id",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })

  function fakeGoogle() {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (u.includes("oauth2.googleapis.com/token")) {
        return json({ access_token: "at", id_token: idToken, expires_in: 3600, token_type: "Bearer", scope: "openid email profile" })
      }
      if (u.includes("googleapis.com")) return json({ sub: "g-1", email: "a@b.com", email_verified: true, name: "A", picture: "" })
      return realFetch(input, init)
    }) as typeof fetch
  }

  const cookiesOf = (setCookie: string | null) =>
    (setCookie ?? "").split(/,(?=\s*[\w.-]+=)/).map((c) => c.split(";")[0]!.trim()).filter((c) => c && !c.endsWith("=")).join("; ")

  // Inicia sesión social como la app y completa el callback (el navegador lleva la cookie de estado)
  async function callback(callbackURL: string, expoOrigin = "atleta://") {
    const auth = makeAuth()
    const start = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": expoOrigin },
        body: JSON.stringify({ provider: "google", callbackURL }),
      }),
    )
    assert.equal(start.status, 200)
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")!
    const hopped = await proxy(auth, { authorizationURL: url })
    const browserCookie = cookiesOf(hopped.headers.get("set-cookie"))
    fakeGoogle()
    return auth.handler(
      new Request(`${BASE}/api/auth/callback/google?code=abc&state=${state}`, { headers: { cookie: browserCookie }, redirect: "manual" }),
    )
  }

  it("deja intactas las redirecciones web (state_mismatch va a la página de error, sin cookie)", async () => {
    const auth = makeAuth()
    const start = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "atleta://" },
        body: JSON.stringify({ provider: "google", callbackURL: "atleta:///" }),
      }),
    )
    const { url } = (await start.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")!
    const res = await auth.handler(new Request(`${BASE}/api/auth/callback/google?code=x&state=${state}`, { redirect: "manual" }))
    assert.equal(res.status, 302)
    assert.equal(res.headers.get("location"), `${BASE}/api/auth/error?error=state_mismatch`)
  })

  it("éxito con deep link de la app: redirige a atleta:///?cookie= con la sesión", async () => {
    const res = await callback("atleta:///")
    assert.equal(res.status, 302)
    const location = res.headers.get("location") ?? ""
    assert.ok(location.startsWith("atleta:///?cookie="), location)
    const cookie = new URL(location).searchParams.get("cookie") ?? ""
    assert.match(cookie, /better-auth\.session_token=/)
  })

  it("éxito con callbackURL http(s): la redirección no se modifica", async () => {
    const res = await callback(`${BASE}/dashboard`)
    assert.equal(res.status, 302)
    const location = res.headers.get("location") ?? ""
    assert.equal(location, `${BASE}/dashboard`)
    assert.ok(!location.includes("cookie="))
  })

  it("un esquema no confiable ni siquiera llega a redirigir (sign-in/social lo rechaza)", async () => {
    const res = await makeAuth().handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "atleta://" },
        body: JSON.stringify({ provider: "google", callbackURL: "otraapp://x" }),
      }),
    )
    assert.equal(res.status, 403)
  })
})
