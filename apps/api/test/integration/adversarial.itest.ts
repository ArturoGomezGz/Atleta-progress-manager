// QA adversarial del conector MCP: IDOR entre equipos en todas las herramientas que reciben ids,
// atleta con herramientas de escritura, entradas límite y malformadas, concurrencia, calendario,
// HTTP (batch, Origin/CORS, cuerpo, tipos de contenido), regresión de la web y calidad de lo que
// recibe el LLM (esquemas publicados, mensajes de error, tamaño de las respuestas).
//
// Las pruebas de los bugs del reporte de QA (BUG-1 a BUG-13) ya no son `todo`: cada una verifica
// su corrección. Un bug nuevo se puede marcar con `{ todo: "BUG-N: …" }` hasta corregirlo.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { catalogExerciseIds, createFixtures, createPrivateTeamExercise, type Fixtures } from "./fixtures"
import { INITIALIZE, connectMcp, insertPat, postMcp } from "./mcp-helpers"
import { mcpClientFor, utcDate, type McpTestClient, type ToolError } from "./mcp-inmemory"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

type S = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const DAY_MS = 86_400_000
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const isoWeekday = (d: string) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
const mondayOf = (d: string) => addDays(d, 1 - isoWeekday(d))

const DENIED = new Set(["FORBIDDEN", "NOT_FOUND"])

describe("QA adversarial del conector MCP", { skip: integrationSkip }, () => {
  let server: TestServer
  let base: string
  let fx: Fixtures
  let ex: string[]
  let coachA: McpTestClient
  let coachB: McpTestClient
  let athlete: McpTestClient
  let today: string

  // Recursos de la víctima (equipo B)
  const B: S = {}
  // Recursos del atacante (equipo A)
  const A: S = {}

  before(async () => {
    server = await startTestServer()
    base = server.baseUrl
    fx = await createFixtures(base)
    ex = await catalogExerciseIds(4)
    ;[coachA, coachB, athlete] = await Promise.all([fx.users.coachA, fx.users.coachB, fx.users.athleteA].map((u) => mcpClientFor(u)))
    today = utcDate()

    // ── Equipo B: rutina con ejercicio y circuito, plan programado, sesión, ejercicio privado
    await fx.callers.coachB.teams.toggleSelfTraining({ teamId: fx.teams.b.id, enabled: true })
    B.privateExercise = await createPrivateTeamExercise(fx.teams.b.id, fx.users.coachB.id, "Secreto de B")
    const rb = await coachB.ok<S>("create_routine", {
      name: "Rutina confidencial de B",
      content: {
        items: [
          { type: "exercise", exerciseId: B.privateExercise, sets: { count: 2, setType: "reps", targetReps: 5 }, restSeconds: 60 },
          { type: "block", name: "Circuito B", rounds: 3, exercises: [{ exerciseId: ex[0], sets: [{ setType: "reps", targetReps: 10 }] }] },
        ],
      },
    })
    B.routineId = rb.routineId
    const outline = await coachB.ok<S>("get_routine", { routineId: B.routineId })
    B.itemId = outline.items[0].id
    B.blockId = outline.items[1].id
    B.blockExerciseId = outline.items[1].exercises[0].id
    B.session = (await coachB.ok<S>("assign_routine", { routineId: B.routineId, athleteIds: [fx.users.coachB.id] })).sessions[0].sessionId
    const pb = await coachB.ok<S>("create_plan", {
      name: "Plan confidencial de B",
      weeks: 2,
      routines: [{ key: "b", name: "Rutina de plan B", content: { items: [{ type: "exercise", exerciseId: ex[1], sets: { count: 1, setType: "reps" } }] } }],
      workouts: [{ week: 1, weekday: 7, routineKey: "b" }, { week: 2, weekday: 7, routineKey: "b" }],
    })
    B.planId = pb.planId
    B.planRoutineId = pb.createdRoutines[0].routineId
    B.workoutId = (await coachB.ok<S>("get_plan", { planId: B.planId })).schedule[0].days[0].workouts[0].workoutId
    B.assignmentId = (await coachB.ok<S>("schedule_plan", { planId: B.planId, athleteIds: [fx.users.coachB.id], startDate: today })).assignmentId

    // ── Equipo A
    const ra = await coachA.ok<S>("create_routine", { name: "Rutina de A", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 3, setType: "reps", targetReps: 8 } }] } })
    A.routineId = ra.routineId
    A.itemId = (await coachA.ok<S>("get_routine", { routineId: A.routineId })).items[0].id
    const pa = await coachA.ok<S>("create_plan", { name: "Plan de A", weeks: 1, workouts: [{ week: 1, weekday: 1, routineId: A.routineId }] })
    A.planId = pa.planId
    A.planUpdatedAt = pa.updatedAt
  })

  after(async () => {
    await Promise.all([coachA, coachB, athlete].map((c) => c?.close()))
    await server?.close()
  })

  async function snapshotB() {
    const r = await coachB.ok<S>("get_routine", { routineId: B.routineId, format: "detail" })
    const p = await coachB.ok<S>("get_plan", { planId: B.planId })
    const sessions = await coachB.ok<S>("list_assignments", { teamId: fx.teams.b.id, limit: 100 })
    return JSON.stringify({ r, p, s: sessions.assignments.map((a: S) => [a.sessionId, a.status]) })
  }

  // ─── 1. IDOR ────────────────────────────────────────────────────────────────

  it("IDOR: coach A no lee ni modifica nada de B por ninguna herramienta con ids (routineId, planId, assignmentId, sessionId, athleteId, exerciseId, teamId)", async () => {
    const before = await snapshotB()
    const stamp = new Date().toISOString()
    const attacks: [string, Record<string, unknown>][] = [
      // rutinas
      ["get_routine", { routineId: B.routineId }],
      ["get_routine", { routineId: B.routineId, format: "detail" }],
      ["update_routine", { routineId: B.routineId, expectedUpdatedAt: stamp, name: "pwned" }],
      ["update_routine", { routineId: B.routineId, expectedUpdatedAt: stamp, content: { items: [] } }],
      ["edit_routine", { routineId: B.routineId, ops: [{ op: "remove_item", itemId: B.itemId }] }],
      ["duplicate_routine", { routineId: B.routineId }],
      ["archive_routine", { routineId: B.routineId }],
      ["add_exercise", { routineId: B.routineId, exerciseId: ex[2], sets: [{ setType: "reps", targetReps: 1 }] }],
      ["replace_exercise", { routineId: B.routineId, itemId: B.itemId, newExerciseId: ex[2] }],
      ["remove_item", { routineId: B.routineId, itemId: B.itemId }],
      ["move_item", { routineId: B.routineId, itemId: B.itemId, toPosition: 1 }],
      ["update_sets", { routineId: B.routineId, itemId: B.itemId, sets: [{ setType: "reps", targetReps: 1 }] }],
      ["update_item_fields", { routineId: B.routineId, itemId: B.itemId, notes: "pwned" }],
      ["update_block", { routineId: B.routineId, itemId: B.blockId, rounds: 2 }],
      ["adjust_difficulty", { routineId: B.routineId, direction: "up" }],
      ["adjust_rest", { routineId: B.routineId, direction: "down" }],
      ["list_routines", { teamId: fx.teams.b.id }],
      ["create_routine", { teamId: fx.teams.b.id, name: "intrusa" }],
      // asignados
      ["assign_routine", { routineId: B.routineId, athleteIds: [fx.users.coachB.id] }],
      ["cancel_assignment", { sessionId: B.session }],
      ["cancel_assignment", { sessionId: B.session, athleteId: fx.users.coachB.id }],
      ["list_assignments", { teamId: fx.teams.b.id }],
      ["list_athletes", { teamId: fx.teams.b.id }],
      // planes
      ["get_plan", { planId: B.planId }],
      ["update_plan", { planId: B.planId, expectedUpdatedAt: stamp, name: "pwned" }],
      ["duplicate_plan", { planId: B.planId }],
      ["duplicate_plan", { planId: B.planId, copyRoutines: true }],
      ["schedule_plan", { planId: B.planId, athleteIds: [fx.users.coachB.id], startDate: today, dryRun: true }],
      ["schedule_plan", { planId: B.planId, athleteIds: [fx.users.athleteA.id], startDate: today }],
      ["cancel_plan_assignment", { assignmentId: B.assignmentId }],
      ["cancel_plan_assignment", { assignmentId: B.assignmentId, fromDate: today }],
      ["list_plans", { teamId: fx.teams.b.id }],
      ["create_plan", { teamId: fx.teams.b.id, name: "x", weeks: 1, workouts: [] }],
      // catálogo
      ["search_exercises", { teamId: fx.teams.b.id }],
      ["get_exercises", { teamId: fx.teams.b.id, ids: [B.privateExercise] }],
      ["create_exercise", { teamId: fx.teams.b.id, name: "Intruso", description: "x", difficulty: "beginner", movementPatterns: ["core"] }],
      // search / fetch
      ["fetch", { id: `routine:${B.routineId}` }],
      ["fetch", { id: `plan:${B.planId}` }],
      ["fetch", { id: `exercise:${B.privateExercise}` }],
    ]
    const leaks: string[] = []
    for (const [tool, args] of attacks) {
      const r = await coachA.call(tool, args)
      if (!r.isError) {
        leaks.push(`${tool} ${JSON.stringify(args)} → OK ${JSON.stringify(r.structuredContent).slice(0, 200)}`)
        continue
      }
      const e = (r.structuredContent as { error: ToolError }).error
      if (!DENIED.has(e.code)) leaks.push(`${tool} → ${e.code}: ${e.message}`)
      // El error no revela datos de B
      for (const secret of ["confidencial", "Secreto de B", "Circuito B"]) {
        if (JSON.stringify(e).includes(secret)) leaks.push(`${tool}: el error filtra "${secret}"`)
      }
    }
    assert.deepEqual(leaks, [])

    // Ids de B usados desde recursos propios de A: no se mezclan ni se tocan
    const own = await coachA.ok<S>("list_assignments", { planAssignmentId: B.assignmentId })
    assert.deepEqual(own.assignments, [])
    const byAthlete = await coachA.ok<S>("list_assignments", { athleteId: fx.users.coachB.id })
    assert.deepEqual(byAthlete.assignments, [])
    const ge = await coachA.ok<S>("get_exercises", { ids: [B.privateExercise, ex[0]] })
    assert.deepEqual(ge.notFound, [B.privateExercise])
    const removeForeign = await coachA.fail("update_plan", { planId: A.planId, expectedUpdatedAt: A.planUpdatedAt, removeWorkoutIds: [B.workoutId] })
    assert.equal(removeForeign.code, "BAD_REQUEST")
    const addForeign = await coachA.fail("update_plan", { planId: A.planId, expectedUpdatedAt: A.planUpdatedAt, addWorkouts: [{ week: 1, weekday: 2, routineId: B.planRoutineId }] })
    assert.equal(addForeign.code, "BAD_REQUEST")
    assert.equal((await coachA.fail("create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 1, routineId: B.routineId }] })).code, "BAD_REQUEST")
    assert.equal((await coachA.fail("schedule_plan", { planId: A.planId, athleteIds: [fx.users.coachB.id], startDate: today, dryRun: true })).code, "BAD_REQUEST")
    assert.equal((await coachA.fail("edit_routine", { routineId: A.routineId, ops: [{ op: "replace_exercise", itemId: A.itemId, newExerciseId: B.privateExercise }] })).code, "BAD_REQUEST")
    assert.equal((await coachA.fail("create_plan", {
      name: "x", weeks: 1,
      routines: [{ key: "k", name: "k", content: { items: [{ type: "exercise", exerciseId: B.privateExercise, sets: { count: 1, setType: "reps" } }] } }],
      workouts: [{ week: 1, weekday: 1, routineKey: "k" }],
    })).code, "BAD_REQUEST")
    // Los ids de B como itemId dentro de la rutina de A no encuentran nada
    assert.equal((await coachA.fail("remove_item", { routineId: A.routineId, itemId: B.itemId })).code, "BAD_REQUEST")
    // Resources
    for (const uri of [`atleta://rutinas/${B.routineId}`, `atleta://planes/${B.planId}`]) {
      const err = await coachA.client.readResource({ uri }).catch((e: Error) => e)
      assert.ok(err instanceof Error && /FORBIDDEN|NOT_FOUND/.test(err.message), uri)
    }
    // search no devuelve nada de B
    const s = await coachA.ok<S>("search", { query: "confidencial" })
    assert.deepEqual(s.results, [])

    assert.equal(await snapshotB(), before, "el estado de B no cambió")
  })

  it("IDOR: un id que no existe responde NOT_FOUND (no INTERNAL) en cada herramienta", async () => {
    const ghost = crypto.randomUUID()
    const calls: [string, Record<string, unknown>][] = [
      ["get_routine", { routineId: ghost }],
      ["update_routine", { routineId: ghost, expectedUpdatedAt: new Date().toISOString(), name: "x" }],
      ["edit_routine", { routineId: ghost, ops: [{ op: "remove_item", itemId: ghost }] }],
      ["add_exercise", { routineId: ghost, exerciseId: ex[0], sets: [{ setType: "reps" }] }],
      ["assign_routine", { routineId: ghost, athleteIds: [fx.users.athleteA.id] }],
      ["cancel_assignment", { sessionId: ghost }],
      ["get_plan", { planId: ghost }],
      ["update_plan", { planId: ghost, expectedUpdatedAt: new Date().toISOString(), name: "x" }],
      ["schedule_plan", { planId: ghost, athleteIds: [fx.users.athleteA.id], startDate: today, dryRun: true }],
      ["cancel_plan_assignment", { assignmentId: ghost }],
      ["duplicate_plan", { planId: ghost }],
      ["fetch", { id: `routine:${ghost}` }],
      ["fetch", { id: `plan:${ghost}` }],
      ["fetch", { id: `exercise:${ghost}` }],
    ]
    for (const [tool, args] of calls) assert.equal((await coachA.fail(tool, args)).code, "NOT_FOUND", tool)
  })

  // ─── 2. Atleta con herramientas de escritura ────────────────────────────────

  it("el atleta (token con atleta:write) no logra ninguna escritura en su propio equipo", async () => {
    const stamp = (await coachA.ok<S>("get_routine", { routineId: A.routineId })).updatedAt
    const plan = await coachA.ok<S>("get_plan", { planId: A.planId })
    const writes: [string, Record<string, unknown>][] = [
      ["create_routine", { teamId: fx.teams.a.id, name: "x" }],
      ["update_routine", { routineId: A.routineId, expectedUpdatedAt: stamp, name: "x" }],
      ["edit_routine", { routineId: A.routineId, ops: [{ op: "remove_item", itemId: A.itemId }] }],
      ["duplicate_routine", { routineId: A.routineId }],
      ["archive_routine", { routineId: A.routineId }],
      ["add_exercise", { routineId: A.routineId, exerciseId: ex[1], sets: [{ setType: "reps" }] }],
      ["replace_exercise", { routineId: A.routineId, itemId: A.itemId, newExerciseId: ex[1] }],
      ["remove_item", { routineId: A.routineId, itemId: A.itemId }],
      ["move_item", { routineId: A.routineId, itemId: A.itemId, toPosition: 0 }],
      ["update_sets", { routineId: A.routineId, itemId: A.itemId, sets: [{ setType: "reps", targetReps: 1 }] }],
      ["update_item_fields", { routineId: A.routineId, itemId: A.itemId, notes: "x" }],
      ["adjust_difficulty", { routineId: A.routineId, direction: "up" }],
      ["adjust_rest", { routineId: A.routineId, seconds: 30 }],
      ["assign_routine", { routineId: A.routineId, athleteIds: [fx.users.athleteA.id] }],
      ["create_exercise", { teamId: fx.teams.a.id, name: "Del atleta", description: "x", difficulty: "beginner", movementPatterns: ["core"] }],
      ["create_plan", { teamId: fx.teams.a.id, name: "x", weeks: 1, workouts: [] }],
      ["update_plan", { planId: A.planId, expectedUpdatedAt: plan.updatedAt, name: "x" }],
      ["duplicate_plan", { planId: A.planId }],
      ["schedule_plan", { planId: A.planId, athleteIds: [fx.users.athleteA.id], startDate: today }],
    ]
    const succeeded: string[] = []
    for (const [tool, args] of writes) {
      const r = await athlete.call(tool, args)
      if (!r.isError) succeeded.push(tool)
      // Las habilidades validan la edición antes de que updateContent compruebe el rol: un cambio
      // imposible (mover el único ítem) puede responder BAD_REQUEST; lo importante es que no escribe
      else assert.ok(["FORBIDDEN", "BAD_REQUEST"].includes((r.structuredContent as { error: ToolError }).error.code), tool)
    }
    assert.deepEqual(succeeded, [])
    assert.equal((await coachA.ok<S>("get_routine", { routineId: A.routineId })).updatedAt, stamp)
  })

  // ─── 3. Tokens por HTTP ─────────────────────────────────────────────────────

  it("token de solo lectura por HTTP: sin herramientas W ni el prompt de planes; llamarlas → INSUFFICIENT_SCOPE", async () => {
    const { token } = await insertPat(fx.users.coachA.id, { scopes: ["atleta:read"] })
    const c = await connectMcp(base, token)
    try {
      const names = (await c.listTools()).tools.map((t) => t.name)
      for (const w of ["create_routine", "update_routine", "edit_routine", "assign_routine", "create_plan", "schedule_plan", "add_exercise", "create_exercise"]) {
        assert.ok(!names.includes(w), w)
      }
      assert.ok(names.includes("get_routine") && names.includes("list_plans"))
      for (const [tool, args] of [["create_routine", { name: "x" }], ["schedule_plan", { planId: A.planId, athleteIds: ["x"], startDate: today }], ["add_exercise", {}]] as const) {
        const r = await c.callTool({ name: tool, arguments: args })
        assert.equal(r.isError, true)
        assert.equal((r.structuredContent as { error: ToolError }).error.code, "INSUFFICIENT_SCOPE", tool)
      }
      const prompts = c.getServerCapabilities()?.prompts ? (await c.listPrompts()).prompts.map((p) => p.name) : []
      assert.ok(!prompts.includes("planificar_mesociclo"))
    } finally {
      await c.close()
    }
  })

  it("token revocado o vencido a mitad de sesión: la siguiente llamada falla con 401", async () => {
    const { db } = await import("@atleta/db/client")
    const { mcpPersonalToken } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    for (const change of [{ revokedAt: new Date() }, { expiresAt: new Date(Date.now() - 1000) }]) {
      const { id, token } = await insertPat(fx.users.coachA.id)
      const c = await connectMcp(base, token)
      assert.equal((await c.callTool({ name: "whoami", arguments: {} })).isError, undefined)
      await db.update(mcpPersonalToken).set(change).where(eq(mcpPersonalToken.id, id))
      await assert.rejects(c.callTool({ name: "whoami", arguments: {} }))
      assert.equal((await postMcp(base, INITIALIZE, { authorization: `Bearer ${token}` })).status, 401)
      await c.close().catch(() => {})
    }
  })

  it("headers Authorization malformados → 401 (sin 500)", async () => {
    for (const authorization of ["Bearer", "Bearer ", "Basic abc", "Bearer atl_pat_", `Bearer atl_pat_${"x".repeat(600)}`, "Bearer a b", "bearer atl_pat_zzzzzzzzzzzzzzzzzzzzzz", `Bearer atl_oat_${"é".repeat(20)}`, "Bearer atl_xyz_aaaaaaaaaaaaaaaaaaaa"]) {
      const res = await postMcp(base, INITIALIZE, { authorization })
      assert.equal(res.status, 401, authorization.slice(0, 40))
    }
  })

  it("los tokens personales se guardan solo como hash (nunca el valor)", async () => {
    const { db } = await import("@atleta/db/client")
    const { sql } = await import("drizzle-orm")
    const created = await fx.callers.coachA.mcp.createToken({ name: "hash", scopes: ["atleta:read"], expiresInDays: 30 })
    const rows = (await db.execute(sql`select row_to_json(t)::text as j from mcp_personal_token t`)) as unknown as { j: string }[]
    const secret = created.token.slice("atl_pat_".length)
    assert.ok(rows.length > 0)
    assert.ok(rows.every((r) => !r.j.includes(secret)), "el token no aparece en la tabla")
    const { hashPersonalToken } = await import("../../src/mcp/personal-tokens")
    assert.ok(rows.some((r) => r.j.includes(hashPersonalToken(created.token))))
    // La lista solo muestra el prefijo
    const listed = await fx.callers.coachA.mcp.listTokens()
    assert.ok(!JSON.stringify(listed).includes(secret))
  })

  it("IDOR en la administración de tokens y apps: un usuario no revoca lo de otro", async () => {
    const { db } = await import("@atleta/db/client")
    const { mcpPersonalToken } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    const created = await fx.callers.coachB.mcp.createToken({ name: "de B", scopes: ["atleta:read"], expiresInDays: 30 })
    await assert.rejects(fx.callers.coachA.mcp.revokeToken({ id: created.id }), /no encontrado/i)
    const [row] = await db.select().from(mcpPersonalToken).where(eq(mcpPersonalToken.id, created.id))
    assert.equal(row!.revokedAt, null)
    assert.ok(!(await fx.callers.coachA.mcp.listTokens()).some((t) => t.id === created.id))
    assert.equal((await postMcp(base, INITIALIZE, { authorization: `Bearer ${created.token}` })).status, 200)
    // revokeApp de un cliente al que A no dio consentimiento → NOT_FOUND
    await assert.rejects(fx.callers.coachA.mcp.revokeApp({ clientId: "cliente-ajeno" }), /no está conectada/)
  })

  // ─── 4. Entradas límite y malformadas ───────────────────────────────────────

  it("entradas inválidas → INVALID_INPUT (nunca INTERNAL ni escrituras)", async () => {
    const r = A.routineId
    const item = (extra: S = {}) => ({ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps", targetReps: 5 }, ...extra })
    const cases: [string, string, Record<string, unknown>][] = [
      ["fecha imposible", "assign_routine", { routineId: r, athleteIds: [fx.users.athleteA.id], dates: ["2026-02-30"] }],
      ["mes 13", "assign_routine", { routineId: r, athleteIds: [fx.users.athleteA.id], dates: ["2026-13-01"] }],
      ["fecha local", "assign_routine", { routineId: r, athleteIds: [fx.users.athleteA.id], dates: ["24/10/2026"] }],
      ["fecha con hora", "schedule_plan", { planId: A.planId, athleteIds: [fx.users.athleteA.id], startDate: "2026-10-26T00:00:00Z", dryRun: true }],
      ["startDate imposible", "schedule_plan", { planId: A.planId, athleteIds: [fx.users.athleteA.id], startDate: "2026-02-30", dryRun: true }],
      ["fromDate imposible", "cancel_plan_assignment", { assignmentId: crypto.randomUUID(), fromDate: "2026-04-31" }],
      ["from imposible", "list_assignments", { from: "2026-00-10" }],
      ["weekday 0", "create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 0, routineId: r }] }],
      ["weekday 8", "create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 8, routineId: r }] }],
      ["weekday decimal", "create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 1.5, routineId: r }] }],
      ["17 semanas", "create_plan", { name: "x", weeks: 17, workouts: [] }],
      ["0 semanas", "create_plan", { name: "x", weeks: 0, workouts: [] }],
      ["semanas como texto", "create_plan", { name: "x", weeks: "6", workouts: [] }],
      ["hueco fuera del plan", "create_plan", { name: "x", weeks: 2, workouts: [{ week: 3, weekday: 1, routineId: r }] }],
      ["routineId y routineKey", "create_plan", { name: "x", weeks: 1, routines: [{ key: "k", name: "k", content: { items: [] } }], workouts: [{ week: 1, weekday: 1, routineId: r, routineKey: "k" }] }],
      ["key inexistente", "create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 1, routineKey: "nope" }] }],
      ["113 huecos", "create_plan", { name: "x", weeks: 16, workouts: Array.from({ length: 113 }, (_, i) => ({ week: (i % 16) + 1, weekday: (i % 7) + 1, routineId: r })) }],
      ["51 atletas", "schedule_plan", { planId: A.planId, athleteIds: Array.from({ length: 51 }, (_, i) => `a${i}`), startDate: today, dryRun: true }],
      ["sin atletas", "schedule_plan", { planId: A.planId, athleteIds: [], startDate: today, dryRun: true }],
      ["nombre enorme", "create_routine", { name: "x".repeat(10_000) }],
      ["nombre vacío", "create_routine", { name: "   " }],
      ["query enorme", "search_exercises", { query: "x".repeat(81) }],
      ["uuid inválido", "get_routine", { routineId: "1234" }],
      ["uuid inválido (plan)", "get_plan", { planId: "../../etc/passwd" }],
      ["uuid inválido (sesión)", "cancel_assignment", { sessionId: "' OR 1=1 --" }],
      ["ids vacíos", "get_exercises", { ids: [] }],
      ["31 ids", "get_exercises", { ids: Array.from({ length: 31 }, () => crypto.randomUUID()) }],
      ["ops vacías", "edit_routine", { routineId: r, ops: [] }],
      ["26 ops", "edit_routine", { routineId: r, ops: Array.from({ length: 26 }, () => ({ op: "remove_item", itemId: A.itemId })) }],
      ["op desconocida", "edit_routine", { routineId: r, ops: [{ op: "drop_table", itemId: A.itemId }] }],
      ["limit negativo", "list_routines", { limit: -5 }],
      ["limit 101", "list_assignments", { limit: 101 }],
      ["limit NaN (JSON null)", "list_routines", { limit: null }],
      ["loadValue sin loadType", "create_routine", { name: "x", content: { items: [item({ sets: { count: 1, setType: "reps", loadValue: 7 } })] } }],
      ["RPE 11", "create_routine", { name: "x", content: { items: [item({ sets: { count: 1, setType: "reps", loadType: "rpe", loadValue: 11 } })] } }],
      ["%RM 121", "create_routine", { name: "x", content: { items: [item({ sets: { count: 1, setType: "reps", loadType: "percent_rm", loadValue: 121 } })] } }],
      ["kg negativos", "create_routine", { name: "x", content: { items: [item({ sets: { count: 1, setType: "reps", loadType: "fixed_kg", loadValue: -20 } })] } }],
      ["reps 0", "create_routine", { name: "x", content: { items: [item({ sets: { count: 1, setType: "reps", targetReps: 0 } })] } }],
      ["13 series", "create_routine", { name: "x", content: { items: [item({ sets: { count: 13, setType: "reps" } })] } }],
      // Descanso, tempo y notas aceptan lo mismo que la web (BUG-2): sin tope, texto libre; solo
      // se rechaza lo que routineContentSchema tampoco acepta
      ["descanso 0", "create_routine", { name: "x", content: { items: [item({ restSeconds: 0 })] } }],
      ["tempo numérico", "create_routine", { name: "x", content: { items: [item({ tempo: 3120 })] } }],
      ["notas no texto", "create_routine", { name: "x", content: { items: [item({ notes: ["n"] })] } }],
      ["campo extra anidado", "create_routine", { name: "x", content: { items: [item({ weight: 100 })] } }],
      ["circuito de 1 ronda", "create_routine", { name: "x", content: { items: [{ type: "block", rounds: 1, exercises: [{ exerciseId: ex[0], sets: { count: 1, setType: "reps" } }] }] } }],
      ["circuito vacío", "create_routine", { name: "x", content: { items: [{ type: "block", rounds: 2, exercises: [] }] } }],
      ["21 elementos", "create_routine", { name: "x", content: { items: Array.from({ length: 21 }, () => item()) } }],
      ["series vacías", "update_sets", { routineId: r, itemId: A.itemId, sets: [] }],
      ["adjust_rest sin dirección ni segundos", "adjust_rest", { routineId: r }],
      ["expectedUpdatedAt no ISO", "update_routine", { routineId: r, expectedUpdatedAt: "ayer", name: "x" }],
      ["update_routine sin cambios", "update_routine", { routineId: r, expectedUpdatedAt: new Date().toISOString() }],
      ["update_plan sin cambios", "update_plan", { planId: A.planId, expectedUpdatedAt: A.planUpdatedAt }],
      ["fetch sin tipo", "fetch", { id: B.routineId }],
    ]
    const before = (await coachA.ok<S>("list_routines", { includeArchived: true, limit: 100 })).total
    const wrong: string[] = []
    for (const [label, tool, args] of cases) {
      const res = await coachA.call(tool, args)
      const code = res.isError ? (res.structuredContent as { error: ToolError }).error.code : "OK"
      if (code !== "INVALID_INPUT") wrong.push(`${label} (${tool}) → ${code}${res.isError ? `: ${(res.structuredContent as { error: ToolError }).error.message}` : ""}`)
    }
    assert.deepEqual(wrong, [])
    assert.equal((await coachA.ok<S>("list_routines", { includeArchived: true, limit: 100 })).total, before, "ninguna escritura")
  })

  it("unicode (emoji, CJK, RTL) se guarda y se lee igual", async () => {
    const name = "Fuerza 💪 ñandú — 力量 ‮RTL‬ 𝔘𝔫𝔦"
    const notes = "Respira 🌬️ — mantén la espalda neutra (ñ, ü, ç)"
    const created = await coachA.ok<S>("create_routine", { name, content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps" }, notes }] } })
    const back = await coachA.ok<S>("get_routine", { routineId: created.routineId, format: "detail" })
    assert.equal(back.name, name)
    assert.equal(back.content.items[0].notes, notes)
  })

  it("caracteres NUL en textos → INVALID_INPUT, no INTERNAL", async () => {
    for (const [tool, args] of [
      ["create_routine", { name: "a\u0000b" }],
      ["create_routine", { name: "ok", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps" }, notes: "x\u0000" }] } }],
      ["create_plan", { name: "plan\u0000", weeks: 1, workouts: [] }],
    ] as const) {
      const e = await coachA.fail(tool, args)
      assert.equal(e.code, "INVALID_INPUT", `${tool}: ${e.code} ${e.message}`)
    }
  })

  it("surrogates sueltos en notas → INVALID_INPUT, no INTERNAL", async () => {
    const e = await coachA.fail("create_routine", { name: "ok", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps" }, notes: "x\uD800y" }] } })
    assert.equal(e.code, "INVALID_INPUT", `${e.code}: ${e.message}`)
  })

  it("fetch con un id con forma de uuid pero inválido → INVALID_INPUT/NOT_FOUND, no INTERNAL", async () => {
    const e = await coachA.fail("fetch", { id: `exercise:${"-".repeat(36)}` })
    assert.ok(["INVALID_INPUT", "NOT_FOUND"].includes(e.code), `${e.code}: ${e.message}`)
  })

  it("un campo desconocido en el nivel superior se rechaza (no se descarta en silencio)", async () => {
    const current = await coachA.ok<S>("get_routine", { routineId: A.routineId })
    const old = new Date(Date.parse(current.updatedAt) - 60_000).toISOString()
    const r = await coachA.call("update_item_fields", { routineId: A.routineId, expectedUpdatedAT: old, itemId: A.itemId, notes: "typo" })
    assert.equal(r.isError, true, "un campo mal escrito no debería ignorarse")
    assert.equal((r.structuredContent as { error: ToolError }).error.code, "INVALID_INPUT")
  })

  // ─── 5. Concurrencia ────────────────────────────────────────────────────────

  it("concurrencia: dos ediciones sin expectedUpdatedAt a la vez no pierden cambios en silencio", async () => {
    const created = await coachA.ok<S>("create_routine", { name: "Concurrente", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps" } }] } })
    const other = await mcpClientFor(fx.users.coachA)
    try {
      const results = await Promise.all([
        coachA.call("add_exercise", { routineId: created.routineId, exerciseId: ex[1], sets: [{ setType: "reps", targetReps: 5 }] }),
        other.call("add_exercise", { routineId: created.routineId, exerciseId: ex[2], sets: [{ setType: "reps", targetReps: 5 }] }),
      ])
      const okCount = results.filter((r) => !r.isError).length
      const final = await coachA.ok<S>("get_routine", { routineId: created.routineId })
      // O se aplicaron las dos (serializadas) o una recibió CONFLICT; nunca 2 OK con 1 cambio
      assert.equal(final.items.length, 1 + okCount)
      for (const r of results.filter((x) => x.isError)) assert.equal((r.structuredContent as { error: ToolError }).error.code, "CONFLICT")
    } finally {
      await other.close()
    }
  })

  it("concurrencia: dos update_plan con el mismo expectedUpdatedAt → exactamente uno gana", async () => {
    const p = await coachA.ok<S>("create_plan", { name: "Carrera", weeks: 1, workouts: [] })
    const other = await mcpClientFor(fx.users.coachA)
    try {
      const results = await Promise.all([coachA, other].map((c, i) => c.call("update_plan", { planId: p.planId, expectedUpdatedAt: p.updatedAt, name: `Carrera ${i}` })))
      assert.equal(results.filter((r) => !r.isError).length, 1)
      assert.equal((results.find((r) => r.isError)!.structuredContent as { error: ToolError }).error.code, "CONFLICT")
    } finally {
      await other.close()
    }
  })

  it("concurrencia: dos schedule_plan simultáneos son consistentes (todo o nada por llamada)", async () => {
    const p = await coachA.ok<S>("create_plan", { name: "Doble", weeks: 2, workouts: [{ week: 1, weekday: 7, routineId: A.routineId }, { week: 2, weekday: 7, routineId: A.routineId }] })
    const other = await mcpClientFor(fx.users.coachA)
    try {
      const args = { planId: p.planId, athleteIds: [fx.users.athleteA.id], startDate: today }
      const results = await Promise.all([coachA.call("schedule_plan", args), other.call("schedule_plan", args)])
      const okResults = results.filter((r) => !r.isError).map((r) => r.structuredContent as S)
      const listed = await coachA.ok<S>("get_plan", { planId: p.planId })
      assert.equal(listed.assignments.length, okResults.length)
      for (const a of listed.assignments) {
        const mine = okResults.find((o) => o.assignmentId === a.assignmentId)!
        assert.equal(a.sessions.total, mine.sessions.length, "cada asignación tiene exactamente sus sesiones")
      }
    } finally {
      await other.close()
    }
  })

  it("schedule_plan repetido (reintento del agente) no duplica las sesiones del atleta", async () => {
    const p = await coachA.ok<S>("create_plan", { name: "Reintento", weeks: 1, workouts: [{ week: 1, weekday: 7, routineId: A.routineId }] })
    const args = { planId: p.planId, athleteIds: [fx.users.athleteA.id], startDate: today }
    const first = await coachA.ok<S>("schedule_plan", args)
    const second = await coachA.call("schedule_plan", args)
    const plan = await coachA.ok<S>("get_plan", { planId: p.planId })
    const active = plan.assignments.filter((a: S) => a.status === "active")
    assert.ok(second.isError || active.length === 1, `asignaciones activas duplicadas: ${active.length}`)
    // CONFLICT con el assignmentId existente y la pista de qué hacer
    const e = (second.structuredContent as { error: ToolError }).error
    assert.equal(e.code, "CONFLICT")
    assert.equal(e.details?.assignmentId, first.assignmentId)
    assert.match(e.message, /cancel_plan_assignment/)
    assert.match(e.message, /get_plan/)
    // dryRun lo avisa sin escribir
    const dry = await coachA.ok<S>("schedule_plan", { ...args, dryRun: true })
    assert.equal(dry.duplicateOf, first.assignmentId)
    // Otros atletas u otra fecha no son duplicados
    assert.equal((await coachA.ok<S>("schedule_plan", { ...args, startDate: addDays(today, 7), dryRun: true })).duplicateOf, null)
    // Tras cancelar la asignación se puede volver a programar
    await coachA.ok("cancel_plan_assignment", { assignmentId: first.assignmentId })
    assert.equal((await coachA.ok<S>("schedule_plan", { ...args, dryRun: true })).duplicateOf, null)
    const again = await coachA.ok<S>("schedule_plan", args)
    await coachA.ok("cancel_plan_assignment", { assignmentId: again.assignmentId })
  })

  // ─── 6. Calendario ──────────────────────────────────────────────────────────

  it("calendario: inicio en domingo, cambio de año, inicio en el pasado y hoy (UTC)", async () => {
    const allDays = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ week: 1, weekday: d, routineId: A.routineId }))
    const twoWeeks = [...allDays, ...allDays.map((w) => ({ ...w, week: 2 }))]
    const plan = await coachA.ok<S>("create_plan", { name: "Calendario", weeks: 2, workouts: twoWeeks })
    const dry = (startDate: string) => coachA.ok<S>("schedule_plan", { planId: plan.planId, athleteIds: [fx.users.athleteA.id], startDate, dryRun: true })

    // Domingo futuro: la semana 1 es la que contiene ese domingo → lunes a sábado quedan before_start
    const sunday = addDays(mondayOf(addDays(today, 14)), 6)
    assert.equal(isoWeekday(sunday), 7)
    const s = await dry(sunday)
    assert.deepEqual(s.skipped.map((x: S) => [x.week, x.weekday, x.reason]), [1, 2, 3, 4, 5, 6].map((d) => [1, d, "before_start"]))
    assert.equal(s.sessions[0].date, sunday)
    assert.equal(s.sessions.length, 8)

    // Cambio de año: el próximo 31 de diciembre futuro
    const year = Number(today.slice(0, 4))
    const dec31 = `${today >= `${year}-12-24` ? year + 1 : year}-12-31`
    const y = await dry(dec31)
    for (const e of y.sessions) {
      assert.equal(e.date, addDays(mondayOf(dec31), (e.week - 1) * 7 + (e.weekday - 1)))
      assert.equal(isoWeekday(e.date), e.weekday)
    }
    assert.ok(y.sessions.some((e: S) => e.date.startsWith(String(Number(dec31.slice(0, 4)) + 1))), "cruza al año siguiente")

    // Inicio en el pasado: lo anterior a hoy se omite como past; hoy sí se programa (activa)
    const pastStart = mondayOf(addDays(today, -7))
    const p = await dry(pastStart)
    assert.ok(p.skipped.every((x: S) => x.reason === "past"))
    assert.ok(p.sessions.every((e: S) => e.date >= today))
    assert.equal(p.sessions.length + p.skipped.length, 14)
    assert.ok(p.sessions.some((e: S) => e.date === today))
    const real = await coachA.ok<S>("schedule_plan", { planId: plan.planId, athleteIds: [fx.users.athleteA.id], startDate: pastStart })
    const todays = real.sessions.find((e: S) => e.date === today)
    assert.equal(todays.status, "active", "la sesión de hoy (UTC) queda activa")
    assert.ok(real.sessions.filter((e: S) => e.date > today).every((e: S) => e.status === "scheduled"))
    // whoami.today es la fecha UTC
    assert.equal((await coachA.ok<S>("whoami")).today, new Date().toISOString().slice(0, 10))
    await coachA.ok("cancel_plan_assignment", { assignmentId: real.assignmentId })
  })

  // ─── 7. HTTP: batch, Origin/CORS, cuerpo, content-type ──────────────────────

  it("un batch JSON-RPC no evade el límite de requests por usuario", async () => {
    const [{ buildApp }, { createRateLimiter }] = await Promise.all([import("../../src/app"), import("../../src/lib/rate-limit")])
    const app = await buildApp({ logger: false, mcp: { limiters: { request: createRateLimiter({ max: 2, windowMs: 60_000 }) } } })
    await app.listen({ port: 0, host: "127.0.0.1" })
    try {
      const addr = app.server.address()
      const url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`
      const { token } = await insertPat(fx.users.coachA.id)
      const batch = Array.from({ length: 10 }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "tools/call", params: { name: "whoami", arguments: {} } }))
      const res = await postMcp(url, batch, { authorization: `Bearer ${token}`, "mcp-protocol-version": "2025-06-18" })
      const body = await res.text()
      const executed = res.status === 200 && body.startsWith("[") ? (JSON.parse(body) as { result?: unknown }[]).filter((r) => r.result).length : 0
      assert.ok(executed <= 2, `se ejecutaron ${executed} llamadas con un límite de 2 requests`)
      // Los batches se rechazan con un error JSON-RPC claro (MCP 2025-06-18 los eliminó)
      assert.equal(res.status, 400)
      const error = (JSON.parse(body) as { error: { code: number; message: string } }).error
      assert.equal(error.code, -32600)
      assert.match(error.message, /[Bb]atch/)
      // Una request suelta sigue funcionando
      const single = await postMcp(url, batch[0], { authorization: `Bearer ${token}`, "mcp-protocol-version": "2025-06-18" })
      assert.equal(single.status, 200)
    } finally {
      await app.close()
    }
  })

  it("HTTP: JSON inválido, content-type incorrecto y método JSON-RPC desconocido no dan 500", async () => {
    const { token } = await insertPat(fx.users.coachA.id)
    const auth = { authorization: `Bearer ${token}` }
    const invalid = await postMcp(base, "{ esto no es json", auth)
    assert.ok(invalid.status >= 400 && invalid.status < 500, String(invalid.status))
    const text = await fetch(`${base}/mcp`, { method: "POST", headers: { ...auth, "content-type": "text/plain", accept: "application/json, text/event-stream" }, body: "hola" })
    assert.ok(text.status >= 400 && text.status < 500, String(text.status))
    const unknown = await postMcp(base, { jsonrpc: "2.0", id: 1, method: "tools/destroy", params: {} }, auth)
    const body = (await unknown.json()) as { error?: { code: number } }
    assert.equal(body.error?.code, -32601)
    // Sin Accept con text/event-stream el SDK responde 406, no 500
    const noAccept = await fetch(`${base}/mcp`, { method: "POST", headers: { ...auth, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(INITIALIZE) })
    assert.ok(noAccept.status < 500, String(noAccept.status))
  })

  it("Origin/CORS: orígenes raros → 403 y sin Access-Control-Allow-Origin; /trpc no acepta orígenes del conector", async () => {
    const { token } = await insertPat(fx.users.coachA.id)
    for (const origin of ["null", "http://127.0.0.1.evil.com", `${base}.evil.com`, "http://localhost:6274", "file://", "chrome-extension://abc"]) {
      const res = await postMcp(base, INITIALIZE, { authorization: `Bearer ${token}`, origin })
      assert.equal(res.status, 403, origin)
    }
    const pre = await fetch(`${base}/mcp`, { method: "OPTIONS", headers: { origin: "https://evil.example.com", "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" } })
    assert.equal(pre.headers.get("access-control-allow-origin"), null)
    const trpc = await fetch(`${base}/trpc/teams.list`, { headers: { origin: "https://evil.example.com" } })
    assert.notEqual(trpc.headers.get("access-control-allow-origin"), "https://evil.example.com")
    assert.notEqual(trpc.headers.get("access-control-allow-origin"), "*")
  })

  // ─── 8. Regresión de la web ─────────────────────────────────────────────────

  it("regresión web: routines.updateContent sin expectedUpdatedAt, sessions.create, sessions.list, exercises.list y routines.list", async () => {
    const web = fx.callers.coachA
    const r = await web.routines.create({ teamId: fx.teams.a.id, name: "Web regresión" })
    const content = { v: 1 as const, items: [{ type: "exercise" as const, id: crypto.randomUUID(), exerciseId: ex[0]!, order: 0, sets: [{ setNumber: 1, setType: "reps" as const, targetReps: 5 }] }] }
    const updated = await web.routines.updateContent({ id: r!.id, content })
    assert.equal(updated.content.items.length, 1)
    // Dos guardados seguidos sin versión (autosave de la web) no dan CONFLICT
    await web.routines.updateContent({ id: r!.id, content })
    const s = await web.sessions.create({ routineId: r!.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id] })
    assert.equal(s.status, "active")
    const list = await web.sessions.list({ teamId: fx.teams.a.id })
    assert.ok(list.some((x) => x.id === s.id))
    const exercises = await web.exercises.list({ teamId: fx.teams.a.id })
    const ids = new Set((exercises as unknown as { id: string }[]).map((e) => e.id))
    assert.ok(ids.has(ex[0]!))
    assert.ok(!ids.has(B.privateExercise), "la web tampoco ve el ejercicio privado de B")
    const routines = await web.routines.list({ teamId: fx.teams.a.id })
    assert.ok(routines.some((x) => x.id === r!.id))
    // El atleta sigue viendo sus pendientes en la app
    const pending = await fx.callers.athleteA.sessions.myPending()
    assert.ok(JSON.stringify(pending).includes(s.id))
  })

  // ─── 9. Calidad para el LLM ─────────────────────────────────────────────────

  async function httpClient(): Promise<Client> {
    const { token } = await insertPat(fx.users.coachA.id)
    return connectMcp(base, token)
  }

  it("tools/list: JSON Schema válido, sin $ref rotos, descripciones en español y tamaño acotado", async () => {
    const c = await httpClient()
    try {
      const { tools } = await c.listTools()
      const size = JSON.stringify(tools).length
      assert.ok(size < 80_000, `tools/list pesa ${size} caracteres`)
      const names = new Set<string>()
      for (const t of tools) {
        assert.ok(!names.has(t.name), `nombre repetido ${t.name}`)
        names.add(t.name)
        assert.match(t.name, /^[a-z][a-z_]*$/)
        assert.ok(/\b(de|la|el|los|las|una|un|con|para)\b/.test(t.description ?? ""), `${t.name}: descripción no parece español`)
        const schema = t.inputSchema as S
        assert.equal(schema.type, "object")
        // Cada $ref es un JSON Pointer interno que resuelve
        const refs: string[] = []
        const walk = (o: unknown) => {
          if (Array.isArray(o)) o.forEach(walk)
          else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) (k === "$ref" ? refs.push(v as string) : walk(v))
        }
        walk(schema)
        for (const ref of refs) {
          assert.ok(ref.startsWith("#/"), `${t.name}: $ref externo ${ref}`)
          let cur: unknown = schema
          for (const part of ref.slice(2).split("/")) cur = (cur as S)?.[part.replace(/~1/g, "/").replace(/~0/g, "~")]
          assert.ok(cur && typeof cur === "object", `${t.name}: $ref roto ${ref}`)
        }
        // required ⊆ properties
        for (const req of (schema.required ?? []) as string[]) assert.ok(schema.properties?.[req], `${t.name}: required ${req} sin propiedad`)
      }
    } finally {
      await c.close()
    }
  })

  it("tools/list sin $ref (algunos clientes no resuelven referencias)", async () => {
    const c = await httpClient()
    try {
      const withRefs = (await c.listTools()).tools.filter((t) => JSON.stringify(t.inputSchema).includes("$ref")).map((t) => t.name)
      assert.deepEqual(withRefs, [])
    } finally {
      await c.close()
    }
  })

  it("errores accionables: CONFLICT trae updatedAt y pista; AMBIGUOUS_TEAM lista equipos; INVALID_INPUT indica el campo", async () => {
    const cur = await coachA.ok<S>("get_routine", { routineId: A.routineId })
    const conflict = await coachA.fail("update_routine", { routineId: A.routineId, expectedUpdatedAt: new Date(Date.parse(cur.updatedAt) - 1000).toISOString(), name: "x" })
    assert.equal(conflict.code, "CONFLICT")
    assert.equal(conflict.details?.updatedAt, cur.updatedAt)
    assert.match(conflict.message, /get_routine/)
    // Coach de dos equipos sin teamId → AMBIGUOUS_TEAM con la lista
    const second = await fx.callers.coachA.teams.create({ name: "Equipo A2" })
    try {
      const amb = await coachA.fail("create_routine", { name: "¿dónde?" })
      assert.equal(amb.code, "AMBIGUOUS_TEAM")
      assert.match(amb.message, /teamId/)
      assert.equal((amb.details?.teams as unknown[]).length, 2)
      assert.ok(amb.message.includes(second.id))
    } finally {
      const { db } = await import("@atleta/db/client")
      const { team } = await import("@atleta/db/schema")
      const { eq } = await import("drizzle-orm")
      await db.delete(team).where(eq(team.id, second.id))
    }
    const inv = await coachA.fail("create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 9, routineId: A.routineId }] })
    assert.match(inv.message, /workouts\.0\.weekday/)
    assert.deepEqual((inv.details?.issues as S[])[0]!.path, "workouts.0.weekday")
  })

  it("mensajes de validación en español y específicos (sin 'Invalid input' genérico)", async () => {
    const e1 = await coachA.fail("get_routine", { routineId: "x" })
    assert.doesNotMatch(e1.message, /Invalid uuid/)
    const e2 = await coachA.fail("create_routine", { name: "x", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps", loadType: "rpe", loadValue: null } }] } })
    assert.doesNotMatch(e2.message, /Invalid input/)
  })

  it("búsqueda de ejercicios sin distinguir acentos (los LLM escriben 'flexión')", async () => {
    const plain = await coachA.ok<S>("search_exercises", { query: "flexion" })
    assert.ok(plain.results.length > 0, "precondición: hay ejercicios 'flexion'")
    const accented = await coachA.ok<S>("search_exercises", { query: "flexión" })
    assert.ok(accented.results.length > 0)
  })

  it("search trata % y _ como texto (no como comodines de LIKE)", async () => {
    const r = await coachA.ok<S>("search", { query: "%" })
    assert.deepEqual(r.results.filter((x: S) => x.id.startsWith("exercise:")), [])
  })

  it("create_exercise compara el nombre literal (no como patrón LIKE)", async () => {
    const r = await coachA.call("create_exercise", { name: "%%", description: "x", difficulty: "beginner", movementPatterns: ["core"] })
    const sc = r.structuredContent as S
    assert.ok(r.isError || sc.name === "%%", `devolvió otro ejercicio: ${JSON.stringify(sc)}`)
  })

  it("round-trip get_routine detail → update_routine funciona con rutinas creadas en la web", async () => {
    const web = fx.callers.coachA
    const r = await web.routines.create({ teamId: fx.teams.a.id, name: "Hecha en la web" })
    await web.routines.updateContent({
      id: r!.id,
      content: {
        v: 1,
        items: [{ type: "exercise", id: crypto.randomUUID(), exerciseId: ex[0]!, order: 0, tempo: "31X0", restSeconds: 900, notes: "n".repeat(400), sets: [{ setNumber: 1, setType: "reps", targetReps: 300 }] }],
      },
    })
    const detail = await coachA.ok<S>("get_routine", { routineId: r!.id, format: "detail" })
    const res = await coachA.call("update_routine", { routineId: r!.id, expectedUpdatedAt: detail.updatedAt, name: "Renombrada desde MCP", content: detail.content })
    assert.ok(!res.isError, JSON.stringify(res.structuredContent))
  })

  it("tamaño de respuestas: get_plan de 16 semanas × 7 días y list_routines con 100", async (t) => {
    // 100 rutinas en el equipo A (directo en BD para no gastar el límite de escrituras)
    const { db } = await import("@atleta/db/client")
    const { routine } = await import("@atleta/db/schema")
    const content = { v: 1 as const, items: Array.from({ length: 5 }, (_, i) => ({ type: "exercise" as const, id: crypto.randomUUID(), exerciseId: ex[i % 4]!, order: i, sets: [{ setNumber: 1, setType: "reps" as const, targetReps: 8 }] })) }
    await db.insert(routine).values(Array.from({ length: 100 }, (_, i) => ({ teamId: fx.teams.a.id, name: `Masiva ${i}`, createdBy: fx.users.coachA.id, category: "training" as const, content })))
    const list = await coachA.ok<S>("list_routines", { limit: 100 })
    assert.equal(list.routines.length, 100)
    const listSize = JSON.stringify(list).length
    assert.ok(listSize < 30_000, `list_routines(100) = ${listSize} caracteres`)

    const workouts = Array.from({ length: 16 }, (_, w) => [1, 2, 3, 4, 5, 6, 7].map((d) => ({ week: w + 1, weekday: d, routineId: A.routineId, notes: "Calienta 10 min" }))).flat()
    const plan = await coachA.ok<S>("create_plan", { name: "Plan máximo", weeks: 16, weekMeta: Array.from({ length: 16 }, (_, i) => ({ week: i + 1, name: `Semana ${i + 1}`, focus: "Fuerza" })), workouts })
    assert.equal(plan.workoutCount, 112)
    const got = await coachA.ok<S>("get_plan", { planId: plan.planId })
    const planSize = JSON.stringify(got).length
    assert.ok(planSize < 60_000, `get_plan(16×7) = ${planSize} caracteres`)
    const doc = await coachA.ok<S>("fetch", { id: `plan:${plan.planId}` })
    assert.ok(doc.text.length < 20_000, `fetch(plan) = ${doc.text.length}`)
    t.diagnostic(`list_routines(100) = ${listSize} caracteres; get_plan(16×7) = ${planSize}; fetch(plan) = ${doc.text.length}`)
  })
})
