// Plan del día (sessions.dayPlan) e insertIndex al asignar: lugar elegido por el coach, renumeración
// contigua, rechazo antes de lo ya hecho y valor por defecto "al final del día".

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { catalogExerciseIds, createFixtures, type Fixtures } from "./fixtures"
import { mcpClientFor, utcDate, type McpTestClient } from "./mcp-inmemory"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

describe("Plan del día e insertIndex", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let mcp: McpTestClient
  const r: Record<string, string> = {}
  const teamId = () => fx.teams.a.id
  const coach = () => fx.callers.coachA
  const athlete = () => fx.callers.athleteA
  const ath = () => [fx.users.athleteA.id]
  const plan = async (date: string) => (await coach().sessions.dayPlan({ teamId: teamId(), athleteIds: ath(), date })).map((e) => [e.routineName, e.position, e.status])
  const assign = (routineId: string, date: string, insertIndex?: number) =>
    coach().sessions.createMany({ routineId, teamId: teamId(), athleteIds: ath(), dates: [date], insertIndex }).then((x) => x[0]!)

  before(async () => {
    server = await startTestServer()
    fx = await createFixtures(server.baseUrl)
    mcp = await mcpClientFor(fx.users.coachA)
    const [ex] = await catalogExerciseIds(1)
    const content = { v: 1 as const, items: [{ type: "exercise" as const, id: crypto.randomUUID(), exerciseId: ex!, order: 0, sets: [{ setNumber: 1, setType: "reps" as const, targetReps: 10 }] }] }
    for (const [name, kind] of [["Cal", "warmup"], ["Fuerza", "main"], ["Extra", "main"], ["Soltar", "recovery"]] as const) {
      r[name] = (await coach().routines.create({ teamId: teamId(), name, kind, content })).id
    }
    r.Eval = (await coach().routines.create({ teamId: teamId(), name: "Eval", category: "evaluation", content })).id
  })
  after(async () => { await mcp.close(); await server.close() })

  it("dayPlan: vacío sin rutinas; solo coach; sin atletas devuelve vacío; ignora evaluaciones y canceladas", async () => {
    const d = utcDate(20)
    assert.deepEqual(await plan(d), [])
    assert.deepEqual(await coach().sessions.dayPlan({ teamId: teamId(), athleteIds: [], date: d }), [])
    await assert.rejects(athlete().sessions.dayPlan({ teamId: teamId(), athleteIds: ath(), date: d }))
    await assert.rejects(fx.callers.coachB.sessions.dayPlan({ teamId: teamId(), athleteIds: ath(), date: d }))

    const a = await assign(r.Fuerza!, d)
    await coach().sessions.createMany({ routineId: r.Eval!, teamId: teamId(), athleteIds: ath(), dates: [d] })
    const c = await assign(r.Extra!, d)
    await coach().sessions.cancel({ id: c.id })
    const got = await coach().sessions.dayPlan({ teamId: teamId(), athleteIds: ath(), date: d })
    assert.deepEqual(got.map((e) => e.sessionId), [a.id])
    assert.deepEqual(got[0], { sessionId: a.id, routineName: "Fuerza", kind: "main", position: 0, athleteNames: ["Atleta A"], status: "pending" })
    assert.deepEqual(await plan(utcDate(21)), [])
  })

  it("sin insertIndex cada rutina va al final del día (0, 1, 2…)", async () => {
    const d = utcDate(22)
    const s = [await assign(r.Soltar!, d), await assign(r.Cal!, d), await assign(r.Fuerza!, d)]
    assert.deepEqual(s.map((x) => x.position), [0, 1, 2])
    assert.deepEqual(await plan(d), [["Soltar", 0, "pending"], ["Cal", 1, "pending"], ["Fuerza", 2, "pending"]])
  })

  it("insertIndex: inicio, medio y final renumeran de forma contigua", async () => {
    const d = utcDate(23)
    await assign(r.Fuerza!, d)
    await assign(r.Soltar!, d)
    const start = await assign(r.Cal!, d, 0)
    assert.equal(start.position, 0)
    assert.deepEqual(await plan(d), [["Cal", 0, "pending"], ["Fuerza", 1, "pending"], ["Soltar", 2, "pending"]])
    const mid = await assign(r.Extra!, d, 2)
    assert.equal(mid.position, 2)
    assert.deepEqual(await plan(d), [["Cal", 0, "pending"], ["Fuerza", 1, "pending"], ["Extra", 2, "pending"], ["Soltar", 3, "pending"]])
    const end = await assign(r.Cal!, d, 4)
    assert.equal(end.position, 4)
    assert.deepEqual((await plan(d)).map((e) => e[1]), [0, 1, 2, 3, 4])
    await assert.rejects(assign(r.Cal!, d, 6), /Ese lugar no existe/)
    await assert.rejects(coach().sessions.createMany({ routineId: r.Cal!, teamId: teamId(), athleteIds: ath(), dates: [d], insertIndex: 1, position: 3 }), /insertIndex o position/)
    await assert.rejects(coach().sessions.createMany({ routineId: r.Eval!, teamId: teamId(), athleteIds: ath(), dates: [d], insertIndex: 0 }), /Las evaluaciones/)
  })

  it("renumera aunque haya huecos en position y create (una fecha) acepta insertIndex", async () => {
    const d = utcDate(24)
    await coach().sessions.createMany({ routineId: r.Fuerza!, teamId: teamId(), athleteIds: ath(), dates: [d], position: 7 })
    await coach().sessions.createMany({ routineId: r.Soltar!, teamId: teamId(), athleteIds: ath(), dates: [d], position: 9 })
    const s = await coach().sessions.create({ routineId: r.Cal!, teamId: teamId(), athleteIds: ath(), scheduledDate: d, insertIndex: 1 })
    assert.equal(s.position, 1)
    assert.deepEqual(await plan(d), [["Fuerza", 0, "pending"], ["Cal", 1, "pending"], ["Soltar", 2, "pending"]])
  })

  it("rechaza insertar antes de una rutina completada o en curso; después sí", async () => {
    // Hoy: "Ahora" cuenta como hoy y el atleta puede iniciar
    const today = utcDate(0)
    const first = await coach().sessions.create({ routineId: r.Cal!, teamId: teamId(), athleteIds: ath() })
    assert.equal(first.position, 0)
    const second = await coach().sessions.create({ routineId: r.Fuerza!, teamId: teamId(), athleteIds: ath() })
    // La segunda "Ahora" se fija a hoy para que el orden se respete
    assert.deepEqual([second.position, second.scheduledDate], [1, today])
    assert.deepEqual(await plan(today), [["Cal", 0, "pending"], ["Fuerza", 1, "pending"]])

    await athlete().sessions.activate({ id: first.id })
    assert.deepEqual((await plan(today))[0], ["Cal", 0, "active"])
    await assert.rejects(coach().sessions.create({ routineId: r.Extra!, teamId: teamId(), athleteIds: ath(), insertIndex: 0 }), /ya se completó o está en curso/)

    await athlete().sessions.completeMySession({ sessionId: first.id })
    assert.deepEqual((await plan(today))[0], ["Cal", 0, "completed"])
    await assert.rejects(coach().sessions.create({ routineId: r.Extra!, teamId: teamId(), athleteIds: ath(), insertIndex: 0 }), /ya se completó o está en curso/)
    // Nada cambió tras los rechazos (transacción)
    assert.deepEqual((await plan(today)).map((e) => e[1]), [0, 1])

    // Entre la completada y la pendiente sí se puede
    const between = await coach().sessions.create({ routineId: r.Extra!, teamId: teamId(), athleteIds: ath(), insertIndex: 1 })
    assert.equal(between.position, 1)
    assert.deepEqual(await plan(today), [["Cal", 0, "completed"], ["Extra", 1, "pending"], ["Fuerza", 2, "pending"]])
    // y el orden se respeta: Fuerza espera a Extra
    const calendar = await athlete().sessions.myCalendar({ from: today, to: today })
    assert.deepEqual(calendar.map((i) => [i.routineName, i.lockReason]), [["Cal", null], ["Extra", null], ["Fuerza", "PREVIOUS_STEP_PENDING"]])
  })

  it("assign_routine (MCP): insertIndex y por defecto al final", async () => {
    const d = utcDate(26)
    type Out = { sessions: { position: number }[] }
    const a = await mcp.ok<Out>("assign_routine", { routineId: r.Fuerza!, athleteIds: ath(), dates: [d] })
    const b = await mcp.ok<Out>("assign_routine", { routineId: r.Soltar!, athleteIds: ath(), dates: [d] })
    const c = await mcp.ok<Out>("assign_routine", { routineId: r.Cal!, athleteIds: ath(), dates: [d], insertIndex: 0 })
    assert.deepEqual([a, b, c].map((x) => x.sessions[0]!.position), [0, 1, 0])
    assert.deepEqual(await plan(d), [["Cal", 0, "pending"], ["Fuerza", 1, "pending"], ["Soltar", 2, "pending"]])
    const bad = await mcp.fail("assign_routine", { routineId: r.Cal!, athleteIds: ath(), dates: [d], insertIndex: 9 })
    assert.equal(bad.code, "BAD_REQUEST")
  })
})
