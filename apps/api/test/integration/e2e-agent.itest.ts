// E2E del conector MCP por HTTP real, simulando a un agente de IA (como Claude) de principio a fin:
// OAuth completo (DCR → authorize → login → consentimiento → token PKCE) → Client del SDK con
// StreamableHTTPClientTransport → descubrimiento (tools/resources/prompts) → catálogo → rutina
// (crear, leer, round-trip detail → update_routine, edit_routine, herramientas atómicas) → asignar
// → plan de 6 semanas × 4 días con rutinas por key → schedule_plan (dryRun y real) → el atleta con
// su propio token ve solo lo suyo → cancel_plan_assignment → search/fetch → refresh → revokeApp → 401.
// Además: concurrencia de escrituras por HTTP (dos clientes a la vez).

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { catalogExerciseIds, cookieHeader, createFixtures, FIXTURE_EMAILS, FIXTURE_PASSWORD, signUp, type Fixtures, type FixtureUser } from "./fixtures"
import { INITIALIZE, connectMcp, pkcePair, postMcp } from "./mcp-helpers"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

const REDIRECT_URI = "http://127.0.0.1:43999/callback"
const SCOPE = "atleta:read atleta:write offline_access"
const ATHLETE2_EMAIL = "atleta-a2@test.local"

type S = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope: string }

const DAY_MS = 86_400_000
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const isoWeekday = (d: string) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

const EXPECTED_TOOLS = [
  "add_exercise", "adjust_difficulty", "adjust_rest", "archive_routine", "assign_routine", "cancel_assignment",
  "cancel_plan_assignment", "create_exercise", "create_plan", "create_routine", "duplicate_plan", "duplicate_routine",
  "edit_routine", "fetch", "find_alternatives", "get_exercises", "get_plan", "get_routine", "list_assignments", "list_athletes", "list_plans",
  "list_routines", "move_item", "remove_item", "replace_exercise", "schedule_plan", "search", "search_exercises",
  "update_block", "update_item_fields", "update_plan", "update_routine", "update_sets", "whoami",
]

describe("E2E: un agente de IA usa el conector por HTTP real", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let base: string
  let athlete2: FixtureUser
  let ex: string[]
  const clients: Client[] = []

  // Estado que se encadena entre pasos (como lo haría el agente)
  let coachTokens: TokenResponse
  let coachClientId: string
  let coach: Client
  let today: string
  let routineId: string
  let planId: string
  let planAssignmentId: string

  before(async () => {
    server = await startTestServer({
      env: { FEATURE_ALL_USERS: [FIXTURE_EMAILS.coachA, FIXTURE_EMAILS.coachB, FIXTURE_EMAILS.athleteA].join(",") },
    })
    base = server.baseUrl
    fx = await createFixtures(base)
    // Un segundo atleta en el equipo A (sin flags: no usa el conector)
    athlete2 = await signUp(base, ATHLETE2_EMAIL, "Atleta A2")
    const { callerFor } = await import("./fixtures")
    const c2 = await callerFor(athlete2)
    // El plan gratuito admite 1 atleta: se amplía el cupo del equipo A
    const [{ db }, { team }, { eq }] = await Promise.all([import("@atleta/db/client"), import("@atleta/db/schema"), import("drizzle-orm")])
    await db.update(team).set({ maxAthletes: 10 }).where(eq(team.id, fx.teams.a.id))
    const { token } = await fx.callers.coachA.teams.generateInviteLink({ teamId: fx.teams.a.id })
    await c2.teams.joinViaInvite({ token })
    ex = await catalogExerciseIds(5)
  })

  after(async () => {
    await Promise.all(clients.map((c) => c.close().catch(() => {})))
    await server?.close()
  })

  // ─── OAuth (lo que hacen Claude/ChatGPT y la web) ─────────────────────────────

  async function navigate(url: string | URL, cookie?: string): Promise<string> {
    const res = await fetch(url, { redirect: "manual", headers: { "sec-fetch-mode": "navigate", accept: "text/html", ...(cookie && { cookie }) } })
    if (res.status >= 300 && res.status < 400) return res.headers.get("location") ?? ""
    const body = JSON.parse(await res.text()) as { url?: string }
    return body.url ?? ""
  }

  async function oauthLogin(email: string): Promise<{ clientId: string; tokens: TokenResponse }> {
    // 1. Discovery: 401 → PRM → metadata del AS
    const unauth = await postMcp(base, INITIALIZE)
    assert.equal(unauth.status, 401)
    const prmUrl = /resource_metadata="([^"]+)"/.exec(unauth.headers.get("www-authenticate") ?? "")?.[1]
    assert.ok(prmUrl)
    const prm = (await (await fetch(prmUrl)).json()) as { authorization_servers: string[]; resource: string }
    const issuer = new URL(prm.authorization_servers[0]!)
    const md = (await (await fetch(`${issuer.origin}/.well-known/oauth-authorization-server${issuer.pathname}`)).json()) as S

    // 2. DCR público
    const reg = await fetch(md.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Agente E2E", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
    })
    assert.ok(reg.ok, await reg.clone().text())
    const clientId = ((await reg.json()) as { client_id: string }).client_id

    // 3. authorize (sin sesión) → login con oauth_query → consentimiento → code
    const { verifier, challenge } = pkcePair()
    const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, scope: SCOPE, state: "e2e", code_challenge: challenge, code_challenge_method: "S256", resource: prm.resource })
    const login = new URL(await navigate(`${md.authorization_endpoint}?${q}`))
    assert.equal(login.pathname, "/login")
    const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email, password: FIXTURE_PASSWORD, oauth_query: login.search.slice(1) }),
    })
    assert.equal(signIn.status, 200)
    const cookie = cookieHeader(signIn)
    const consentUrl = new URL(((await signIn.json()) as { url: string }).url)
    assert.equal(consentUrl.pathname, "/oauth/consent")
    const consent = await fetch(`${base}/api/auth/oauth2/consent`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie },
      body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
    })
    assert.equal(consent.status, 200)
    const callback = new URL(((await consent.json()) as { url: string }).url)
    assert.equal(callback.searchParams.get("state"), "e2e")
    const code = callback.searchParams.get("code")
    assert.ok(code)

    // 4. token (form-urlencoded + PKCE + resource)
    const tok = await fetch(md.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: REDIRECT_URI, client_id: clientId, resource: prm.resource }).toString(),
    })
    assert.equal(tok.status, 200, await tok.clone().text())
    return { clientId, tokens: (await tok.json()) as TokenResponse }
  }

  async function connect(token: string) {
    const c = await connectMcp(base, token)
    clients.push(c)
    return c
  }

  async function ok(c: Client, name: string, args: Record<string, unknown> = {}): Promise<S> {
    const r = await c.callTool({ name, arguments: args })
    if (r.isError) throw new Error(`${name} falló: ${(r.content as { text: string }[])[0]?.text}`)
    // El texto es el mismo JSON que structuredContent (clientes que solo leen `content`)
    assert.deepEqual(JSON.parse((r.content as { text: string }[])[0]!.text), r.structuredContent)
    return r.structuredContent as S
  }

  async function fail(c: Client, name: string, args: Record<string, unknown> = {}): Promise<{ code: string; message: string; details?: S }> {
    const r = await c.callTool({ name, arguments: args })
    assert.equal(r.isError, true, `${name} debía fallar: ${JSON.stringify(r.structuredContent)}`)
    const text = (r.content as { text: string }[])[0]!.text
    const error = (r.structuredContent as { error: { code: string; message: string; details?: S } }).error
    assert.equal(text, `${error.code}: ${error.message}`)
    return error
  }

  // ─── Flujo ──────────────────────────────────────────────────────────────────

  it("1. OAuth completo y conexión del Client del SDK por Streamable HTTP", async () => {
    const { clientId, tokens } = await oauthLogin(FIXTURE_EMAILS.coachA)
    coachClientId = clientId
    coachTokens = tokens
    assert.match(tokens.access_token, /^atl_oat_/)
    assert.match(tokens.refresh_token ?? "", /^atl_ort_/)
    // En la BD solo quedan hashes: ni el access token ni el refresh (con o sin prefijo) aparecen
    const { db } = await import("@atleta/db/client")
    const { sql } = await import("drizzle-orm")
    for (const table of ["oauth_access_token", "oauth_refresh_token", "oauth_client", "oauth_consent", "session", "verification"]) {
      const rows = (await db.execute(sql.raw(`select row_to_json(t)::text as j from ${table} t`))) as unknown as { j: string }[]
      for (const secret of [tokens.access_token.slice("atl_oat_".length), tokens.refresh_token!.slice("atl_ort_".length)]) {
        assert.ok(rows.every((r) => !r.j.includes(secret)), `${table} contiene un token en claro`)
      }
    }
    coach = await connect(tokens.access_token)
    assert.equal(coach.getServerVersion()?.name, "atleta")
    assert.match(coach.getInstructions() ?? "", /Confirma con el usuario/)
  })

  it("2. descubrimiento: tools/list, resources/list, resources/templates/list y prompts/list", async () => {
    const { tools } = await coach.listTools()
    assert.deepEqual(tools.map((t) => t.name).sort(), EXPECTED_TOOLS)
    for (const t of tools) {
      assert.ok(t.description && t.description.length >= 40, `${t.name}: descripción demasiado corta`)
      assert.equal(t.inputSchema.type, "object", t.name)
      assert.ok(t.annotations, `${t.name}: sin anotaciones`)
    }
    const { resources } = await coach.listResources()
    assert.deepEqual(resources.map((r) => r.uri).sort(), ["atleta://guia/contenido-rutina", "atleta://guia/programacion"])
    const guide = await coach.readResource({ uri: "atleta://guia/contenido-rutina" })
    assert.match((guide.contents[0] as { text: string }).text, /JSON Schema/)
    const { resourceTemplates } = await coach.listResourceTemplates()
    assert.deepEqual(resourceTemplates.map((r) => r.uriTemplate).sort(), ["atleta://planes/{planId}", "atleta://rutinas/{routineId}"])
    const { prompts } = await coach.listPrompts()
    assert.deepEqual(prompts.map((p) => p.name).sort(), ["ajustar_entrenamiento", "crear_entrenamiento", "planificar_mesociclo", "revisar_adherencia"])
  })

  it("3. whoami → list_athletes → search_exercises", async () => {
    const me = await ok(coach, "whoami")
    assert.equal(me.user.email, FIXTURE_EMAILS.coachA)
    assert.equal(me.defaultTeamId, fx.teams.a.id)
    assert.deepEqual(me.scopes.sort(), ["atleta:read", "atleta:write"])
    assert.match(me.today, /^\d{4}-\d{2}-\d{2}$/)
    today = me.today
    const athletes = await ok(coach, "list_athletes")
    assert.deepEqual(athletes.athletes.map((a: S) => a.athleteId).sort(), [fx.users.athleteA.id, athlete2.id].sort())
    const found = await ok(coach, "search_exercises", { movementPattern: "push" })
    assert.ok(found.results.length > 0 && found.results.length <= 12)
    for (const r of found.results) assert.match(r.id, /^[0-9a-f-]{36}$/)
  })

  it("4. create_routine con contenido → get_routine (outline y detail) → round-trip detail → update_routine", async () => {
    const created = await ok(coach, "create_routine", {
      name: "E2E Fuerza",
      content: {
        items: [
          { type: "exercise", exerciseId: ex[0], sets: { count: 3, setType: "reps", targetReps: 8, loadType: "rpe", loadValue: 7 }, restSeconds: 90, tempo: "3-1-1-0", goal: "strength" },
          { type: "exercise", exerciseId: ex[1], sets: [{ setType: "reps", targetReps: 12 }, { setType: "reps", targetReps: 10 }], notes: "Controla la bajada", perSide: true },
          { type: "block", name: "Core", rounds: 3, restBetweenRoundsSeconds: 60, exercises: [{ exerciseId: ex[2], sets: [{ setType: "time", targetDurationSeconds: 30 }] }] },
        ],
      },
    })
    routineId = created.routineId
    assert.equal(created.itemCount, 3)

    const outline = await ok(coach, "get_routine", { routineId })
    assert.equal(outline.updatedAt, created.updatedAt)
    assert.equal(outline.items[0].sets, "3 × 8 reps @ RPE 7")
    assert.equal(outline.items[2].type, "block")

    const detail = await ok(coach, "get_routine", { routineId, format: "detail" })
    assert.equal(Object.keys(detail.exerciseNames).length, 3)
    // Round-trip: lo que devuelve detail se puede mandar tal cual a update_routine (ids conservados)
    const replaced = await ok(coach, "update_routine", { routineId, expectedUpdatedAt: detail.updatedAt, name: "E2E Fuerza v2", content: detail.content })
    assert.equal(replaced.itemCount, 3)
    const again = await ok(coach, "get_routine", { routineId, format: "detail" })
    assert.deepEqual(again.content, detail.content)
    assert.equal(again.name, "E2E Fuerza v2")
  })

  it("5. edit_routine y herramientas atómicas encadenando updatedAt", async () => {
    let r = await ok(coach, "get_routine", { routineId })
    const [first, second, block] = r.items as S[]
    const edited = await ok(coach, "edit_routine", {
      routineId,
      expectedUpdatedAt: r.updatedAt,
      ops: [
        { op: "update_item_fields", itemId: first!.id, restSeconds: 120 },
        { op: "update_block", itemId: block!.id, rounds: 4 },
      ],
    })
    assert.equal(edited.changes.length, 2)

    const added = await ok(coach, "add_exercise", { routineId, expectedUpdatedAt: edited.updatedAt, exerciseId: ex[3], sets: [{ setType: "reps", targetReps: 15 }] })
    assert.equal(added.saved, true)
    const addedId = added.changes[0].itemId as string

    const sets = await ok(coach, "update_sets", { routineId, expectedUpdatedAt: added.updatedAt, itemId: addedId, sets: [{ setType: "reps", targetReps: 6, loadType: "rpe", loadValue: 8 }, { setType: "reps", targetReps: 6, loadType: "rpe", loadValue: 8 }] })
    const harder = await ok(coach, "adjust_difficulty", { routineId, expectedUpdatedAt: sets.updatedAt, direction: "up", knob: "volume", targetItemIds: [addedId] })
    assert.equal(harder.saved, true)
    const rest = await ok(coach, "adjust_rest", { routineId, expectedUpdatedAt: harder.updatedAt, seconds: 75, targetItemIds: [first!.id] })
    const moved = await ok(coach, "move_item", { routineId, expectedUpdatedAt: rest.updatedAt, itemId: addedId, toPosition: 0 })
    const replaced = await ok(coach, "replace_exercise", { routineId, expectedUpdatedAt: moved.updatedAt, itemId: second!.id, newExerciseId: ex[4] })
    const removed = await ok(coach, "remove_item", { routineId, expectedUpdatedAt: replaced.updatedAt, itemId: block!.id })

    r = await ok(coach, "get_routine", { routineId })
    assert.equal(r.updatedAt, removed.updatedAt)
    assert.deepEqual(r.items.map((i: S) => i.id), [addedId, first!.id, second!.id])
    assert.equal(r.items[0].sets, "3 × 6 reps @ RPE 8")
    assert.equal(r.items[1].restSeconds, 75)
    assert.equal(r.items[2].exerciseId, ex[4])
    // Una versión vieja ya no sirve
    assert.equal((await fail(coach, "update_sets", { routineId, expectedUpdatedAt: added.updatedAt, itemId: addedId, sets: [{ setType: "reps", targetReps: 1 }] })).code, "CONFLICT")
  })

  it("6. assign_routine → list_assignments", async () => {
    const assigned = await ok(coach, "assign_routine", { routineId, athleteIds: [fx.users.athleteA.id, athlete2.id] })
    assert.equal(assigned.sessions.length, 1)
    assert.equal(assigned.sessions[0].status, "active")
    // Una sesión solo para el atleta 2 (el atleta 1 no debe verla)
    const only2 = await ok(coach, "assign_routine", { routineId, athleteIds: [athlete2.id], dates: [addDays(today, 3)] })
    assert.equal(only2.sessions[0].status, "scheduled")
    const list = await ok(coach, "list_assignments", {})
    const ids = list.assignments.map((a: S) => a.sessionId)
    assert.ok(ids.includes(assigned.sessions[0].sessionId) && ids.includes(only2.sessions[0].sessionId))
    const s = list.assignments.find((a: S) => a.sessionId === assigned.sessions[0].sessionId)
    assert.deepEqual(s.athletes.map((a: S) => a.athleteId).sort(), [fx.users.athleteA.id, athlete2.id].sort())
  })

  it("7. create_plan 6 semanas × 4 días con rutinas por key → get_plan", async () => {
    const days = [1, 2, 4, 5]
    const created = await ok(coach, "create_plan", {
      name: "E2E Mesociclo",
      goal: "Fuerza base",
      weeks: 6,
      weekMeta: [{ week: 1, name: "Acumulación" }, { week: 6, name: "Descarga", focus: "Recuperación" }],
      routines: [
        { key: "pierna", name: "E2E Pierna", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 4, setType: "reps", targetReps: 6, loadType: "rpe", loadValue: 8 } }] } },
        { key: "torso", name: "E2E Torso", content: { items: [{ type: "exercise", exerciseId: ex[1], sets: { count: 4, setType: "reps", targetReps: 8 } }] } },
      ],
      workouts: Array.from({ length: 6 }, (_, w) => days.map((d, i) => ({ week: w + 1, weekday: d, routineKey: i % 2 === 0 ? "pierna" : "torso" }))).flat(),
    })
    planId = created.planId
    assert.equal(created.workoutCount, 24)
    assert.deepEqual(created.createdRoutines.map((r: S) => r.key).sort(), ["pierna", "torso"])
    const plan = await ok(coach, "get_plan", { planId })
    assert.equal(plan.weeks, 6)
    assert.equal(plan.schedule.length, 6)
    assert.deepEqual(plan.schedule[0].days.map((d: S) => d.weekday), days)
    assert.equal(plan.schedule[5].name, "Descarga")
  })

  it("8. schedule_plan dryRun (no escribe) → schedule_plan real con fechas ISO correctas", async () => {
    const { db } = await import("@atleta/db/client")
    const { sql } = await import("drizzle-orm")
    const countSessions = async () => ((await db.execute(sql`select count(*)::int as n from training_session`)) as unknown as { n: number }[])[0]!.n
    // Próximo lunes (siempre en el futuro): ningún hueco se omite
    const startDate = addDays(today, 8 - isoWeekday(today))
    assert.equal(isoWeekday(startDate), 1)
    const athleteIds = [fx.users.athleteA.id, athlete2.id]

    const before = await countSessions()
    const dry = await ok(coach, "schedule_plan", { planId, athleteIds, startDate, dryRun: true })
    assert.equal(dry.assignmentId, null)
    assert.equal(dry.sessions.length, 24)
    assert.deepEqual(dry.skipped, [])
    assert.equal(await countSessions(), before, "dryRun no escribe")
    for (const s of dry.sessions) {
      assert.equal(s.date, addDays(startDate, (s.week - 1) * 7 + (s.weekday - 1)))
      assert.equal(isoWeekday(s.date), s.weekday)
    }

    const real = await ok(coach, "schedule_plan", { planId, athleteIds, startDate })
    planAssignmentId = real.assignmentId
    assert.ok(planAssignmentId)
    assert.equal(real.sessions.length, 24)
    assert.ok(real.sessions.every((s: S) => s.sessionId && s.status === "scheduled"))
    assert.deepEqual(real.sessions.map((s: S) => s.date), dry.sessions.map((s: S) => s.date))
    assert.equal(await countSessions(), before + 24)
  })

  it("9. el atleta, con su propio token OAuth, ve sus sesiones (y no las de otros)", async () => {
    const { tokens } = await oauthLogin(FIXTURE_EMAILS.athleteA)
    const athlete = await connect(tokens.access_token)
    const me = await ok(athlete, "whoami")
    assert.deepEqual(me.teams.map((t: S) => t.role), ["athlete"])

    const mine = await ok(athlete, "list_assignments", { limit: 100 })
    const fromPlan = mine.assignments.filter((a: S) => a.planAssignmentId === planAssignmentId)
    assert.equal(fromPlan.length, 24)
    assert.ok(mine.assignments.every((a: S) => a.athletes === undefined), "un atleta no ve la lista de atletas")
    // La sesión asignada solo al atleta 2 no aparece, aunque pida la de otro atleta
    const ofOther = await ok(athlete, "list_assignments", { athleteId: athlete2.id, limit: 100 })
    assert.deepEqual(ofOther.assignments.map((a: S) => a.sessionId).sort(), mine.assignments.map((a: S) => a.sessionId).sort())
    const { db } = await import("@atleta/db/client")
    const { athleteSession } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    const own = new Set((await db.select({ id: athleteSession.sessionId }).from(athleteSession).where(eq(athleteSession.athleteId, fx.users.athleteA.id))).map((r) => r.id))
    assert.ok(mine.assignments.every((a: S) => own.has(a.sessionId)), "solo sesiones donde el atleta está asignado")
    // Otro equipo
    assert.equal((await fail(athlete, "list_assignments", { teamId: fx.teams.b.id })).code, "FORBIDDEN")
    // Las herramientas de escritura del atleta fallan por rol (aunque su token tenga atleta:write)
    assert.equal((await fail(athlete, "schedule_plan", { planId, athleteIds: [fx.users.athleteA.id], startDate: today, dryRun: true })).code, "FORBIDDEN")
    assert.equal((await fail(athlete, "cancel_plan_assignment", { assignmentId: planAssignmentId })).code, "FORBIDDEN")
    // Ve el plan pero no sus asignaciones
    assert.deepEqual((await ok(athlete, "get_plan", { planId })).assignments, [])
  })

  it("10. cancel_plan_assignment cancela lo no iniciado", async () => {
    const res = await ok(coach, "cancel_plan_assignment", { assignmentId: planAssignmentId })
    assert.equal(res.cancelledSessions, 24)
    assert.equal(res.keptSessions, 0)
    assert.equal(res.status, "cancelled")
    const left = await ok(coach, "list_assignments", { planAssignmentId, status: ["scheduled", "active"] })
    assert.equal(left.assignments.length, 0)
    const plan = await ok(coach, "get_plan", { planId })
    assert.equal(plan.assignments[0].status, "cancelled")
    assert.equal(plan.assignments[0].sessions.cancelled, 24)
  })

  it("11. search / fetch (forma de ChatGPT)", async () => {
    const found = await ok(coach, "search", { query: "e2e" })
    const ids = found.results.map((r: S) => r.id)
    assert.ok(ids.includes(`routine:${routineId}`), JSON.stringify(ids))
    assert.ok(ids.includes(`plan:${planId}`), JSON.stringify(ids))
    for (const r of found.results) assert.ok(r.title && r.url.startsWith(base))
    const doc = await ok(coach, "fetch", { id: `routine:${routineId}` })
    assert.equal(doc.title, "E2E Fuerza v2")
    assert.match(doc.text, /^# E2E Fuerza v2/)
    const planDoc = await ok(coach, "fetch", { id: `plan:${planId}` })
    assert.match(planDoc.text, /Semana 6: Descarga/)
  })

  it("12. concurrencia por HTTP: dos update_routine con el mismo expectedUpdatedAt → exactamente uno gana", async () => {
    const other = await connect(coachTokens.access_token)
    const current = await ok(coach, "get_routine", { routineId, format: "detail" })
    const results = await Promise.all(
      [coach, other].map((c, i) => c.callTool({ name: "update_routine", arguments: { routineId, expectedUpdatedAt: current.updatedAt, name: `Carrera ${i}` } })),
    )
    const winners = results.filter((r) => !r.isError)
    const losers = results.filter((r) => r.isError)
    assert.equal(winners.length, 1, JSON.stringify(results.map((r) => r.structuredContent)))
    assert.equal((losers[0]!.structuredContent as S).error.code, "CONFLICT")
    const after = await ok(coach, "get_routine", { routineId })
    assert.equal(after.updatedAt, (winners[0]!.structuredContent as S).updatedAt)
  })

  it("13. refresh token → access token nuevo que funciona", async () => {
    const res = await fetch(`${base}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: coachTokens.refresh_token!, client_id: coachClientId }).toString(),
    })
    assert.equal(res.status, 200, await res.clone().text())
    const next = (await res.json()) as TokenResponse
    assert.notEqual(next.access_token, coachTokens.access_token)
    const c = await connect(next.access_token)
    assert.equal((await ok(c, "whoami")).user.email, FIXTURE_EMAILS.coachA)
    coachTokens = { ...next, refresh_token: next.refresh_token ?? coachTokens.refresh_token }
  })

  it("14. revocar la app desde mcp.revokeApp → 401 con el token vigente y el refresh", async () => {
    await fx.callers.coachA.mcp.revokeApp({ clientId: coachClientId })
    const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${coachTokens.access_token}` })
    assert.equal(res.status, 401)
    assert.match(res.headers.get("www-authenticate") ?? "", /error="invalid_token"/)
    // Un cliente ya conectado deja de poder llamar herramientas
    await assert.rejects(coach.callTool({ name: "whoami", arguments: {} }))
    const refresh = await fetch(`${base}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: coachTokens.refresh_token!, client_id: coachClientId }).toString(),
    })
    assert.ok(refresh.status >= 400 && refresh.status < 500)
  })
})
