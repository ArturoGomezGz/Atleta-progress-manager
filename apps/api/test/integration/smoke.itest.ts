// Humo del Paquete A: migraciones en limpio, servidor real, login por el proxy de auth y
// regresiones de seguridad/asignación que cubren los servicios compartidos.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import type { RoutineContent } from "@atleta/db/schema"
import {
  cookieHeader,
  createFixtures,
  createPrivateTeamExercise,
  FIXTURE_EMAILS,
  signIn,
  catalogExerciseIds,
  type Fixtures,
} from "./fixtures"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

const isTrpc = (code: TRPCError["code"]) => (err: unknown) => err instanceof TRPCError && err.code === code

function contentWith(exerciseIds: string[]): RoutineContent {
  return {
    v: 1,
    items: exerciseIds.map((exerciseId, order) => ({
      type: "exercise" as const,
      id: crypto.randomUUID(),
      exerciseId,
      order,
      sets: [
        { setNumber: 1, setType: "reps" as const, targetReps: 10 },
        { setNumber: 2, setType: "reps" as const, targetReps: 8, loadType: "percent_rm" as const, loadValue: 70 },
      ],
    })),
  }
}

describe("smoke: API + Postgres", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures

  before(async () => {
    server = await startTestServer()
    fx = await createFixtures(server.baseUrl)
  })

  after(async () => {
    await server?.close()
  })

  it("aplica todas las migraciones en limpio (tablas nuevas presentes)", async () => {
    const { db } = await import("@atleta/db/client")
    const { sql } = await import("drizzle-orm")
    const rows = (await db.execute(sql`
      select table_name from information_schema.tables where table_schema = 'public'
        and table_name in ('oauth_client','oauth_access_token','oauth_refresh_token','oauth_consent','mcp_personal_token',
                           'training_plan','training_plan_week','training_plan_workout','training_plan_assignment')
    `)) as unknown as { table_name: string }[]
    assert.equal(rows.length, 9)
    const cols = (await db.execute(sql`
      select column_name from information_schema.columns
       where (table_name = 'routine' and column_name = 'archived_at')
          or (table_name = 'training_session' and column_name in ('plan_assignment_id','plan_workout_id'))
    `)) as unknown as { column_name: string }[]
    assert.equal(cols.length, 3)
  })

  it("login JSON por el proxy /api/auth/* y sesión válida en tRPC por HTTP", async () => {
    const res = await signIn(server.baseUrl, FIXTURE_EMAILS.coachA)
    assert.equal(res.status, 200)
    const cookie = cookieHeader(res)
    assert.match(cookie, /session_token=/)

    const trpc = await fetch(`${server.baseUrl}/trpc/teams.list`, { headers: { cookie } })
    assert.equal(trpc.status, 200)
    const body = (await trpc.json()) as { result: { data: { team: { name: string } }[] } }
    assert.deepEqual(body.result.data.map((t) => t.team.name), ["Equipo A"])

    const bad = await signIn(server.baseUrl, FIXTURE_EMAILS.coachA, "incorrecta-123")
    assert.equal(bad.status, 401)
  })

  it("el proxy acepta form-urlencoded (no 415) y bloquea las rutas de la denylist", async () => {
    const form = await fetch(`${server.baseUrl}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: server.baseUrl },
      body: new URLSearchParams({ grant_type: "authorization_code", code: "x" }).toString(),
    })
    assert.notEqual(form.status, 415)

    for (const path of ["/api/auth/admin/list-users", "/api/auth/oauth2/create-client", "/api/auth//oauth2/get-clients", "/api/auth/oauth2/client/rotate-secret", "/api/auth/oauth2%2Fdelete-client"]) {
      const res = await fetch(`${server.baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      assert.equal(res.status, 404, path)
      assert.deepEqual(await res.json(), { error: "Not Found" }, path)
    }
  })

  it("sessions.create sin regresión: snapshot de ejercicios, objetivos y atletas", async () => {
    const { db } = await import("@atleta/db/client")
    const { athleteSession, sessionExercise, sessionSetTarget } = await import("@atleta/db/schema")
    const { eq, inArray } = await import("drizzle-orm")
    const ids = await catalogExerciseIds(2)
    const caller = fx.callers.coachA
    const r = await caller.routines.create({ teamId: fx.teams.a.id, name: "Fuerza A" })
    await caller.routines.updateContent({ id: r.id, content: contentWith(ids) })

    const session = await caller.sessions.create({ routineId: r.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id] })
    assert.equal(session.status, "active")
    assert.equal(session.scheduledDate, null)
    assert.equal(session.planAssignmentId, null)

    const exercises = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, session.id))
    assert.deepEqual(exercises.map((e) => [e.order, e.exerciseId]).sort(), [[0, ids[0]], [1, ids[1]]])
    const targets = await db.select().from(sessionSetTarget).where(inArray(sessionSetTarget.sessionExerciseId, exercises.map((e) => e.id)))
    assert.equal(targets.length, 4)
    assert.equal(targets.filter((t) => t.targetPercent === "70.00").length, 2)
    const athletes = await db.select().from(athleteSession).where(eq(athleteSession.sessionId, session.id))
    assert.deepEqual(athletes.map((a) => [a.athleteId, a.status]), [[fx.users.athleteA.id, "scheduled"]])

    // El atleta lo ve como pendiente
    const pending = await fx.callers.athleteA.sessions.myPending()
    assert.ok(pending.some((p) => p.id === session.id))

    // Fecha futura → programada
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    const scheduled = await caller.sessions.create({ routineId: r.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id], scheduledDate: future })
    assert.equal(scheduled.status, "scheduled")
  })

  it("sessions.create/createMany validan atletas, equipo de la rutina y fechas", async () => {
    const caller = fx.callers.coachA
    const ids = await catalogExerciseIds(1)
    const r = await caller.routines.create({ teamId: fx.teams.a.id, name: "Varias fechas" })
    await caller.routines.updateContent({ id: r.id, content: contentWith(ids) })

    // Atleta de otro equipo
    await assert.rejects(
      caller.sessions.create({ routineId: r.id, teamId: fx.teams.a.id, athleteIds: [fx.users.coachB.id] }),
      isTrpc("BAD_REQUEST"),
    )
    // Rutina de B asignada desde el equipo A
    const rb = await fx.callers.coachB.routines.create({ teamId: fx.teams.b.id, name: "Rutina B" })
    await assert.rejects(
      caller.sessions.create({ routineId: rb.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id] }),
      isTrpc("NOT_FOUND"),
    )

    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
    const sessions = await caller.sessions.createMany({
      routineId: r.id,
      teamId: fx.teams.a.id,
      athleteIds: [fx.users.athleteA.id],
      dates: [day(7), day(0), day(14)],
    })
    assert.deepEqual(sessions.map((s) => s.scheduledDate), [day(0), day(7), day(14)])
    assert.deepEqual(sessions.map((s) => s.status), ["active", "scheduled", "scheduled"])

    await assert.rejects(
      caller.sessions.createMany({ routineId: r.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id], dates: [day(1), day(1)] }),
      isTrpc("BAD_REQUEST"),
    )
    // El atleta no puede asignar
    await assert.rejects(
      fx.callers.athleteA.sessions.createMany({ routineId: r.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id], dates: [day(1)] }),
      isTrpc("FORBIDDEN"),
    )
  })

  it("rutinas archivadas no se pueden asignar", async () => {
    const { db } = await import("@atleta/db/client")
    const { routine } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    const caller = fx.callers.coachA
    const r = await caller.routines.create({ teamId: fx.teams.a.id, name: "Archivada" })
    await db.update(routine).set({ archivedAt: new Date() }).where(eq(routine.id, r.id))
    await assert.rejects(
      caller.sessions.create({ routineId: r.id, teamId: fx.teams.a.id, athleteIds: [fx.users.athleteA.id] }),
      isTrpc("BAD_REQUEST"),
    )
  })

  it("exercises.get: un ejercicio privado de otro equipo → FORBIDDEN (regresión)", async () => {
    const privateB = await createPrivateTeamExercise(fx.teams.b.id, fx.users.coachB.id, "Secreto de B")
    await assert.rejects(fx.callers.coachA.exercises.get({ id: privateB }), isTrpc("FORBIDDEN"))
    await assert.rejects(fx.callers.noMcp.exercises.get({ id: privateB }), isTrpc("FORBIDDEN"))
    // El dueño y los ejercicios públicos del catálogo sí
    assert.equal((await fx.callers.coachB.exercises.get({ id: privateB })).name, "Secreto de B")
    const [system] = await catalogExerciseIds(1)
    assert.equal((await fx.callers.coachA.exercises.get({ id: system! })).id, system)
  })

  it("routines.updateContent rechaza ejercicios privados de otro equipo, pero conserva los ya presentes", async () => {
    const { db } = await import("@atleta/db/client")
    const { routine } = await import("@atleta/db/schema")
    const { eq } = await import("drizzle-orm")
    const privateB = await createPrivateTeamExercise(fx.teams.b.id, fx.users.coachB.id, "Otro secreto de B")
    const privateA = await createPrivateTeamExercise(fx.teams.a.id, fx.users.coachA.id, "Propio de A")
    const [system] = await catalogExerciseIds(1)
    const caller = fx.callers.coachA
    const r = await caller.routines.create({ teamId: fx.teams.a.id, name: "Visibilidad" })

    await assert.rejects(caller.routines.updateContent({ id: r.id, content: contentWith([system!, privateB]) }), isTrpc("BAD_REQUEST"))
    await caller.routines.updateContent({ id: r.id, content: contentWith([system!, privateA]) })

    // Un id que ya estaba en la rutina no se revalida (p. ej. un ejercicio borrado después)
    await db.update(routine).set({ content: contentWith([privateB]) }).where(eq(routine.id, r.id))
    await caller.routines.updateContent({ id: r.id, content: contentWith([privateB, system!]) })
  })
})
