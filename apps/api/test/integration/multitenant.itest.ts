// Aislamiento entre equipos por el conector MCP: un coach no lee ni modifica lo de otro equipo, un
// atleta no crea ni asigna, y no se pueden usar ejercicios privados ajenos.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { catalogExerciseIds, createFixtures, createPrivateTeamExercise, type Fixtures } from "./fixtures"
import { mcpClientFor, type McpTestClient } from "./mcp-inmemory"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

describe("MCP: multi-tenant", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let coachA: McpTestClient
  let coachB: McpTestClient
  let athlete: McpTestClient
  let ex: string
  let privateB: string
  let routineA: { routineId: string; updatedAt: string }
  let itemA: string
  let routineB: string
  let sessionB: string

  before(async () => {
    server = await startTestServer()
    fx = await createFixtures(server.baseUrl)
    ;[coachA, coachB, athlete] = await Promise.all([fx.users.coachA, fx.users.coachB, fx.users.athleteA].map((u) => mcpClientFor(u)))
    ;[ex] = (await catalogExerciseIds(1)) as [string]
    privateB = await createPrivateTeamExercise(fx.teams.b.id, fx.users.coachB.id, "Ejercicio secreto de B")

    routineA = await coachA.ok("create_routine", { name: "Rutina de A", content: { items: [{ type: "exercise", exerciseId: ex, sets: { count: 2, setType: "reps", targetReps: 8 } }] } })
    itemA = (await coachA.ok<{ items: { id: string }[] }>("get_routine", { routineId: routineA.routineId })).items[0]!.id
    routineB = (await coachB.ok<{ routineId: string }>("create_routine", { name: "Rutina de B", content: { items: [{ type: "exercise", exerciseId: privateB, sets: { count: 1, setType: "reps" } }] } })).routineId
    // B solo puede asignarse a sí mismo si entrena en su equipo
    await fx.callers.coachB.teams.toggleSelfTraining({ teamId: fx.teams.b.id, enabled: true })
    sessionB = (await coachB.ok<{ sessions: { sessionId: string }[] }>("assign_routine", { routineId: routineB, athleteIds: [fx.users.coachB.id] })).sessions[0]!.sessionId
  })

  after(async () => {
    await Promise.all([coachA, coachB, athlete].map((c) => c?.close()))
    await server?.close()
  })

  it("coach A no lee rutinas, catálogo ni asignados del equipo B", async () => {
    assert.equal((await coachA.fail("get_routine", { routineId: routineB })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("list_routines", { teamId: fx.teams.b.id })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("list_athletes", { teamId: fx.teams.b.id })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("list_assignments", { teamId: fx.teams.b.id })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("search_exercises", { teamId: fx.teams.b.id })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("fetch", { id: `routine:${routineB}` })).code, "FORBIDDEN")
    const s = await coachA.ok<{ results: { id: string }[] }>("search", { query: "rutina de" })
    assert.deepEqual(s.results.map((r) => r.id), [`routine:${routineA.routineId}`])
    const resource = await coachA.client.readResource({ uri: `atleta://rutinas/${routineB}` }).catch((e: Error) => e)
    assert.ok(resource instanceof Error && /FORBIDDEN/.test(resource.message))
  })

  it("coach A no modifica, archiva, duplica, asigna ni cancela lo de B", async () => {
    const itemB = (await coachB.ok<{ items: { id: string }[] }>("get_routine", { routineId: routineB })).items[0]!.id
    assert.equal((await coachA.fail("update_sets", { routineId: routineB, itemId: itemB, sets: [{ setType: "reps", targetReps: 1 }] })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("edit_routine", { routineId: routineB, ops: [{ op: "remove_item", itemId: itemB }] })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("update_routine", { routineId: routineB, expectedUpdatedAt: new Date().toISOString(), name: "Mía" })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("archive_routine", { routineId: routineB })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("duplicate_routine", { routineId: routineB })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("assign_routine", { routineId: routineB, athleteIds: [fx.users.athleteA.id] })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("cancel_assignment", { sessionId: sessionB })).code, "FORBIDDEN")
    assert.equal((await coachA.fail("create_routine", { teamId: fx.teams.b.id, name: "Intrusa" })).code, "FORBIDDEN")
    // Nada cambió en B
    const b = await coachB.ok<{ name: string; archived: boolean; items: unknown[] }>("get_routine", { routineId: routineB })
    assert.deepEqual([b.name, b.archived, b.items.length], ["Rutina de B", false, 1])
  })

  it("el atleta lee su equipo pero no crea, edita, asigna ni lista atletas", async () => {
    assert.equal((await athlete.ok<{ id: string }>("get_routine", { routineId: routineA.routineId })).id, routineA.routineId)
    const noTeam = await athlete.fail("create_routine", { name: "Del atleta" })
    assert.equal(noTeam.code, "FORBIDDEN")
    assert.equal((await athlete.fail("create_routine", { teamId: fx.teams.a.id, name: "Del atleta" })).code, "FORBIDDEN")
    assert.equal((await athlete.fail("update_sets", { routineId: routineA.routineId, itemId: itemA, sets: [{ setType: "reps", targetReps: 1 }] })).code, "FORBIDDEN")
    assert.equal((await athlete.fail("assign_routine", { routineId: routineA.routineId, athleteIds: [fx.users.athleteA.id] })).code, "FORBIDDEN")
    assert.equal((await athlete.fail("list_athletes")).code, "FORBIDDEN")
    assert.equal((await athlete.fail("create_exercise", { teamId: fx.teams.a.id, name: "Del atleta", description: "x", difficulty: "beginner", movementPatterns: ["core"] })).code, "FORBIDDEN")
  })

  it("coach A no asigna a atletas de otro equipo", async () => {
    const e = await coachA.fail("assign_routine", { routineId: routineA.routineId, athleteIds: [fx.users.athleteA.id, fx.users.coachB.id] })
    assert.equal(e.code, "BAD_REQUEST")
    assert.match(e.message, /no pertenecen/)
  })

  it("coach A no puede referenciar el ejercicio privado de B (BAD_REQUEST)", async () => {
    const item = { type: "exercise", exerciseId: privateB, sets: { count: 1, setType: "reps", targetReps: 5 } }
    assert.equal((await coachA.fail("create_routine", { name: "Con ajeno", content: { items: [item] } })).code, "BAD_REQUEST")
    assert.equal((await coachA.fail("add_exercise", { routineId: routineA.routineId, exerciseId: privateB, sets: [{ setType: "reps", targetReps: 5 }] })).code, "BAD_REQUEST")
    assert.equal((await coachA.fail("replace_exercise", { routineId: routineA.routineId, itemId: itemA, newExerciseId: privateB })).code, "BAD_REQUEST")
    assert.equal((await coachA.fail("edit_routine", { routineId: routineA.routineId, ops: [{ op: "add_exercise", exerciseId: privateB, sets: [{ setType: "reps" }] }] })).code, "BAD_REQUEST")
    const current = await coachA.ok<{ updatedAt: string; content: { items: Record<string, unknown>[] } }>("get_routine", { routineId: routineA.routineId, format: "detail" })
    const replaced = await coachA.fail("update_routine", { routineId: routineA.routineId, expectedUpdatedAt: current.updatedAt, content: { items: [...current.content.items, item] } })
    assert.equal(replaced.code, "BAD_REQUEST")
    // La rutina de A sigue igual
    assert.equal((await coachA.ok<{ updatedAt: string }>("get_routine", { routineId: routineA.routineId })).updatedAt, current.updatedAt)
  })

  it("el ejercicio privado de B no es visible para A (exercises.get FORBIDDEN, get_exercises/fetch no lo dan)", async () => {
    await assert.rejects(fx.callers.coachA.exercises.get({ id: privateB }), (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN")
    const r = await coachA.ok<{ exercises: unknown[]; notFound: string[] }>("get_exercises", { ids: [privateB] })
    assert.deepEqual([r.exercises.length, r.notFound], [0, [privateB]])
    assert.equal((await coachA.fail("fetch", { id: `exercise:${privateB}` })).code, "NOT_FOUND")
    const found = await coachA.ok<{ results: { id: string }[] }>("search_exercises", { query: "secreto" })
    assert.equal(found.results.length, 0)
    // B sí lo ve
    assert.equal((await coachB.ok<{ exercises: unknown[] }>("get_exercises", { ids: [privateB] })).exercises.length, 1)
  })
})
