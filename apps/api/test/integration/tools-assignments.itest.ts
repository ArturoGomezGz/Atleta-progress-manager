// Herramientas MCP de asignados contra la API real: assign_routine (ahora y con fechas),
// list_assignments con filtros, vista del atleta, cancel_assignment y límite de asignaciones.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { catalogExerciseIds, createFixtures, type Fixtures } from "./fixtures"
import { mcpClientFor, utcDate, type McpTestClient } from "./mcp-inmemory"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

type Assigned = { sessions: { sessionId: string; date: string | null; status: string }[] }
type Assignment = { sessionId: string; routineId: string; scheduledDate: string | null; status: string; athletes?: { athleteId: string; name: string; status: string }[] }

describe("MCP: herramientas de asignados", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let coach: McpTestClient
  let athlete: McpTestClient
  let routineId: string

  before(async () => {
    server = await startTestServer()
    fx = await createFixtures(server.baseUrl)
    coach = await mcpClientFor(fx.users.coachA)
    athlete = await mcpClientFor(fx.users.athleteA)
    const [ex] = await catalogExerciseIds(1)
    routineId = (await coach.ok<{ routineId: string }>("create_routine", {
      name: "Para asignar", content: { items: [{ type: "exercise", exerciseId: ex, sets: { count: 3, setType: "reps", targetReps: 10 } }] },
    })).routineId
  })

  after(async () => {
    await coach?.close()
    await athlete?.close()
    await server?.close()
  })

  it("assign_routine sin fechas: una sesión activa ahora", async () => {
    const r = await coach.ok<Assigned>("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id, fx.users.athleteA.id] })
    assert.equal(r.sessions.length, 1)
    assert.equal(r.sessions[0]!.date, null)
    assert.equal(r.sessions[0]!.status, "active")
  })

  it("assign_routine con fechas: hoy activa, futuras programadas, ordenadas por fecha", async () => {
    const dates = [utcDate(14), utcDate(0), utcDate(7)]
    const r = await coach.ok<Assigned>("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id], dates })
    assert.deepEqual(r.sessions.map((s) => [s.date, s.status]), [
      [utcDate(0), "active"],
      [utcDate(7), "scheduled"],
      [utcDate(14), "scheduled"],
    ])
    // El atleta las ve en su app
    const pending = await fx.callers.athleteA.sessions.myPending()
    assert.ok(r.sessions.every((s) => pending.some((p) => p.id === s.sessionId)))
  })

  it("list_assignments: coach con atletas y filtros de fecha, estado y límite", async () => {
    const all = await coach.ok<{ assignments: Assignment[] }>("list_assignments")
    assert.equal(all.assignments.length, 4)
    assert.ok(all.assignments.every((a) => a.routineId === routineId))
    assert.deepEqual(all.assignments[0]!.athletes!.map((a) => a.athleteId), [fx.users.athleteA.id])

    const future = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { from: utcDate(1) })
    assert.deepEqual(future.assignments.map((a) => a.scheduledDate).sort(), [utcDate(7), utcDate(14)])
    const window = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { from: utcDate(5), to: utcDate(10) })
    assert.deepEqual(window.assignments.map((a) => a.scheduledDate), [utcDate(7)])
    const scheduled = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { status: ["scheduled"] })
    assert.equal(scheduled.assignments.length, 2)
    const one = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { limit: 1 })
    assert.equal(one.assignments.length, 1)
    const byAthlete = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { athleteId: fx.users.athleteA.id })
    assert.equal(byAthlete.assignments.length, 4)
  })

  it("list_assignments del atleta: solo las suyas y sin la lista de atletas", async () => {
    const mine = await athlete.ok<{ assignments: Assignment[] }>("list_assignments")
    assert.equal(mine.assignments.length, 4)
    assert.ok(mine.assignments.every((a) => a.athletes === undefined))
    // Aunque pida a otro atleta, solo consulta las propias
    const other = await athlete.ok<{ assignments: Assignment[] }>("list_assignments", { athleteId: fx.users.coachA.id })
    assert.equal(other.assignments.length, 4)
  })

  it("cancel_assignment: sesión completa; por atleta solo en evaluación", async () => {
    const { assignments } = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { status: ["scheduled"] })
    const target = assignments[0]!.sessionId
    const perAthlete = await coach.fail("cancel_assignment", { sessionId: target, athleteId: fx.users.athleteA.id })
    assert.equal(perAthlete.code, "BAD_REQUEST")
    const r = await coach.ok<{ cancelled: string }>("cancel_assignment", { sessionId: target })
    assert.equal(r.cancelled, "session")
    const cancelled = await coach.ok<{ assignments: Assignment[] }>("list_assignments", { status: ["cancelled"] })
    assert.deepEqual(cancelled.assignments.map((a) => a.sessionId), [target])
    // El atleta no puede cancelar
    assert.equal((await athlete.fail("cancel_assignment", { sessionId: assignments[1]!.sessionId })).code, "FORBIDDEN")
  })

  it("validaciones: atletas ajenos, fechas repetidas o de más, límite de asignaciones", async () => {
    const foreign = await coach.fail("assign_routine", { routineId, athleteIds: [fx.users.coachB.id] })
    assert.equal(foreign.code, "BAD_REQUEST")
    const bad = await coach.fail("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id], dates: ["2026-02-30"] })
    assert.equal(bad.code, "INVALID_INPUT")
    const tooMany = await coach.fail("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id], dates: Array.from({ length: 61 }, (_, i) => utcDate(i + 1)) })
    assert.equal(tooMany.code, "INVALID_INPUT")

    const { createRateLimiter } = await import("../../src/lib/rate-limit")
    const limited = await mcpClientFor(fx.users.coachA, { limiters: { schedule: createRateLimiter({ max: 1, windowMs: 3_600_000 }) } })
    try {
      await limited.ok("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id] })
      const e = await limited.fail("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id] })
      assert.equal(e.code, "RATE_LIMITED")
      assert.ok(Number(e.details?.retryAfterSeconds) > 0)
    } finally {
      await limited.close()
    }
  })
})
