// Herramientas MCP de rutinas y catálogo contra la API real (Postgres): ciclo completo de una
// rutina, concurrencia optimista, atomicidad de edit_routine, archivado y límites.

import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { catalogExerciseIds, createFixtures, type Fixtures } from "./fixtures"
import { mcpClientFor, type McpTestClient } from "./mcp-inmemory"
import { integrationSkip, startTestServer, type TestServer } from "./setup"

type Outline = {
  id: string
  updatedAt: string
  archived: boolean
  items: { position: number; type: "exercise" | "block"; id: string; exerciseId?: string; sets?: string; restSeconds?: number; exercises?: { id: string; exerciseId: string }[] }[]
}
type Detail = { updatedAt: string; content: { items: Record<string, unknown>[] }; exerciseNames: Record<string, string> }

describe("MCP: herramientas de rutinas", { skip: integrationSkip }, () => {
  let server: TestServer
  let fx: Fixtures
  let mcp: McpTestClient
  let ex: string[]

  before(async () => {
    server = await startTestServer()
    fx = await createFixtures(server.baseUrl)
    mcp = await mcpClientFor(fx.users.coachA)
    ex = await catalogExerciseIds(4)
  })

  after(async () => {
    await mcp?.close()
    await server?.close()
  })

  it("whoami y list_athletes del coach", async () => {
    const me = await mcp.ok<{ defaultTeamId: string; teams: { teamId: string; role: string }[]; features: string[] }>("whoami")
    assert.equal(me.defaultTeamId, fx.teams.a.id)
    assert.deepEqual(me.teams.map((t) => t.role), ["coach"])
    assert.ok(me.features.includes("mcp"))
    const list = await mcp.ok<{ athletes: { athleteId: string; name: string }[] }>("list_athletes")
    assert.deepEqual(list.athletes.map((a) => a.athleteId), [fx.users.athleteA.id])
    assert.equal(JSON.stringify(list).includes("@"), false, "sin correos")
  })

  it("ciclo: create → get → add_exercise → update_sets → edit_routine atómico → CONFLICT → archive → restore", async () => {
    // create_routine con contenido (atajo count + circuito)
    const created = await mcp.ok<{ routineId: string; updatedAt: string; itemCount: number }>("create_routine", {
      name: "Fuerza MCP",
      content: {
        items: [
          { type: "exercise", exerciseId: ex[0], sets: { count: 3, setType: "reps", targetReps: 5, loadType: "rpe", loadValue: 8 }, restSeconds: 120 },
          { type: "block", name: "Core", rounds: 3, exercises: [{ exerciseId: ex[1], sets: [{ setType: "time", targetDurationSeconds: 30 }] }] },
        ],
      },
    })
    assert.equal(created.itemCount, 2)
    const routineId = created.routineId

    // get_routine (outline y detail)
    const outline = await mcp.ok<Outline>("get_routine", { routineId })
    assert.equal(outline.updatedAt, created.updatedAt)
    assert.equal(outline.items[0]!.sets, "3 × 5 reps @ RPE 8")
    assert.equal(outline.items[1]!.type, "block")
    const detail = await mcp.ok<Detail>("get_routine", { routineId, format: "detail" })
    assert.equal(detail.content.items.length, 2)
    assert.ok(detail.exerciseNames[ex[0]!])

    // add_exercise (ejercicio nuevo del catálogo, visible)
    const added = await mcp.ok<{ updatedAt: string; saved: boolean; changes: { type: string; itemId: string }[] }>("add_exercise", {
      routineId, exerciseId: ex[2], sets: [{ setType: "reps", targetReps: 12 }], position: 1,
    })
    assert.equal(added.saved, true)
    assert.notEqual(added.updatedAt, created.updatedAt)
    const newItemId = added.changes[0]!.itemId

    // update_sets con la versión que devolvió la escritura anterior
    const updated = await mcp.ok<{ updatedAt: string }>("update_sets", {
      routineId, expectedUpdatedAt: added.updatedAt, itemId: newItemId, sets: [{ setType: "reps", targetReps: 10, loadType: "fixed_kg", loadValue: 20 }],
    })
    const afterSets = await mcp.ok<Outline>("get_routine", { routineId })
    assert.equal(afterSets.updatedAt, updated.updatedAt)
    assert.equal(afterSets.items.find((i) => i.id === newItemId)!.sets, "1 × 10 reps @ 20 kg")

    // edit_routine atómico: la 2.ª operación falla → no cambia nada
    const firstItemId = afterSets.items[0]!.id
    const err = await mcp.fail("edit_routine", {
      routineId,
      ops: [
        { op: "update_item_fields", itemId: firstItemId, restSeconds: 45 },
        { op: "remove_item", itemId: crypto.randomUUID() },
      ],
    })
    assert.equal(err.code, "BAD_REQUEST")
    assert.deepEqual(err.details, { opIndex: 1 })
    const unchanged = await mcp.ok<Outline>("get_routine", { routineId })
    assert.equal(unchanged.updatedAt, updated.updatedAt)
    assert.equal(unchanged.items[0]!.restSeconds, 120)

    // edit_routine que sí aplica (dos operaciones juntas)
    const edited = await mcp.ok<{ updatedAt: string; changes: unknown[] }>("edit_routine", {
      routineId,
      ops: [
        { op: "update_item_fields", itemId: firstItemId, restSeconds: 45 },
        { op: "move_item", itemId: newItemId, toPosition: 0 },
      ],
    })
    assert.equal(edited.changes.length, 2)

    // update_routine con updatedAt viejo → CONFLICT con el updatedAt vigente
    const conflict = await mcp.fail("update_routine", { routineId, expectedUpdatedAt: created.updatedAt, name: "Renombrada" })
    assert.equal(conflict.code, "CONFLICT")
    assert.equal(conflict.details?.updatedAt, edited.updatedAt)
    const conflictContent = await mcp.fail("update_routine", { routineId, expectedUpdatedAt: updated.updatedAt, content: detail.content })
    assert.equal(conflictContent.code, "CONFLICT")
    // Las habilidades también comprueban la versión
    assert.equal((await mcp.fail("remove_item", { routineId, itemId: newItemId, expectedUpdatedAt: created.updatedAt })).code, "CONFLICT")

    // update_routine con la versión correcta: renombra y reemplaza en una escritura, conservando ids
    const current = await mcp.ok<Detail>("get_routine", { routineId, format: "detail" })
    const replaced = await mcp.ok<{ name: string; updatedAt: string; itemCount: number }>("update_routine", {
      routineId, expectedUpdatedAt: current.updatedAt, name: "Fuerza MCP v2", content: { items: current.content.items.slice(0, 2) },
    })
    assert.equal(replaced.name, "Fuerza MCP v2")
    assert.equal(replaced.itemCount, 2)
    const v2 = await mcp.ok<Outline>("get_routine", { routineId })
    assert.deepEqual(v2.items.map((i) => i.id), current.content.items.slice(0, 2).map((i) => i.id))

    // archive_routine: sale de la lista y no se puede asignar
    const archived = await mcp.ok<{ archived: boolean }>("archive_routine", { routineId })
    assert.equal(archived.archived, true)
    const listed = await mcp.ok<{ routines: { id: string }[] }>("list_routines")
    assert.equal(listed.routines.some((r) => r.id === routineId), false)
    const withArchived = await mcp.ok<{ routines: { id: string; archived: boolean }[] }>("list_routines", { includeArchived: true })
    assert.equal(withArchived.routines.find((r) => r.id === routineId)?.archived, true)
    const assignErr = await mcp.fail("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id] })
    assert.equal(assignErr.code, "BAD_REQUEST")
    assert.match(assignErr.message, /archivada/)

    // restaurar
    await mcp.ok("archive_routine", { routineId, archived: false })
    const relisted = await mcp.ok<{ routines: { id: string; archived: boolean }[] }>("list_routines", { query: "fuerza mcp" })
    assert.deepEqual(relisted.routines.map((r) => [r.id, r.archived]), [[routineId, false]])
    const assigned = await mcp.ok<{ sessions: unknown[] }>("assign_routine", { routineId, athleteIds: [fx.users.athleteA.id] })
    assert.equal(assigned.sessions.length, 1)
  })

  it("compuestas: adjust_difficulty sube la intensidad y guarda; sin margen no escribe", async () => {
    const { routineId } = await mcp.ok<{ routineId: string }>("create_routine", {
      name: "Dificultad",
      content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 3, setType: "reps", targetReps: 8, loadType: "rpe", loadValue: 7 } }] },
    })
    const up = await mcp.ok<{ saved: boolean; message: string }>("adjust_difficulty", { routineId, direction: "up", knob: "intensity" })
    assert.equal(up.saved, true)
    assert.match(up.message, /intensidad/)
    assert.equal((await mcp.ok<Outline>("get_routine", { routineId })).items[0]!.sets, "3 × 8 reps @ RPE 8")

    const before = await mcp.ok<Outline>("get_routine", { routineId })
    const rest = await mcp.ok<{ saved: boolean; updatedAt: string }>("adjust_rest", { routineId, direction: "up" }) // sin descansos que mover
    assert.equal(rest.saved, false)
    assert.equal(rest.updatedAt, before.updatedAt)
  })

  it("concurrencia: dos escrituras con la misma versión → una gana y la otra CONFLICT (FOR UPDATE)", async () => {
    const { routineId, updatedAt } = await mcp.ok<{ routineId: string; updatedAt: string }>("create_routine", {
      name: "Carrera", content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 2, setType: "reps", targetReps: 5 } }] },
    })
    const { items } = await mcp.ok<Outline>("get_routine", { routineId })
    const results = await Promise.all([30, 60].map((s) => mcp.call("update_item_fields", { routineId, expectedUpdatedAt: updatedAt, itemId: items[0]!.id, restSeconds: s })))
    assert.deepEqual(results.map((r) => !!r.isError).sort(), [false, true])
    const loser = results.find((r) => r.isError)!
    assert.equal((loser.structuredContent as { error: { code: string } }).error.code, "CONFLICT")

    // Directo al router (sin lectura previa): solo la fila bloqueada decide quién gana
    const fresh = await fx.callers.coachA.routines.get({ id: routineId })
    const race = await Promise.allSettled([1, 2].map((n) =>
      fx.callers.coachA.routines.updateContent({ id: routineId, expectedUpdatedAt: fresh.updatedAt.toISOString(), content: { ...fresh.content, items: fresh.content.items.slice(0, n) } }),
    ))
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1)
    const rejected = race.find((r) => r.status === "rejected") as PromiseRejectedResult
    assert.equal((rejected.reason as { code?: string }).code, "CONFLICT", String(rejected.reason))
  })

  it("regresión web: routines.updateContent sin expectedUpdatedAt sigue funcionando", async () => {
    const r = await fx.callers.coachA.routines.create({ teamId: fx.teams.a.id, name: "Web" })
    const updated = await fx.callers.coachA.routines.updateContent({
      id: r!.id,
      content: { v: 1, items: [{ type: "exercise", id: crypto.randomUUID(), exerciseId: ex[0]!, order: 0, sets: [{ setNumber: 1, setType: "reps", targetReps: 5 }] }] },
    })
    assert.equal(updated.content.items.length, 1)
    // la web sigue viendo todas las sesiones de list sin filtros
    assert.ok(Array.isArray(await fx.callers.coachA.sessions.list({ teamId: fx.teams.a.id })))
  })

  it("catálogo: search_exercises, create_exercise (idempotente por nombre) y get_exercises", async () => {
    const found = await mcp.ok<{ results: { id: string; name: string }[] }>("search_exercises", { query: "a" })
    assert.ok(found.results.length > 0 && found.results.length <= 12)

    const created = await mcp.ok<{ id: string; existed: boolean }>("create_exercise", {
      name: "Plancha MCP con toalla", description: "Plancha frontal sobre una toalla.", difficulty: "beginner", movementPatterns: ["core"],
    })
    assert.equal(created.existed, false)
    const again = await mcp.ok<{ id: string; existed: boolean }>("create_exercise", {
      name: "plancha mcp con toalla", description: "x", difficulty: "beginner", movementPatterns: ["core"],
    })
    assert.deepEqual(again, { ...again, id: created.id, existed: true })

    const avoided = await mcp.ok<{ results: { id: string }[] }>("search_exercises", { query: "plancha mcp", avoid: ["toalla"] })
    assert.equal(avoided.results.some((r) => r.id === created.id), false)
    const details = await mcp.ok<{ exercises: { id: string; patterns: string[] }[]; notFound: string[] }>("get_exercises", { ids: [created.id, crypto.randomUUID()] })
    assert.deepEqual(details.exercises.map((e) => [e.id, e.patterns]), [[created.id, ["core"]]])
    assert.equal(details.notFound.length, 1)

    // search/fetch (compatibilidad con ChatGPT)
    const s = await mcp.ok<{ results: { id: string; url: string }[] }>("search", { query: "plancha mcp" })
    assert.ok(s.results.some((r) => r.id === `exercise:${created.id}`))
    const doc = await mcp.ok<{ title: string; text: string }>("fetch", { id: `exercise:${created.id}` })
    assert.equal(doc.title, "Plancha MCP con toalla")
    const routines = await mcp.ok<{ results: { id: string }[] }>("search", { query: "dificultad" })
    const routineDoc = await mcp.ok<{ text: string; metadata: { type: string } }>("fetch", { id: routines.results[0]!.id })
    assert.equal(routineDoc.metadata.type, "routine")
    assert.match(routineDoc.text, /RPE/)
  })

  it("find_alternatives: candidatos equivalentes sin modificar la rutina; ítem inexistente → BAD_REQUEST", async () => {
    const created = await mcp.ok<{ routineId: string; updatedAt: string }>("create_routine", {
      name: "Alternativas MCP",
      content: { items: [{ type: "exercise", exerciseId: ex[0], sets: { count: 3, setType: "reps", targetReps: 8 } }] },
    })
    const outline = await mcp.ok<Outline>("get_routine", { routineId: created.routineId })
    const itemId = outline.items[0]!.id
    const alt = await mcp.ok<{ itemId: string; candidates: { id: string; name: string }[] }>("find_alternatives", { routineId: created.routineId, itemId })
    assert.equal(alt.itemId, itemId)
    assert.ok(alt.candidates.length <= 8)
    assert.equal(alt.candidates.some((c) => c.id === ex[0]), false, "no sugiere el mismo ejercicio")
    const unchanged = await mcp.ok<Outline>("get_routine", { routineId: created.routineId })
    assert.equal(unchanged.updatedAt, created.updatedAt, "no escribe")
    if (alt.candidates[0]) {
      const replaced = await mcp.ok<{ saved: boolean }>("replace_exercise", { routineId: created.routineId, itemId, newExerciseId: alt.candidates[0].id })
      assert.equal(replaced.saved, true)
    }
    assert.equal((await mcp.fail("find_alternatives", { routineId: created.routineId, itemId: crypto.randomUUID() })).code, "BAD_REQUEST")
  })

  it("límites: 21 elementos → INVALID_INPUT; tasa de escrituras y de create_exercise → RATE_LIMITED", async () => {
    const tooBig = await mcp.fail("create_routine", {
      name: "Enorme",
      content: { items: Array.from({ length: 21 }, () => ({ type: "exercise", exerciseId: ex[0], sets: { count: 1, setType: "reps", targetReps: 5 } })) },
    })
    assert.equal(tooBig.code, "INVALID_INPUT")
    assert.match(tooBig.message, /items/)

    const { createRateLimiter } = await import("../../src/lib/rate-limit")
    const limited = await mcpClientFor(fx.users.coachA, {
      limiters: { write: createRateLimiter({ max: 2, windowMs: 60_000 }), exerciseCreate: createRateLimiter({ max: 1, windowMs: 3_600_000 }) },
    })
    try {
      await limited.ok("create_routine", { name: "Tasa 1" })
      await limited.ok("create_exercise", { name: "Ejercicio de tasa 1", description: "x", difficulty: "beginner", movementPatterns: ["core"] })
      const writes = await limited.fail("create_routine", { name: "Tasa 3" })
      assert.equal(writes.code, "RATE_LIMITED")
      assert.ok(Number(writes.details?.retryAfterSeconds) > 0)
      // las lecturas no cuentan
      await limited.ok("list_routines")
    } finally {
      await limited.close()
    }

    const exLimited = await mcpClientFor(fx.users.coachA, { limiters: { exerciseCreate: createRateLimiter({ max: 1, windowMs: 3_600_000 }) } })
    try {
      await exLimited.ok("create_exercise", { name: "Ejercicio de tasa 2", description: "x", difficulty: "beginner", movementPatterns: ["core"] })
      const e = await exLimited.fail("create_exercise", { name: "Ejercicio de tasa 3", description: "x", difficulty: "beginner", movementPatterns: ["core"] })
      assert.equal(e.code, "RATE_LIMITED")
    } finally {
      await exLimited.close()
    }
  })

  it("token de solo lectura: lee pero no ve ni ejecuta escrituras", async () => {
    const ro = await mcpClientFor(fx.users.coachA, { scopes: ["atleta:read"] })
    try {
      const names = (await ro.client.listTools()).tools.map((t) => t.name)
      assert.ok(names.includes("get_routine") && !names.includes("create_routine"))
      assert.equal((await ro.fail("create_routine", { name: "No" })).code, "INSUFFICIENT_SCOPE")
    } finally {
      await ro.close()
    }
  })
})
