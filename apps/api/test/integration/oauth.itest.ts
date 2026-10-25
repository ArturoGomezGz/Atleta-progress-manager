// Conector MCP — OAuth 2.1 de punta a punta contra la API real (casos 1 y 2 de docs/mcp.md):
// discovery (401 + WWW-Authenticate → PRM → metadata del AS), registro dinámico público,
// authorize → login con oauth_query → consentimiento → code → token (form-urlencoded + PKCE)
// → cliente MCP del SDK → refresh; negativos y revocación.
// En las pruebas WEB_URL = BETTER_AUTH_URL = API_PUBLIC_URL = origen del servidor de prueba.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { cookieHeader, createFixtures, FIXTURE_EMAILS, FIXTURE_PASSWORD, type Fixtures } from "./fixtures"
import { INITIALIZE, connectMcp, pkcePair, postMcp } from "./mcp-helpers"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

const REDIRECT_URI = "http://127.0.0.1:43123/callback"
const SCOPE = "atleta:read atleta:write offline_access"

type TokenResponse = { access_token: string; refresh_token?: string; token_type: string; expires_in: number; scope: string }

describe("conector MCP: OAuth", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let base: string

  before(async () => {
    server = await startTestServer()
    base = server.baseUrl
    fx = await createFixtures(base)
  })

  after(async () => {
    await server?.close()
  })

  async function register(body: Record<string, unknown> = {}) {
    return fetch(`${base}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Cliente de prueba",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        ...body,
      }),
    })
  }

  async function registerClient(): Promise<string> {
    const res = await register()
    // RFC 7591 pide 201; better-auth 1.6.9 responde 200 (los clientes MCP aceptan cualquier 2xx)
    assert.ok(res.ok, await res.clone().text())
    const body = (await res.json()) as { client_id: string; client_secret?: string; token_endpoint_auth_method: string }
    assert.equal(body.client_secret, undefined)
    assert.equal(body.token_endpoint_auth_method, "none")
    return body.client_id
  }

  function authorizeUrl(clientId: string, challenge: string, over: Record<string, string> = {}) {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state: "estado-123",
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...over,
    })
    return `${base}/api/auth/oauth2/authorize?${q}`
  }

  function token(params: Record<string, string>) {
    return fetch(`${base}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams(params).toString(),
    })
  }

  /**
   * GET como navegación del navegador (como cuando el cliente abre /authorize). better-auth
   * responde 302; si detecta un fetch (sec-fetch-mode: cors, que undici agrega) responde JSON
   * `{ redirect, url }`. Devuelve el destino en cualquiera de los dos casos.
   */
  async function navigate(url: string | URL, cookie?: string): Promise<{ status: number; location: string }> {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "sec-fetch-mode": "navigate", accept: "text/html", ...(cookie && { cookie }) },
    })
    if (res.status >= 300 && res.status < 400) return { status: res.status, location: res.headers.get("location") ?? "" }
    const text = await res.text()
    let location = ""
    try {
      const body = JSON.parse(text) as { redirect?: boolean; url?: string }
      if (body.redirect && body.url) return { status: 302, location: body.url }
    } catch {}
    return { status: res.status, location }
  }

  /**
   * authorize sin sesión → login con oauth_query. Devuelve la cookie y, si el usuario aún no
   * consintió a este cliente, la query firmada de la página de consentimiento; si ya consintió,
   * la URL de retorno con el code.
   */
  async function authorizeAndSignIn(clientId: string, challenge: string, email: string = FIXTURE_EMAILS.coachA) {
    const auth = await navigate(authorizeUrl(clientId, challenge))
    assert.equal(auth.status, 302)
    const login = new URL(auth.location)
    assert.equal(`${login.origin}${login.pathname}`, `${base}/login`)
    assert.ok(login.searchParams.get("sig"))
    assert.equal(login.searchParams.get("client_id"), clientId)

    // Lo que hace la web: signIn.email con oauth_query (lo inyecta oauthProviderClient)
    const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email, password: FIXTURE_PASSWORD, oauth_query: login.search.slice(1) }),
    })
    assert.equal(signIn.status, 200, await signIn.clone().text())
    const cookie = cookieHeader(signIn)
    const signInBody = (await signIn.json()) as { redirect?: boolean; url?: string }
    assert.equal(signInBody.redirect, true)
    const next = new URL(signInBody.url!)
    if (`${next.origin}${next.pathname}` === REDIRECT_URI) return { cookie, callback: next }
    assert.equal(`${next.origin}${next.pathname}`, `${base}/oauth/consent`)
    assert.equal(next.searchParams.get("client_id"), clientId)
    assert.ok(next.searchParams.get("sig"))
    return { cookie, consentQuery: next.search.slice(1) }
  }

  /** Primer authorize de un cliente nuevo: siempre pasa por la página de consentimiento. */
  async function authorizeWithLogin(clientId: string, challenge: string, email: string = FIXTURE_EMAILS.coachA) {
    const r = await authorizeAndSignIn(clientId, challenge, email)
    assert.ok(r.consentQuery, "un cliente nuevo exige consentimiento")
    return { cookie: r.cookie, consentQuery: r.consentQuery }
  }

  async function giveConsent(cookie: string, consentQuery: string, accept = true) {
    const res = await fetch(`${base}/api/auth/oauth2/consent`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie },
      body: JSON.stringify({ accept, oauth_query: consentQuery }),
    })
    assert.equal(res.status, 200, await res.clone().text())
    const body = (await res.json()) as { redirect: boolean; url: string }
    return new URL(body.url)
  }

  /** Error OAuth del endpoint de token: 4xx con `error` y sin access_token. */
  async function assertTokenError(res: Response, what: string) {
    const text = await res.text()
    assert.ok(res.status >= 400 && res.status < 500, `${what}: ${res.status} ${text}`)
    const body = JSON.parse(text) as { error?: string; access_token?: string }
    assert.ok(body.error, `${what}: sin campo error`)
    assert.equal(body.access_token, undefined)
  }

  async function fullFlow(email: string = FIXTURE_EMAILS.coachA) {
    const clientId = await registerClient()
    const { verifier, challenge } = pkcePair()
    const { cookie, consentQuery } = await authorizeWithLogin(clientId, challenge, email)
    const callback = await giveConsent(cookie, consentQuery)
    const code = callback.searchParams.get("code")!
    const res = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: REDIRECT_URI, client_id: clientId })
    assert.equal(res.status, 200, await res.clone().text())
    return { clientId, cookie, tokens: (await res.json()) as TokenResponse }
  }

  it("discovery: /mcp sin token → 401 con WWW-Authenticate y resource_metadata", async () => {
    const res = await postMcp(base, INITIALIZE)
    assert.equal(res.status, 401)
    const header = res.headers.get("www-authenticate") ?? ""
    assert.match(header, /^Bearer /)
    assert.ok(header.includes(`resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`), header)
    assert.ok(header.includes(`scope="atleta:read atleta:write"`), header)
    assert.ok(!header.includes("error="), "sin token no hay error=invalid_token")
    const body = (await res.json()) as { jsonrpc: string; error: { code: number } }
    assert.equal(body.jsonrpc, "2.0")

    const bad = await postMcp(base, INITIALIZE, { authorization: `Bearer atl_oat_${"x".repeat(32)}` })
    assert.equal(bad.status, 401)
    assert.match(bad.headers.get("www-authenticate") ?? "", /error="invalid_token"/)
  })

  it("discovery: Protected Resource Metadata en la raíz y en /mcp", async () => {
    for (const path of ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]) {
      const res = await fetch(`${base}${path}`)
      assert.equal(res.status, 200)
      const prm = (await res.json()) as Record<string, unknown>
      assert.equal(prm.resource, `${base}/mcp`)
      assert.deepEqual(prm.authorization_servers, [`${base}/api/auth`])
      assert.deepEqual(prm.scopes_supported, ["atleta:read", "atleta:write", "offline_access"])
      assert.deepEqual(prm.bearer_methods_supported, ["header"])
      assert.equal(prm.resource_documentation, `${base}/settings/conectar-ia`)
    }
  })

  it("discovery: metadata del servidor de autorización (RFC 8414)", async () => {
    for (const path of ["/.well-known/oauth-authorization-server/api/auth", "/.well-known/oauth-authorization-server"]) {
      const res = await fetch(`${base}${path}`)
      assert.equal(res.status, 200)
      const md = (await res.json()) as Record<string, unknown>
      assert.equal(md.issuer, `${base}/api/auth`)
      assert.equal(md.authorization_endpoint, `${base}/api/auth/oauth2/authorize`)
      assert.equal(md.token_endpoint, `${base}/api/auth/oauth2/token`)
      assert.equal(md.registration_endpoint, `${base}/api/auth/oauth2/register`)
      assert.deepEqual(md.code_challenge_methods_supported, ["S256"])
      assert.ok((md.token_endpoint_auth_methods_supported as string[]).includes("none"))
      assert.deepEqual(md.grant_types_supported, ["authorization_code", "refresh_token"])
      assert.deepEqual(md.scopes_supported, ["atleta:read", "atleta:write", "offline_access"])
      assert.equal(md.jwks_uri, undefined)
    }
  })

  it("de punta a punta: DCR → authorize → login → consentimiento → token → cliente MCP → refresh", async () => {
    const { clientId, cookie, tokens } = await fullFlow()
    assert.match(tokens.access_token, /^atl_oat_/)
    assert.match(tokens.refresh_token ?? "", /^atl_ort_/)
    assert.equal(tokens.token_type, "Bearer")
    assert.equal(tokens.expires_in, 3600)
    assert.deepEqual(tokens.scope.split(" ").sort(), ["atleta:read", "atleta:write", "offline_access"])

    // El plugin guarda el hash, nunca el token
    const { db } = await import("@atleta/db/client")
    const { oauthAccessToken, oauthConsent } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    const rows = await db.select().from(oauthAccessToken).where(eq(oauthAccessToken.clientId, clientId))
    assert.equal(rows.length, 1)
    assert.ok(!tokens.access_token.includes(rows[0]!.token!))
    const { hashOAuthToken } = await import("../../src/mcp/auth")
    assert.equal(rows[0]!.token, hashOAuthToken(tokens.access_token.slice("atl_oat_".length)))
    const consents = await db.select().from(oauthConsent).where(eq(oauthConsent.clientId, clientId))
    assert.equal(consents.length, 1)
    assert.equal(consents[0]!.userId, fx.users.coachA.id)

    // Cliente del SDK sobre Streamable HTTP
    const client = await connectMcp(base, tokens.access_token)
    assert.equal(client.getServerVersion()?.name, "atleta")
    await client.ping()
    // Sin herramientas registradas el SDK no anuncia `tools` y tools/list no existe
    if (client.getServerCapabilities()?.tools) {
      const { tools } = await client.listTools()
      assert.ok(Array.isArray(tools))
    } else {
      await assert.rejects(client.listTools(), /Method not found/)
    }
    await client.close()

    // Con la sesión todavía activa y el consentimiento guardado, un authorize nuevo devuelve el code directo
    const second = pkcePair()
    const again = await navigate(authorizeUrl(clientId, second.challenge), cookie)
    assert.equal(again.status, 302)
    const back = new URL(again.location)
    assert.equal(`${back.origin}${back.pathname}`, REDIRECT_URI)
    assert.ok(back.searchParams.get("code"))
    assert.equal(back.searchParams.get("state"), "estado-123")

    // Refresh (offline_access): token nuevo; el refresh anterior queda revocado
    const refreshed = await token({ grant_type: "refresh_token", refresh_token: tokens.refresh_token!, client_id: clientId })
    assert.equal(refreshed.status, 200, await refreshed.clone().text())
    const next = (await refreshed.json()) as TokenResponse
    assert.match(next.access_token, /^atl_oat_/)
    assert.notEqual(next.access_token, tokens.access_token)
    const ok = await postMcp(base, INITIALIZE, { authorization: `Bearer ${next.access_token}` })
    assert.equal(ok.status, 200)
    const reused = await token({ grant_type: "refresh_token", refresh_token: tokens.refresh_token!, client_id: clientId })
    await assertTokenError(reused, "refresh token reutilizado")
  })

  it("negativos del token: verifier incorrecto, code reutilizado, redirect_uri distinto, resource inválido", async () => {
    const clientId = await registerClient()

    async function freshCode() {
      const { verifier, challenge } = pkcePair()
      const r = await authorizeAndSignIn(clientId, challenge)
      const callback = r.callback ?? (await giveConsent(r.cookie, r.consentQuery!))
      return { verifier, code: callback.searchParams.get("code")! }
    }

    const a = await freshCode()
    const wrongVerifier = await token({ grant_type: "authorization_code", code: a.code, code_verifier: pkcePair().verifier, redirect_uri: REDIRECT_URI, client_id: clientId })
    await assertTokenError(wrongVerifier, "verifier incorrecto")

    const b = await freshCode()
    const params = { grant_type: "authorization_code", code: b.code, code_verifier: b.verifier, redirect_uri: REDIRECT_URI, client_id: clientId }
    assert.equal((await token(params)).status, 200)
    await assertTokenError(await token(params), "code reutilizado")

    const c = await freshCode()
    const otherRedirect = await token({ ...params, code: c.code, code_verifier: c.verifier, redirect_uri: "http://127.0.0.1:43123/otra" })
    await assertTokenError(otherRedirect, "redirect_uri distinto")

    const d = await freshCode()
    const badResource = await token({ ...params, code: d.code, code_verifier: d.verifier, resource: "https://otro-servidor.example.com/mcp" })
    await assertTokenError(badResource, "resource inválido")

    const e = await freshCode()
    const goodResource = await token({ ...params, code: e.code, code_verifier: e.verifier, resource: `${base}/mcp` })
    assert.equal(goodResource.status, 200, await goodResource.clone().text())
  })

  it("negativos de authorize: redirect_uri no registrado, PKCE plain o ausente, consentimiento rechazado", async () => {
    const clientId = await registerClient()
    const { challenge } = pkcePair()
    const { cookie } = await authorizeWithLogin(clientId, challenge)

    // redirect_uri ajeno: nunca se redirige ahí
    const evil = await navigate(authorizeUrl(clientId, challenge, { redirect_uri: "https://atacante.example.com/cb" }), cookie)
    const evilLocation = evil.location
    assert.ok(!evilLocation.startsWith("https://atacante.example.com"), evilLocation)
    assert.ok(evil.status >= 400 || evilLocation.includes("error=invalid_redirect"), `${evil.status} ${evilLocation}`)

    // PKCE plain
    const plain = await navigate(authorizeUrl(clientId, "verificador-plano-1234567890-abcdefghijk", { code_challenge_method: "plain" }), cookie)
    const plainLocation = plain.location
    assert.ok(plain.status >= 400 || plainLocation.includes("error="), `${plain.status} ${plainLocation}`)
    assert.ok(!plainLocation.includes("code="), "plain no recibe code")

    // Sin PKCE
    const q = new URL(authorizeUrl(clientId, challenge))
    q.searchParams.delete("code_challenge")
    q.searchParams.delete("code_challenge_method")
    const noPkce = await navigate(q, cookie)
    const noPkceLocation = noPkce.location
    assert.ok(noPkce.status >= 400 || noPkceLocation.includes("error="), `${noPkce.status} ${noPkceLocation}`)
    assert.ok(!new URL(noPkceLocation || base).searchParams.get("code"))

    // Rechazar el consentimiento → access_denied hacia el cliente, sin code
    const other = await registerClient()
    const flow = await authorizeWithLogin(other, pkcePair().challenge)
    const denied = await giveConsent(flow.cookie, flow.consentQuery, false)
    assert.equal(denied.searchParams.get("error"), "access_denied")
    assert.equal(denied.searchParams.get("code"), null)
  })

  it("registro dinámico: skip_consent prohibido; create-client y admin bloqueados en el proxy", async () => {
    const skip = await register({ skip_consent: true })
    assert.equal(skip.status, 400)

    const { cookie } = await authorizeWithLogin(await registerClient(), pkcePair().challenge)
    for (const path of ["/api/auth/oauth2/create-client", "/api/auth/oauth2//create-client", "/api/auth/oauth2/get-clients", "/api/auth/admin/oauth2/create-client"]) {
      const res = await fetch(`${base}${path}`, {
        method: path.includes("get-clients") ? "GET" : "POST",
        headers: { "content-type": "application/json", origin: base, cookie },
        body: path.includes("get-clients") ? undefined : JSON.stringify({ redirect_uris: [REDIRECT_URI], skip_consent: true }),
      })
      assert.equal(res.status, 404, path)
    }

    // Un cliente confidencial pedido sin autenticación queda como público (sin secret)
    const confidential = await register({ token_endpoint_auth_method: "client_secret_post" })
    assert.ok(confidential.ok)
    const body = (await confidential.json()) as { client_secret?: string; token_endpoint_auth_method: string }
    assert.equal(body.token_endpoint_auth_method, "none")
    assert.equal(body.client_secret, undefined)
  })

  it("revokeApp desconecta la app: el token deja de valer y la lista queda vacía", async () => {
    const { clientId, tokens } = await fullFlow(FIXTURE_EMAILS.coachB)
    const auth = { authorization: `Bearer ${tokens.access_token}` }
    assert.equal((await postMcp(base, INITIALIZE, auth)).status, 200)

    const apps = await fx.callers.coachB.mcp.listConnectedApps()
    assert.deepEqual(apps.map((a) => a.clientId), [clientId])
    assert.equal(apps[0]!.name, "Cliente de prueba")

    await fx.callers.coachB.mcp.revokeApp({ clientId })
    assert.equal((await postMcp(base, INITIALIZE, auth)).status, 401)
    assert.deepEqual(await fx.callers.coachB.mcp.listConnectedApps(), [])
    const refreshed = await token({ grant_type: "refresh_token", refresh_token: tokens.refresh_token!, client_id: clientId })
    await assertTokenError(refreshed, "refresh tras revokeApp")
    await assert.rejects(fx.callers.coachB.mcp.revokeApp({ clientId }), /no está conectada/)
  })

  it("cliente deshabilitado (oauth_client.disabled) → 401 aunque el token no haya expirado", async () => {
    const { clientId, tokens } = await fullFlow()
    const auth = { authorization: `Bearer ${tokens.access_token}` }
    assert.equal((await postMcp(base, INITIALIZE, auth)).status, 200)
    const { db } = await import("@atleta/db/client")
    const { oauthClient } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    await db.update(oauthClient).set({ disabled: true }).where(eq(oauthClient.clientId, clientId))
    assert.equal((await postMcp(base, INITIALIZE, auth)).status, 401)
  })

  it("token OAuth expirado → 401", async () => {
    const { clientId, tokens } = await fullFlow()
    const { db } = await import("@atleta/db/client")
    const { oauthAccessToken } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    await db.update(oauthAccessToken).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(oauthAccessToken.clientId, clientId))
    const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${tokens.access_token}` })
    assert.equal(res.status, 401)
    assert.match(res.headers.get("www-authenticate") ?? "", /error="invalid_token"/)
  })
})
