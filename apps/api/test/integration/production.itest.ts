// QA del conector MCP con NODE_ENV=production: los errores INTERNAL no filtran detalles, los logs
// no contienen tokens ni contenido, y los límites de tasa del servidor de autorización (que
// better-auth solo aplica en producción) funcionan.

import assert from "node:assert/strict"
import { Writable } from "node:stream"
import { after, before, describe, it } from "node:test"
import type { FastifyInstance } from "fastify"
import { catalogExerciseIds, createFixtures, type Fixtures } from "./fixtures"
import { connectMcp, insertPat } from "./mcp-helpers"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

describe("conector MCP en modo producción", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let app: FastifyInstance
  let base: string
  const logs: string[] = []

  before(async () => {
    // Con el secreto configurado (como en Railway/Vercel) aplica la protección de IP completa
    process.env.WEB_PROXY_SECRET = "secreto-de-prueba-del-web"
    server = await startTestServer({ env: { NODE_ENV: "production" } })
    fx = await createFixtures(server.baseUrl)
    // Una segunda app con logger a memoria para revisar lo que se escribe en los logs
    const { buildApp } = await import("../../src/app")
    const stream = new Writable({ write(chunk, _enc, cb) { logs.push(String(chunk)); cb() } })
    app = await buildApp({ logger: { level: "info", stream } })
    await app.listen({ port: 0, host: "127.0.0.1" })
    const addr = app.server.address()
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`
  })

  after(async () => {
    await app?.close()
    await server?.close()
    delete process.env.WEB_PROXY_SECRET
  })

  it("INTERNAL no expone el error interno (solo el requestId) y los logs no tienen tokens ni contenido", async () => {
    const { token } = await insertPat(fx.users.coachA.id)
    const [ex] = await catalogExerciseIds(1)
    const c = await connectMcp(base, token)
    const { db } = await import("@atleta/db/client")
    const insert = db.insert
    try {
      // Un fallo inesperado de Postgres al insertar → INTERNAL (se simula: el NUL, que antes lo
      // provocaba, ahora es INVALID_INPUT). El mensaje imita el de Postgres para ver que no se filtra.
      db.insert = (() => {
        throw new Error('insert en postgres falló: invalid byte sequence for encoding "UTF8": 0x00')
      }) as unknown as typeof db.insert
      let r: Awaited<ReturnType<typeof c.callTool>>
      try {
        r = await c.callTool({ name: "create_routine", arguments: { name: "MARCADOR-SECRETO-1" } })
      } finally {
        db.insert = insert
      }
      assert.equal(r.isError, true)
      const error = (r.structuredContent as { error: { code: string; message: string; details?: { requestId?: string } } }).error
      assert.equal(error.code, "INTERNAL")
      assert.equal(error.message, "Ocurrió un error interno. Intenta de nuevo más tarde.")
      assert.ok(error.details?.requestId)
      assert.doesNotMatch(JSON.stringify(r), /UTF8|0x00|postgres|insert|stack/i)

      // Escrituras normales con contenido identificable
      const ok = await c.callTool({
        name: "create_routine",
        arguments: { name: "MARCADOR-SECRETO-2", content: { items: [{ type: "exercise", exerciseId: ex, sets: { count: 1, setType: "reps" }, notes: "MARCADOR-SECRETO-3" }] } },
      })
      assert.equal(ok.isError, undefined)
      await c.callTool({ name: "search_exercises", arguments: { query: "MARCADOR-SECRETO-4" } })
    } finally {
      await c.close()
    }
    await new Promise((r) => setTimeout(r, 50))

    const all = logs.join("")
    assert.ok(!all.includes(token), "el token no aparece")
    assert.ok(!all.includes(token.slice("atl_pat_".length)), "ni sin prefijo")
    assert.ok(!all.includes("MARCADOR-SECRETO"), "ni el contenido ni los argumentos")
    // Pero sí hay una línea estructurada por herramienta
    const toolLines = logs.filter((l) => l.includes('"[mcp] tool"')).map((l) => JSON.parse(l) as { mcp: Record<string, unknown> })
    assert.ok(toolLines.some((l) => l.mcp.tool === "create_routine" && l.mcp.code === "INTERNAL" && l.mcp.ok === false))
    assert.ok(toolLines.every((l) => l.mcp.userId === fx.users.coachA.id && typeof l.mcp.ms === "number"))
    // Un header Authorization inválido se registra solo con el motivo
    await fetch(`${base}/mcp`, { method: "POST", headers: { authorization: "Bearer atl_pat_TOKEN-INVENTADO-123456", "content-type": "application/json" }, body: "{}" })
    await new Promise((r) => setTimeout(r, 50))
    assert.ok(!logs.join("").includes("TOKEN-INVENTADO"))
  })

  it("registro dinámico: límite de 20 por hora por IP", async () => {
    const register = (ip: string) =>
      fetch(`${server.baseUrl}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ client_name: "spam", redirect_uris: ["http://127.0.0.1:1/cb"], token_endpoint_auth_method: "none" }),
      })
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) statuses.push((await register("203.0.113.7")).status)
    assert.deepEqual(statuses.slice(0, 20), Array(20).fill(200))
    assert.equal(statuses[20], 429)
  })

  it("el límite del registro dinámico no se evade rotando X-Forwarded-For", async () => {
    const spam = (url: string, xff: string) =>
      fetch(`${url}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": xff },
        body: JSON.stringify({ client_name: "spam", redirect_uris: ["http://127.0.0.1:1/cb"], token_endpoint_auth_method: "none" }),
      })

    // Producción (TRUST_PROXY por defecto = 1, como en Railway): el edge agrega la IP real al
    // final de X-Forwarded-For; lo que el cliente pone antes no cuenta
    const behindEdge: number[] = []
    for (let i = 0; i < 25; i++) behindEdge.push((await spam(server.baseUrl, `198.51.100.${i}, 203.0.113.50`)).status)
    assert.deepEqual(behindEdge.slice(0, 20), Array(20).fill(200))
    assert.ok(behindEdge.slice(20).every((s) => s === 429), `rotar el primer valor evadió el límite: ${behindEdge.join(",")}`)

    // Sin proxy delante (TRUST_PROXY=false): X-Forwarded-For se ignora y cuenta la IP del socket.
    // Antes, sin header better-auth no limitaba y con header lo elegía el cliente.
    const { buildApp } = await import("../../src/app")
    process.env.TRUST_PROXY = "false"
    const direct = await buildApp({ logger: false })
    delete process.env.TRUST_PROXY
    await direct.listen({ port: 0, host: "127.0.0.1" })
    try {
      const addr = direct.server.address()
      const url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`
      const statuses: number[] = []
      for (let i = 0; i < 25; i++) statuses.push((await spam(url, `198.51.100.${i}`)).status)
      assert.ok(statuses.includes(429), "25 registros desde 'IPs' distintas pasaron sin límite")
    } finally {
      await direct.close()
    }
  })
  describe("firma del web (WEB_PROXY_SECRET)", () => {
    const SECRET = "secreto-de-prueba-del-web"
    const WEB_IP = "76.76.21.9" // IP de salida del web (Vercel): el edge de Railway la agrega al final
    const signIn = (xff: string, signature?: string) =>
      fetch(`${server.baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: server.baseUrl,
          "x-forwarded-for": xff,
          ...(signature === undefined ? {} : { "x-atleta-web-proxy": signature }),
        },
        body: JSON.stringify({ email: "nadie@example.com", password: "incorrecta-123" }),
      })

    before(() => {
      process.env.WEB_PROXY_SECRET = SECRET
    })

    it("con la firma correcta cuenta la IP del usuario: usuarios distintos no comparten el límite de sign-in", async () => {
      // 5 usuarios × 3 intentos desde el mismo web: sin la firma serían 15 intentos de una sola IP
      for (let u = 1; u <= 5; u++) {
        for (let i = 0; i < 3; i++) {
          const res = await signIn(`1.2.3.${u}, ${WEB_IP}`, SECRET)
          assert.notEqual(res.status, 429, `usuario ${u}, intento ${i + 1}: 429 compartido con otros usuarios del web`)
        }
      }
      // …y el límite sigue siendo por usuario (3 cada 10 s)
      assert.equal((await signIn(`1.2.3.1, ${WEB_IP}`, SECRET)).status, 429)
    })

    it("con la firma correcta, lo que el cliente ponga antes de su IP no evade el límite", async () => {
      const statuses: number[] = []
      for (let i = 0; i < 6; i++) statuses.push((await signIn(`9.9.9.${i}, 1.2.4.1, ${WEB_IP}`, SECRET)).status)
      assert.ok(statuses.slice(3).every((s) => s === 429), `rotar el primer valor evadió el límite: ${statuses.join(",")}`)
    })

    for (const [name, signature] of [["incorrecta", "otro-secreto"], ["ausente", undefined]] as const) {
      it(`con la firma ${name} se usa req.ip (TRUST_PROXY): rotar el primer valor no evade el límite`, async () => {
        const webIp = name === "ausente" ? "203.0.113.61" : "203.0.113.60"
        const statuses: number[] = []
        for (let i = 0; i < 6; i++) statuses.push((await signIn(`1.2.5.${i}, ${webIp}`, signature)).status)
        assert.ok(statuses.slice(3).every((s) => s === 429), `rotar el primer valor evadió el límite: ${statuses.join(",")}`)
      })
    }

    it("sin WEB_PROXY_SECRET configurado se conserva el comportamiento previo: usuarios del web no comparten el límite", async () => {
      // Sin secreto no se distingue al web, así que X-Forwarded-For pasa tal cual (better-auth usa
      // el primer valor). Se prioriza no bloquear logins legítimos; index.ts avisa del riesgo.
      delete process.env.WEB_PROXY_SECRET
      try {
        for (let u = 1; u <= 3; u++) {
          for (let i = 0; i < 3; i++) {
            const res = await signIn(`1.2.6.${u}, 203.0.113.62`, "")
            assert.notEqual(res.status, 429, `usuario ${u}, intento ${i + 1}: 429 compartido sin WEB_PROXY_SECRET`)
          }
        }
      } finally {
        process.env.WEB_PROXY_SECRET = SECRET
      }
    })
  })
})
