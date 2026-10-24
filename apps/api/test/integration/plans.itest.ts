// Paquete D — planes de entrenamiento multi-semana: herramientas MCP de planes contra la
// API real (router plans.* + Postgres). Las herramientas se prueban con un McpServer en
// memoria donde solo se registran las de planes, con un McpToolContext real (caller del
// usuario, flags reales y limitadores de lib/rate-limit).

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TRPCError } from "@trpc/server"
import type { FastifyBaseLogger } from "fastify"
import type { McpScope, McpToolContext } from "../../src/mcp/types"
import { callerFor, catalogExerciseIds, createFixtures, signUp, type Fixtures, type FixtureUser } from "./fixtures"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

// Usuarios propios de esta suite: con mcp + scheduled_sessions pero sin training_plans, y
// con training_plans pero sin scheduled_sessions (training_plans queda inactivo por REQUIRES)
const NO_PLANS_EMAIL = "sin-planes@test.local"
const NO_SCHEDULED_EMAIL = "sin-programados@test.local"

const PLAN_TOOLS = ["cancel_plan_assignment", "create_plan", "duplicate_plan", "get_plan", "list_plans", "schedule_plan", "update_plan"]

const silentLog = (() => {
  const noop = () => {}
  const log = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, child: () => log, level: "silent" }
  return log as unknown as FastifyBaseLogger
})()

const isTrpc = (code: TRPCError["code"]) => (err: unknown) => err instanceof TRPCError && err.code === code

// Fechas sin depender del código bajo prueba
const DAY_MS = 86_400_000
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const isoWeekday = (d: string) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

type Structured = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type ToolError = { code: string; message: string; details?: Record<string, unknown> }

describe("planes de entrenamiento (MCP + plans.*)", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let exerciseIds: string[]
  let today: string
  const clients: Client[] = []

  async function mcpContext(u: { id: string }, opts: { scopes?: McpScope[]; scheduleMax?: number } = {}): Promise<McpToolContext> {
    const [{ db }, { user }, { eq }, { createMcpCaller }, { activeFeatures }, { createRateLimiter }] = await Promise.all([
      import("@atleta/db/client"),
      import("@atleta/db/schema"),
      import("drizzle-orm"),
      import("../../src/mcp/context"),
      import("../../src/lib/features"),
      import("../../src/lib/rate-limit"),
    ])
    const [row] = await db.select().from(user).where(eq(user.id, u.id)).limit(1)
    const principal = {
      kind: "pat" as const,
      user: { id: row!.id, email: row!.email, name: row!.name, emailVerified: row!.emailVerified, image: row!.image ?? null, createdAt: row!.createdAt, updatedAt: row!.updatedAt },
      scopes: new Set<McpScope>(opts.scopes ?? ["atleta:read", "atleta:write"]),
      tokenId: `itest-${row!.id}`,
    }
    return {
      principal,
      caller: createMcpCaller(principal, silentLog),
      features: new Set(activeFeatures(principal.user)),
      log: silentLog,
      now: () => new Date(),
      limiters: {
        write: createRateLimiter({ max: 30, windowMs: 60_000 }),
        exerciseCreate: createRateLimiter({ max: 10, windowMs: 3_600_000 }),
        schedule: createRateLimiter({ max: opts.scheduleMax ?? 20, windowMs: 3_600_000 }),
      },
      requestId: "itest",
    }
  }

  async function connect(u: { id: string }, opts: Parameters<typeof mcpContext>[1] = {}) {
    const [{ registerPlanTools }, { registerAtletaTool }] = await Promise.all([import("../../src/mcp/tools/plans"), import("../../src/mcp/tool")])
    const ctx = await mcpContext(u, opts)
    const mcp = new McpServer({ name: "atleta-planes-test", version: "0.0.0" })
    // Una herramienta neutra para que el servidor siempre anuncie `tools` (aunque no haya de planes)
    registerAtletaTool(mcp, ctx, { name: "ping", title: "Ping", description: "ping", scope: "atleta:read", input: {}, run: async () => ({ ok: true }) })
    registerPlanTools(mcp, ctx)
    const [clientT, serverT] = InMemoryTransport.createLinkedPair()
    await mcp.connect(serverT)
    const client = new Client({ name: "itest", version: "0.0.0" })
    await client.connect(clientT)
    clients.push(client)
    return client
  }

  async function call(client: Client, name: string, args: Record<string, unknown>): Promise<Structured> {
    const r = await client.callTool({ name, arguments: args })
    if (r.isError) throw new Error(`${name}: ${(r.content as { text: string }[])[0]?.text}`)
    return r.structuredContent as Structured
  }

  async function callError(client: Client, name: string, args: Record<string, unknown>): Promise<ToolError> {
    const r = await client.callTool({ name, arguments: args })
    assert.equal(r.isError, true, `${name} debía fallar`)
    return (r.structuredContent as { error: ToolError }).error
  }

  async function count(table: "training_plan_assignment" | "training_session" | "training_plan" | "routine") {
    const [{ db }, { sql }] = await Promise.all([import("@atleta/db/client"), import("drizzle-orm")])
    const rows = (await db.execute(sql.raw(`select count(*)::int as n from ${table}`))) as unknown as { n: number }[]
    return rows[0]!.n
  }

  const sets = { count: 3, setType: "reps", targetReps: 8, loadType: "rpe", loadValue: 7 }
  const routineInput = (key: string, exerciseId: string) => ({
    key,
    name: `Rutina ${key}`,
    content: { items: [{ type: "exercise", exerciseId, sets, restSeconds: 90 }] },
  })

  before(async () => {
    server = await startTestServer({
      env: {
        FEATURE_MCP_USERS: [NO_PLANS_EMAIL, NO_SCHEDULED_EMAIL].join(","),
        FEATURE_SCHEDULED_SESSIONS_USERS: NO_PLANS_EMAIL,
        FEATURE_TRAINING_PLANS_USERS: NO_SCHEDULED_EMAIL,
      },
    })
    fx = await createFixtures(server.baseUrl)
    exerciseIds = await catalogExerciseIds(3)
    const { todayUtc } = await import("../../src/services/session-assign")
    today = todayUtc()
  })

  after(async () => {
    await Promise.all(clients.map((c) => c.close()))
    await server?.close()
  })

  it("create → get → schedule dryRun (no escribe) → schedule → cancel desde una fecha", async () => {
    const client = await connect(fx.users.coachA)
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name).filter((n) => n !== "ping").sort(), PLAN_TOOLS)

    // 4 semanas × 3 días: hoy y los dos días siguientes (weekday ISO), rutinas nuevas por key
    const todayWd = isoWeekday(today)
    const weekdays = [todayWd, 1 + (todayWd % 7), 1 + ((todayWd + 1) % 7)]
    const keys = ["A", "B", "C"]
    const workouts = [1, 2, 3, 4].flatMap((week) => weekdays.map((weekday, i) => ({ week, weekday, routineKey: keys[i] })))
    const created = await call(client, "create_plan", {
      name: "Mesociclo de fuerza",
      goal: "Fuerza máxima",
      weeks: 4,
      weekMeta: [{ week: 1, name: "Acumulación", focus: "Volumen" }, { week: 4, name: "Descarga" }],
      routines: keys.map((k, i) => routineInput(k, exerciseIds[i]!)),
      workouts,
    })
    assert.equal(created.workoutCount, 12)
    assert.deepEqual(created.createdRoutines.map((r: { key: string }) => r.key), keys)
    const routineIdByKey = new Map<string, string>(created.createdRoutines.map((r: { key: string; routineId: string }) => [r.key, r.routineId]))

    const plan = await call(client, "get_plan", { planId: created.planId })
    assert.equal(plan.teamId, fx.teams.a.id)
    assert.equal(plan.status, "draft")
    assert.equal(plan.updatedAt, created.updatedAt)
    assert.deepEqual(plan.schedule.map((w: { week: number; name: string | null }) => [w.week, w.name]), [[1, "Acumulación"], [2, null], [3, null], [4, "Descarga"]])
    for (const week of plan.schedule) {
      assert.equal(week.days.length, 3)
      for (const day of week.days) {
        const i = weekdays.indexOf(day.weekday)
        assert.equal(day.workouts.length, 1)
        assert.equal(day.workouts[0].routineId, routineIdByKey.get(keys[i]!))
        assert.equal(day.workouts[0].routineName, `Rutina ${keys[i]}`)
      }
    }
    assert.deepEqual(plan.assignments, [])
    const listed = await call(client, "list_plans", {})
    assert.deepEqual(
      listed.plans.map((p: Structured) => [p.planId, p.weeks, p.workoutCount, p.activeAssignments]),
      [[created.planId, 4, 12, 0]],
    )

    // Fechas esperadas (startDate = hoy): lunes de esta semana + (semana − 1)·7 + (weekday − 1)
    const monday = addDays(today, 1 - todayWd)
    const slotDate = (week: number, weekday: number) => addDays(monday, (week - 1) * 7 + weekday - 1)
    const allSlots = workouts.map((w) => ({ ...w, date: slotDate(w.week, w.weekday) })).sort((a, b) => a.date.localeCompare(b.date))
    const expected = allSlots.filter((s) => s.date >= today)
    const athleteIds = [fx.users.athleteA.id]

    // dryRun: calcula sin escribir
    const before = { a: await count("training_plan_assignment"), s: await count("training_session") }
    const dry = await call(client, "schedule_plan", { planId: created.planId, athleteIds, startDate: today, dryRun: true })
    assert.equal(dry.assignmentId, null)
    assert.equal(dry.dryRun, true)
    assert.deepEqual(dry.sessions.map((s: Structured) => s.date), expected.map((s) => s.date))
    assert.ok(dry.sessions.every((s: Structured) => s.sessionId === undefined))
    assert.equal(dry.skipped.length, 12 - expected.length)
    assert.ok(dry.skipped.every((s: Structured) => s.reason === "before_start"))
    assert.deepEqual({ a: await count("training_plan_assignment"), s: await count("training_session") }, before)

    // dryRun desde mañana: el hueco de hoy queda antes del inicio; desde hace una semana, hay huecos en el pasado
    const fromTomorrow = await call(client, "schedule_plan", { planId: created.planId, athleteIds, startDate: addDays(today, 1), dryRun: true })
    assert.ok(fromTomorrow.sessions.every((s: Structured) => s.date > today))
    assert.ok(fromTomorrow.skipped.some((s: Structured) => s.reason === "before_start" && s.weekday === todayWd && s.week === 1))
    const fromLastWeek = await call(client, "schedule_plan", { planId: created.planId, athleteIds, startDate: addDays(today, -7), dryRun: true })
    assert.ok(fromLastWeek.skipped.some((s: Structured) => s.reason === "past"))
    assert.ok(fromLastWeek.sessions.every((s: Structured) => s.date >= today))
    assert.deepEqual({ a: await count("training_plan_assignment"), s: await count("training_session") }, before)

    // Programar de verdad
    const scheduled = await call(client, "schedule_plan", { planId: created.planId, athleteIds, startDate: today })
    assert.equal(scheduled.dryRun, false)
    assert.ok(scheduled.assignmentId)
    assert.deepEqual(scheduled.sessions.map((s: Structured) => s.date), expected.map((s) => s.date))
    assert.deepEqual(
      scheduled.sessions.map((s: Structured) => s.status),
      expected.map((s) => (s.date === today ? "active" : "scheduled")),
    )
    assert.equal(scheduled.sessions[0].status, "active") // el hueco de hoy (weekday de hoy, semana 1)

    const [{ db }, schema, { eq, inArray }] = await Promise.all([import("@atleta/db/client"), import("@atleta/db/schema"), import("drizzle-orm")])
    const rows = await db.select().from(schema.trainingSession).where(eq(schema.trainingSession.planAssignmentId, scheduled.assignmentId))
    assert.equal(rows.length, expected.length)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const workoutIds = new Set(plan.schedule.flatMap((w: Structured) => w.days.flatMap((d: Structured) => d.workouts.map((x: Structured) => x.workoutId))))
    for (const s of scheduled.sessions) {
      const row = byId.get(s.sessionId)!
      assert.equal(row.scheduledDate, s.date)
      assert.equal(row.status, s.date === today ? "active" : "scheduled")
      assert.equal(row.routineId, s.routineId)
      assert.equal(row.planWorkoutId, s.workoutId)
      assert.ok(workoutIds.has(row.planWorkoutId))
      assert.equal(row.teamId, fx.teams.a.id)
    }
    // Snapshot de contenido idéntico al de la rutina (createAssignedSessions)
    const [routineA] = await db.select().from(schema.routine).where(eq(schema.routine.id, routineIdByKey.get("A")!))
    const sessionA = rows.find((r) => r.routineId === routineA!.id)!
    assert.deepEqual(sessionA.content, routineA!.content)
    const exercisesA = await db.select().from(schema.sessionExercise).where(eq(schema.sessionExercise.sessionId, sessionA.id))
    assert.deepEqual(exercisesA.map((e) => e.exerciseId), [exerciseIds[0]])
    const athletes = await db.select().from(schema.athleteSession).where(inArray(schema.athleteSession.sessionId, rows.map((r) => r.id)))
    assert.equal(athletes.length, expected.length)
    assert.ok(athletes.every((a) => a.athleteId === fx.users.athleteA.id && a.status === "scheduled"))
    const [assignment] = await db.select().from(schema.trainingPlanAssignment).where(eq(schema.trainingPlanAssignment.id, scheduled.assignmentId))
    assert.equal(assignment!.status, "active")
    assert.equal(assignment!.startDate, today)
    assert.equal(assignment!.planId, created.planId)

    // El atleta ve todo en sus pendientes
    const pending = new Set((await fx.callers.athleteA.sessions.myPending()).map((p) => p.id))
    for (const s of scheduled.sessions) assert.ok(pending.has(s.sessionId), `falta ${s.date} en myPending`)

    const withAssignment = await call(client, "get_plan", { planId: created.planId })
    assert.equal(withAssignment.assignments.length, 1)
    assert.deepEqual(withAssignment.assignments[0].athletes, [{ athleteId: fx.users.athleteA.id, name: "Atleta A" }])
    assert.deepEqual(withAssignment.assignments[0].sessions, { total: expected.length, completed: 0, cancelled: 0 })
    assert.equal((await call(client, "list_plans", {})).plans[0].activeAssignments, 1)

    // El atleta empieza el último entrenamiento: cancelar desde la semana 3 lo conserva
    const last = scheduled.sessions[scheduled.sessions.length - 1]
    await fx.callers.athleteA.sessions.activate({ id: last.sessionId })
    const fromDate = addDays(monday, 14)
    const fromWeek3 = scheduled.sessions.filter((s: Structured) => s.date >= fromDate)
    const cancel1 = await call(client, "cancel_plan_assignment", { assignmentId: scheduled.assignmentId, fromDate })
    assert.equal(cancel1.cancelledSessions, fromWeek3.length - 1)
    assert.equal(cancel1.keptSessions, expected.length - (fromWeek3.length - 1))
    assert.equal(cancel1.status, "active")

    const after1 = new Map((await db.select().from(schema.trainingSession).where(eq(schema.trainingSession.planAssignmentId, scheduled.assignmentId))).map((r) => [r.id, r.status]))
    for (const s of scheduled.sessions) {
      const want = s.sessionId === last.sessionId ? "active" : s.date >= fromDate ? "cancelled" : s.date === today ? "active" : "scheduled"
      assert.equal(after1.get(s.sessionId), want, s.date)
    }
    const pending1 = new Set((await fx.callers.athleteA.sessions.myPending()).map((p) => p.id))
    assert.ok(pending1.has(last.sessionId))
    assert.ok(fromWeek3.filter((s: Structured) => s.sessionId !== last.sessionId).every((s: Structured) => !pending1.has(s.sessionId)))
    assert.ok(scheduled.sessions.filter((s: Structured) => s.date < fromDate).every((s: Structured) => pending1.has(s.sessionId)))

    // Sin fromDate: cancela lo que queda sin empezar y la asignación queda cancelada
    const cancel2 = await call(client, "cancel_plan_assignment", { assignmentId: scheduled.assignmentId })
    assert.equal(cancel2.cancelledSessions, expected.length - fromWeek3.length)
    assert.equal(cancel2.keptSessions, 1)
    assert.equal(cancel2.status, "cancelled")
    const final = await call(client, "get_plan", { planId: created.planId })
    assert.equal(final.assignments[0].status, "cancelled")
    assert.equal(final.assignments[0].sessions.cancelled, expected.length - 1)
  })

  it("update_plan: CONFLICT con updatedAt viejo y reducir semanas solo sin huecos fuera", async () => {
    const client = await connect(fx.users.coachA)
    const created = await call(client, "create_plan", {
      name: "Plan editable",
      weeks: 3,
      routines: [routineInput("X", exerciseIds[0]!)],
      workouts: [{ week: 1, weekday: 1, routineKey: "X" }, { week: 3, weekday: 2, routineKey: "X" }, { week: 3, weekday: 2, routineKey: "X" }],
    })
    const renamed = await call(client, "update_plan", { planId: created.planId, expectedUpdatedAt: created.updatedAt, name: "Plan renombrado", status: "active" })
    assert.notEqual(renamed.updatedAt, created.updatedAt)

    const conflict = await callError(client, "update_plan", { planId: created.planId, expectedUpdatedAt: created.updatedAt, name: "Otro" })
    assert.equal(conflict.code, "CONFLICT")
    assert.match(conflict.message, /get_plan/)
    assert.deepEqual(conflict.details, { updatedAt: renamed.updatedAt })

    const tooShort = await callError(client, "update_plan", { planId: created.planId, expectedUpdatedAt: renamed.updatedAt, weeks: 2 })
    assert.equal(tooShort.code, "BAD_REQUEST")
    assert.match(tooShort.message, /semana 3/)

    const plan = await call(client, "get_plan", { planId: created.planId })
    assert.equal(plan.name, "Plan renombrado")
    assert.equal(plan.status, "active")
    const week3 = plan.schedule[2].days[0].workouts
    assert.deepEqual(week3.map((w: Structured) => w.position), [0, 1])
    const routineX = plan.schedule[0].days[0].workouts[0].routineId
    const shrunk = await call(client, "update_plan", {
      planId: created.planId,
      expectedUpdatedAt: plan.updatedAt,
      weeks: 2,
      removeWorkoutIds: week3.map((w: Structured) => w.workoutId),
      addWorkouts: [{ week: 1, weekday: 1, routineId: routineX }, { week: 2, weekday: 4, routineId: routineX, notes: "Técnica" }],
      weekMeta: [{ week: 2, focus: "Intensidad" }],
    })
    assert.equal(shrunk.workoutCount, 3)
    const after = await call(client, "get_plan", { planId: created.planId })
    assert.equal(after.weeks, 2)
    assert.equal(after.schedule.length, 2)
    assert.equal(after.schedule[1].focus, "Intensidad")
    assert.deepEqual(after.schedule[0].days[0].workouts.map((w: Structured) => w.position), [0, 1]) // se agrega al final del día
    assert.equal(after.schedule[1].days[0].workouts[0].notes, "Técnica")

    // Validaciones de entrada: exactamente uno de routineId/routineKey
    const both = await callError(client, "create_plan", { name: "Mal", weeks: 1, workouts: [{ week: 1, weekday: 1, routineId: routineX, routineKey: "X" }] })
    assert.equal(both.code, "INVALID_INPUT")
    const missingKey = await callError(client, "create_plan", { name: "Mal", weeks: 1, workouts: [{ week: 1, weekday: 1, routineKey: "nada" }] })
    assert.equal(missingKey.code, "INVALID_INPUT")

    // duplicate_plan con copyRoutines: la copia apunta a rutinas nuevas
    const routinesBefore = await count("routine")
    const dup = await call(client, "duplicate_plan", { planId: created.planId, copyRoutines: true })
    assert.equal(dup.createdRoutines.length, 1)
    assert.equal(await count("routine"), routinesBefore + 1)
    const copy = await call(client, "get_plan", { planId: dup.planId })
    assert.equal(copy.status, "draft")
    assert.equal(copy.name, "Plan renombrado (copia)")
    assert.ok(copy.schedule.flatMap((w: Structured) => w.days.flatMap((d: Structured) => d.workouts)).every((w: Structured) => w.routineId === dup.createdRoutines[0].routineId))
    const plain = await call(client, "duplicate_plan", { planId: created.planId, name: "Sin copiar rutinas" })
    assert.deepEqual(plain.createdRoutines, [])
    assert.equal(await count("routine"), routinesBefore + 1)
  })

  it("multi-tenant: el coach B no ve, edita ni programa planes de A; A no programa a atletas ajenos", async () => {
    const a = await connect(fx.users.coachA)
    const b = await connect(fx.users.coachB)
    const created = await call(a, "create_plan", {
      name: "Plan privado de A",
      weeks: 1,
      routines: [routineInput("A", exerciseIds[0]!)],
      workouts: [{ week: 1, weekday: 7, routineKey: "A" }],
    })
    const routineA = created.createdRoutines[0].routineId
    const scheduled = await call(a, "schedule_plan", { planId: created.planId, athleteIds: [fx.users.athleteA.id], startDate: today })

    assert.equal((await callError(b, "get_plan", { planId: created.planId })).code, "FORBIDDEN")
    assert.equal((await callError(b, "update_plan", { planId: created.planId, expectedUpdatedAt: created.updatedAt, name: "Robado" })).code, "FORBIDDEN")
    assert.equal((await callError(b, "duplicate_plan", { planId: created.planId })).code, "FORBIDDEN")
    assert.equal((await callError(b, "schedule_plan", { planId: created.planId, athleteIds: [fx.users.athleteA.id], startDate: today, dryRun: true })).code, "FORBIDDEN")
    assert.equal((await callError(b, "cancel_plan_assignment", { assignmentId: scheduled.assignmentId })).code, "FORBIDDEN")
    assert.ok(!(await call(b, "list_plans", {})).plans.some((p: Structured) => p.planId === created.planId))
    assert.equal((await callError(b, "list_plans", { teamId: fx.teams.a.id })).code, "FORBIDDEN")
    // B no puede crear en el equipo de A ni referenciar rutinas de A
    assert.equal((await callError(b, "create_plan", { teamId: fx.teams.a.id, name: "x", weeks: 1, workouts: [] })).code, "FORBIDDEN")
    const foreign = await callError(b, "create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 1, routineId: routineA }] })
    assert.equal(foreign.code, "BAD_REQUEST")
    assert.match(foreign.message, /no existe en este equipo/)

    // A no puede programar a un usuario que no es atleta de su equipo
    const outsider = await callError(a, "schedule_plan", { planId: created.planId, athleteIds: [fx.users.coachB.id], startDate: today })
    assert.equal(outsider.code, "BAD_REQUEST")
    // El atleta no crea planes (resolveTeamId exige coach)
    const athlete = await connect(fx.users.athleteA)
    assert.equal((await callError(athlete, "create_plan", { name: "x", weeks: 1, workouts: [] })).code, "FORBIDDEN")
    assert.equal((await callError(athlete, "create_plan", { teamId: fx.teams.a.id, name: "x", weeks: 1, workouts: [] })).code, "FORBIDDEN")
    // …pero puede leer los planes de su equipo, sin las asignaciones
    const seen = await call(athlete, "get_plan", { planId: created.planId })
    assert.deepEqual(seen.assignments, [])
  })

  it("límites: rutinas de evaluación o archivadas, tasa de schedule_plan y scope de solo lectura", async () => {
    const a = await connect(fx.users.coachA, { scheduleMax: 1 })
    const evaluation = await fx.callers.coachA.routines.create({ teamId: fx.teams.a.id, name: "Test de RM", category: "evaluation" })
    const evalErr = await callError(a, "create_plan", { name: "x", weeks: 1, workouts: [{ week: 1, weekday: 1, routineId: evaluation.id }] })
    assert.equal(evalErr.code, "BAD_REQUEST")
    assert.match(evalErr.message, /evaluación/)

    const created = await call(a, "create_plan", { name: "Tasa", weeks: 1, routines: [routineInput("A", exerciseIds[1]!)], workouts: [{ week: 1, weekday: 7, routineKey: "A" }] })
    const args = { planId: created.planId, athleteIds: [fx.users.athleteA.id], startDate: today }
    // dryRun no cuenta para el límite de asignaciones
    await call(a, "schedule_plan", { ...args, dryRun: true })
    await call(a, "schedule_plan", { ...args, dryRun: true })
    await call(a, "schedule_plan", args)
    const limited = await callError(a, "schedule_plan", args)
    assert.equal(limited.code, "RATE_LIMITED")
    assert.ok(Number(limited.details?.retryAfterSeconds) > 0)

    // Rutina archivada después de crear el plan → no se puede programar
    const { db } = await import("@atleta/db/client")
    const { routine } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    await db.update(routine).set({ archivedAt: new Date() }).where(eq(routine.id, created.createdRoutines[0].routineId))
    const archived = await callError(await connect(fx.users.coachA), "schedule_plan", { ...args, dryRun: true })
    assert.equal(archived.code, "BAD_REQUEST")
    assert.match(archived.message, /archivada/)

    const readOnly = await connect(fx.users.coachA, { scopes: ["atleta:read"] })
    assert.deepEqual((await readOnly.listTools()).tools.map((t) => t.name).sort(), ["get_plan", "list_plans", "ping"])
    assert.equal(readOnly.getServerCapabilities()?.prompts, undefined)
  })

  it("flags: sin training_plans no hay herramientas ni prompt de planes; sin scheduled_sessions se rechaza", async () => {
    const noPlans: FixtureUser = await signUp(server.baseUrl, NO_PLANS_EMAIL, "Sin planes")
    const noScheduled: FixtureUser = await signUp(server.baseUrl, NO_SCHEDULED_EMAIL, "Sin programados")

    for (const u of [noPlans, noScheduled]) {
      const client = await connect(u)
      assert.deepEqual((await client.listTools()).tools.map((t) => t.name), ["ping"], u.email)
      assert.equal(client.getServerCapabilities()?.prompts, undefined, u.email)

      // El router también lo rechaza (training_plans sin scheduled_sessions queda inactivo)
      const caller = await callerFor(u)
      const team = await caller.teams.create({ name: `Equipo de ${u.name}` })
      await assert.rejects(caller.plans.list({ teamId: team.id }), isTrpc("FORBIDDEN"))
      await assert.rejects(caller.plans.create({ teamId: team.id, name: "x", weeks: 1, workouts: [] }), isTrpc("FORBIDDEN"))
    }

    // Con todos los flags sí aparece el prompt planificar_mesociclo
    const full = await connect(fx.users.coachA)
    const { prompts } = await full.listPrompts()
    assert.deepEqual(prompts.map((p) => p.name), ["planificar_mesociclo"])
    const prompt = await full.getPrompt({ name: "planificar_mesociclo", arguments: { objetivo: "Hipertrofia", semanas: "6", dias_por_semana: "4" } })
    const text = (prompt.messages[0]!.content as { text: string }).text
    assert.match(text, /Hipertrofia/)
    assert.match(text, /create_plan/)
    assert.match(text, /dryRun: true/)
  })
})
