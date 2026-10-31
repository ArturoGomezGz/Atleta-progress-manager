// Tipo de rutina, secuencias por día y reglas de inicio: createSequence, activate (futuro, orden,
// uno a la vez), skipMyStep, myCalendar, locked/lockReason y assign_sequence (MCP).

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { catalogExerciseIds, createFixtures, type Fixtures } from "./fixtures"
import { mcpClientFor, utcDate, type McpTestClient } from "./mcp-inmemory"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

const reasonOf = (err: unknown) => ((err as TRPCError).cause as { details?: { reason?: string } } | undefined)?.details?.reason

async function refusal(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (err) {
    assert.ok(err instanceof TRPCError, String(err))
    assert.equal(err.code, "BAD_REQUEST")
    return reasonOf(err)
  }
  assert.fail("debía rechazarse")
}

describe("Tipos de rutina y secuencias", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let mcp: McpTestClient
  let warmup: string
  let main: string
  let recovery: string
  let evaluation: string
  const teamId = () => fx.teams.a.id
  const coach = () => fx.callers.coachA
  const athlete = () => fx.callers.athleteA

  before(async () => {
    server = await startTestServer()
    fx = await createFixtures(server.baseUrl)
    mcp = await mcpClientFor(fx.users.coachA)
    const [ex] = await catalogExerciseIds(1)
    const content = { v: 1 as const, items: [{ type: "exercise" as const, id: crypto.randomUUID(), exerciseId: ex!, order: 0, sets: [{ setNumber: 1, setType: "reps" as const, targetReps: 10 }] }] }
    const mk = async (name: string, kind?: "warmup" | "main" | "recovery") =>
      (await coach().routines.create({ teamId: teamId(), name, kind, content })).id
    warmup = await mk("Calentamiento", "warmup")
    main = await mk("Principal")
    recovery = await mk("Recuperación", "recovery")
    evaluation = (await coach().routines.create({ teamId: teamId(), name: "Evaluación", category: "evaluation", content })).id
  })

  after(async () => {
    await mcp?.close()
    await server?.close()
  })

  it("rutinas: training sin kind → main; evaluation sin kind y rechaza uno; filtro y cambio de kind", async () => {
    const list = await coach().routines.list({ teamId: teamId() })
    const byId = new Map(list.map((r) => [r.id, r]))
    assert.equal(byId.get(main)!.kind, "main")
    assert.equal(byId.get(warmup)!.kind, "warmup")
    assert.equal(byId.get(evaluation)!.kind, null)
    assert.deepEqual((await coach().routines.list({ teamId: teamId(), kind: "recovery" })).map((r) => r.id), [recovery])

    await assert.rejects(coach().routines.create({ teamId: teamId(), name: "x", category: "evaluation", kind: "main" }), /no tienen tipo/)
    await assert.rejects(coach().routines.rename({ id: evaluation, kind: "warmup" }), /no tienen tipo/)

    const renamed = await coach().routines.rename({ id: recovery, kind: "main" })
    assert.equal(renamed.kind, "main")
    await coach().routines.rename({ id: recovery, kind: "recovery" })

    const dup = await coach().routines.duplicate({ id: warmup })
    assert.equal(dup.kind, "warmup")

    const viaMcp = await mcp.ok<{ routines: { id: string; kind: string | null }[] }>("list_routines", { kind: "warmup" })
    assert.ok(viaMcp.routines.every((r) => r.kind === "warmup") && viaMcp.routines.some((r) => r.id === warmup))
  })

  it("assign sin insertIndex: cada una va al final del día (0, 1, ...); override de kind/position/hora", async () => {
    const date = utcDate(40)
    const [w] = await coach().sessions.createMany({ routineId: warmup, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date] })
    const [m] = await coach().sessions.createMany({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date], scheduledTime: "18:30" })
    const [r] = await coach().sessions.createMany({ routineId: recovery, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date], kind: "main", position: 7 })
    assert.deepEqual([w!.kind, w!.position, w!.scheduledTime], ["warmup", 0, null])
    assert.deepEqual([m!.kind, m!.position, m!.scheduledTime], ["main", 1, "18:30"])
    assert.deepEqual([r!.kind, r!.position], ["main", 7])
    await assert.rejects(coach().sessions.create({ routineId: evaluation, teamId: teamId(), athleteIds: [fx.users.athleteA.id], kind: "main" }), /Las evaluaciones/)
    await assert.rejects(coach().sessions.createMany({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date], scheduledTime: "25:00" }))
    for (const s of [w, m, r]) await coach().sessions.cancel({ id: s!.id })
  })

  it("createSequence: una sesión por paso y fecha, position = índice; evaluaciones y no coach rechazados", async () => {
    await assert.rejects(
      coach().sessions.createSequence({ teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [utcDate(0)], steps: [{ routineId: main }, { routineId: evaluation }] }),
      /Solo los entrenamientos/,
    )
    await assert.rejects(athlete().sessions.createSequence({ teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [utcDate(0)], steps: [{ routineId: main }] }))

    const dates = [utcDate(1), utcDate(0)]
    const sessions = await coach().sessions.createSequence({
      teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates,
      steps: [{ routineId: warmup, scheduledTime: "07:00" }, { routineId: main }, { routineId: recovery, kind: "recovery" }],
    })
    assert.equal(sessions.length, 6)
    assert.deepEqual(sessions.map((s) => [s.scheduledDate, s.position, s.kind]), [
      [utcDate(0), 0, "warmup"], [utcDate(0), 1, "main"], [utcDate(0), 2, "recovery"],
      [utcDate(1), 0, "warmup"], [utcDate(1), 1, "main"], [utcDate(1), 2, "recovery"],
    ])
    assert.equal(sessions[0]!.scheduledTime, "07:00")
    assert.equal(sessions[0]!.status, "active")
    assert.equal(sessions[3]!.status, "scheduled")
    // Para los siguientes tests: mañana queda aparte
    for (const s of sessions.slice(3)) await coach().sessions.cancel({ id: s.id })
  })

  it("activate: orden dentro del día, uno a la vez, completar y saltar desbloquean", async () => {
    const mine = (await athlete().sessions.myCalendar({ from: utcDate(0), to: utcDate(0) })).filter((i) => i.scheduledDate === utcDate(0))
    assert.deepEqual(mine.map((i) => [i.kind, i.position, i.status, i.lockReason]), [
      ["warmup", 0, "scheduled", null],
      ["main", 1, "scheduled", "PREVIOUS_STEP_PENDING"],
      ["recovery", 2, "scheduled", "PREVIOUS_STEP_PENDING"],
    ])
    const [step1, step2, step3] = mine.map((i) => i.sessionId) as [string, string, string]

    assert.equal(await refusal(athlete().sessions.activate({ id: step2 })), "PREVIOUS_STEP_PENDING")
    await athlete().sessions.activate({ id: step1 })
    // Con el primero en curso, el segundo sigue esperando
    assert.equal(await refusal(athlete().sessions.activate({ id: step2 })), "PREVIOUS_STEP_PENDING")

    await athlete().sessions.completeMySession({ sessionId: step1 })
    await athlete().sessions.activate({ id: step2 })
    const detail = await athlete().sessions.get({ id: step3 })
    assert.equal(detail.locked, true)
    assert.equal(detail.lockReason, "PREVIOUS_STEP_PENDING")
    assert.equal(detail.kind, "recovery")
    assert.equal(detail.position, 2)

    // Saltar el paso en curso no se puede; el que sigue pendiente sí, y deja de bloquear
    await athlete().sessions.completeMySession({ sessionId: step2 })
    const skipped = await athlete().sessions.skipMyStep({ sessionId: step3 })
    assert.equal(skipped.status, "cancelled")
    assert.equal((await athlete().sessions.get({ id: step3 })).status, "cancelled")

    const done = (await athlete().sessions.myCalendar({ from: utcDate(0), to: utcDate(0) })).filter((i) => i.scheduledDate === utcDate(0))
    assert.deepEqual(done.map((i) => [i.status, i.locked]), [["completed", false], ["completed", false], ["cancelled", false]])
    assert.ok(done[0]!.completedAt)
    assert.equal(done[0]!.exerciseCount, 1)
    assert.equal(done[0]!.teamName, "Equipo A")
  })

  it("activate: fechas futuras → FUTURE_SESSION; localDate solo ±1 día; skipMyStep no salta el futuro", async () => {
    const [future] = await coach().sessions.createMany({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [utcDate(1)] })
    const id = future!.id
    assert.equal(await refusal(athlete().sessions.activate({ id })), "FUTURE_SESSION")
    assert.equal(await refusal(athlete().sessions.activate({ id, localDate: utcDate(0) })), "FUTURE_SESSION")
    // Una fecha local a más de un día de UTC se ignora (reloj mal puesto)
    assert.equal(await refusal(athlete().sessions.activate({ id, localDate: utcDate(5) })), "FUTURE_SESSION")
    assert.equal(await refusal(athlete().sessions.skipMyStep({ sessionId: id })), "FUTURE_SESSION")

    const locked = (await athlete().sessions.myPending()).find((p) => p.id === id)!
    assert.deepEqual([locked.locked, locked.lockReason], [true, "FUTURE"])
    const inList = (await athlete().sessions.myList({ teamId: teamId() })).find((p) => p.id === id)!
    assert.deepEqual([inList.locked, inList.lockReason, inList.position], [true, "FUTURE", 0])

    // Usuario en una zona horaria adelantada: ya es "mañana" para él
    await athlete().sessions.activate({ id, localDate: utcDate(1) })
    await athlete().sessions.completeMySession({ sessionId: id })
  })

  it("activate: ANOTHER_ACTIVE si ya hay otra en curso hoy", async () => {
    const a = await coach().sessions.create({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id] })
    const b = await coach().sessions.create({ routineId: recovery, teamId: teamId(), athleteIds: [fx.users.athleteA.id], position: 1 })
    await athlete().sessions.activate({ id: a.id })
    assert.equal(await refusal(athlete().sessions.activate({ id: b.id })), "ANOTHER_ACTIVE")
    const pending = (await athlete().sessions.myPending()).find((p) => p.id === b.id)!
    assert.equal(pending.lockReason, "ANOTHER_ACTIVE")
    await athlete().sessions.completeMySession({ sessionId: a.id })
    await athlete().sessions.activate({ id: b.id })
    await athlete().sessions.completeMySession({ sessionId: b.id })
  })

  it("skipMyStep abandona una sesión en curso y libera ANOTHER_ACTIVE", async () => {
    // Mismo orden (position) para que solo cuente "otro en curso"
    const a = await coach().sessions.create({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], position: 50 })
    const b = await coach().sessions.create({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], position: 50 })
    await athlete().sessions.activate({ id: a.id })
    assert.equal(await refusal(athlete().sessions.activate({ id: b.id })), "ANOTHER_ACTIVE")
    assert.equal((await athlete().sessions.skipMyStep({ sessionId: a.id })).status, "cancelled")
    await assert.rejects(athlete().sessions.skipMyStep({ sessionId: a.id }), /cancelada/)
    await athlete().sessions.activate({ id: b.id })
    await athlete().sessions.completeMySession({ sessionId: b.id })
  })

  it("evaluaciones: no se inician antes de su fecha", async () => {
    const [ev] = await coach().sessions.createMany({ routineId: evaluation, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [utcDate(3)] })
    assert.equal(ev!.kind, null)
    assert.equal(await refusal(coach().sessions.activate({ id: ev!.id })), "FUTURE_SESSION")
    await assert.rejects(athlete().sessions.skipMyStep({ sessionId: ev!.id }), /evaluaciones/)
    const item = (await athlete().sessions.myCalendar({ from: utcDate(3), to: utcDate(3) })).find((i) => i.sessionId === ev!.id)!
    assert.deepEqual([item.category, item.kind, item.status, item.lockReason], ["evaluation", null, "scheduled", "FUTURE"])
    await coach().sessions.cancel({ id: ev!.id })
  })

  it("myCalendar: rango, orden por fecha/position/hora, 'ahora' pendiente cuenta como hoy, máx. 62 días", async () => {
    const date = utcDate(10)
    await coach().sessions.createMany({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date], position: 5, scheduledTime: "20:00" })
    await coach().sessions.createMany({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date], position: 5, scheduledTime: "08:00" })
    await coach().sessions.createMany({ routineId: warmup, teamId: teamId(), athleteIds: [fx.users.athleteA.id], dates: [date], position: 0 })
    const now = await coach().sessions.create({ routineId: main, teamId: teamId(), athleteIds: [fx.users.athleteA.id] })

    const cal = await athlete().sessions.myCalendar({ from: utcDate(0), to: utcDate(12) })
    const onDate = cal.filter((i) => i.scheduledDate === date)
    assert.deepEqual(onDate.map((i) => [i.position, i.scheduledTime]), [[0, null], [5, "08:00"], [5, "20:00"]])
    assert.ok(cal.every((c, i) => i === 0 || cal[i - 1]!.scheduledDate <= c.scheduledDate))
    assert.equal(cal.find((i) => i.sessionId === now.id)!.scheduledDate, utcDate(0))
    // Fuera del rango no sale
    assert.equal((await athlete().sessions.myCalendar({ from: utcDate(20), to: utcDate(22) })).length, 0)
    await assert.rejects(athlete().sessions.myCalendar({ from: utcDate(0), to: utcDate(63) }), /rango máximo/)
    await assert.rejects(athlete().sessions.myCalendar({ from: utcDate(5), to: utcDate(0) }))
    await athlete().sessions.myCalendar({ from: utcDate(0), to: utcDate(62) })
    // El coach no es atleta del equipo: su calendario no incluye lo de los demás
    assert.equal((await coach().sessions.myCalendar({ from: utcDate(0), to: utcDate(12) })).length, 0)
  })

  it("assign_sequence (MCP) y assign_routine con kind/position/scheduledTime", async () => {
    const r = await mcp.ok<{ sessions: { sessionId: string; date: string; position: number; kind: string; scheduledTime: string | null }[] }>("assign_sequence", {
      athleteIds: [fx.users.athleteA.id], dates: [utcDate(30)], steps: [{ routineId: warmup, scheduledTime: "06:45" }, { routineId: main }],
    })
    assert.deepEqual(r.sessions.map((s) => [s.date, s.position, s.kind, s.scheduledTime]), [[utcDate(30), 0, "warmup", "06:45"], [utcDate(30), 1, "main", null]])
    const bad = await mcp.fail("assign_sequence", { athleteIds: [fx.users.athleteA.id], dates: [utcDate(30)], steps: [{ routineId: evaluation }] })
    assert.equal(bad.code, "BAD_REQUEST")

    const one = await mcp.ok<{ sessions: { kind: string; position: number; scheduledTime: string | null }[] }>("assign_routine", {
      routineId: recovery, athleteIds: [fx.users.athleteA.id], dates: [utcDate(31)], scheduledTime: "21:00",
    })
    assert.deepEqual([one.sessions[0]!.kind, one.sessions[0]!.position, one.sessions[0]!.scheduledTime], ["recovery", 0, "21:00"])
    const listed = await mcp.ok<{ assignments: { kind: string | null; position: number }[] }>("list_assignments", { from: utcDate(31), to: utcDate(31) })
    assert.deepEqual(listed.assignments.map((a) => [a.kind, a.position]), [["recovery", 0]])
  })
})
