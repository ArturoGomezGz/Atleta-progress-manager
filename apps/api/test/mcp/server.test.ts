// Servidor MCP completo en memoria (InMemoryTransport) con un caller tRPC falso: registro por scope y
// flag, formato de errores y herramientas de edición sin base de datos.

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { RoutineContent } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import type { FastifyBaseLogger } from "fastify"
import { FEATURES, type FeatureKey } from "../../src/lib/features"
import { createRateLimiter } from "../../src/lib/rate-limit"
import { ErrorDetails, ROUTINE_CONFLICT_HINT } from "../../src/mcp/errors"
import { createMcpServer, MCP_INSTRUCTIONS } from "../../src/mcp/server"
import type { AppCaller, McpScope, McpToolContext } from "../../src/mcp/types"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const TEAM = id(1)
const ROUTINE = id(9)
const PLAN = id(20)
const SQUAT = id(101)
const ITEM = id(11)
const ITEM2 = id(12)
const UPDATED = new Date("2026-10-01T10:00:00.000Z")

const silentLog = (() => {
  const noop = () => {}
  const log = { info: noop, warn: noop, error: noop, debug: noop, child: () => log }
  return log as unknown as FastifyBaseLogger
})()

const routineContent = (): RoutineContent => ({
  v: 1,
  items: [
    { type: "exercise", id: ITEM, exerciseId: SQUAT, order: 0, restSeconds: 90, sets: [{ setNumber: 1, setType: "reps", targetReps: 5, loadType: "rpe", loadValue: 7 }] },
    { type: "exercise", id: ITEM2, exerciseId: SQUAT, order: 1, sets: [{ setNumber: 1, setType: "reps", targetReps: 10 }] },
  ],
})

type Call = { path: string; input: unknown }

/** Caller falso: registra las llamadas y responde con una rutina fija en memoria. */
function fakeCaller(calls: Call[], overrides: Record<string, (input: never) => unknown> = {}): AppCaller {
  const routine = { id: ROUTINE, teamId: TEAM, name: "Fuerza", category: "training", createdBy: "u1", createdAt: UPDATED, updatedAt: UPDATED, archivedAt: null, content: routineContent(), exerciseNames: { [SQUAT]: "Sentadilla" }, exerciseInfo: {} }
  const impl: Record<string, (input: never) => unknown> = {
    "teams.list": () => [{ team: { id: TEAM, name: "Equipo" }, role: "coach", selfAthlete: false }],
    "routines.get": () => structuredClone(routine),
    "routines.updateContent": (input: { content: RoutineContent }) => ({ ...routine, content: input.content, updatedAt: new Date("2026-10-02T00:00:00.000Z") }),
    "routines.create": (input: { name: string; content?: RoutineContent }) => ({ ...routine, name: input.name, content: input.content ?? { v: 1, items: [] } }),
    ...overrides,
  }
  const proxy = (path: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_t, key: string) => proxy([...path, key]),
      apply: async (_t, _this, args: unknown[]) => {
        const p = path.join(".")
        calls.push({ path: p, input: args[0] })
        const fn = impl[p]
        if (!fn) throw new Error(`caller falso sin ${p}`)
        return fn(args[0] as never)
      },
    })
  return proxy([]) as AppCaller
}

function makeCtx(opts: { scopes?: McpScope[]; features?: FeatureKey[]; calls?: Call[]; overrides?: Record<string, (input: never) => unknown> } = {}): McpToolContext {
  const big = () => createRateLimiter({ max: 1000, windowMs: 60_000 })
  return {
    principal: {
      kind: "pat",
      user: { id: "u1", email: "c@x.com", name: "Coach", emailVerified: true, image: null, createdAt: new Date(0), updatedAt: new Date(0) },
      scopes: new Set(opts.scopes ?? ["atleta:read", "atleta:write"]),
      tokenId: "tok-1",
    },
    caller: fakeCaller(opts.calls ?? [], opts.overrides),
    features: new Set(opts.features ?? ["mcp"]),
    log: silentLog,
    now: () => new Date("2026-10-05T12:00:00Z"),
    limiters: { write: big(), exerciseCreate: big(), schedule: big() },
    requestId: "req-1",
  }
}

async function connect(ctx: McpToolContext) {
  const server = createMcpServer(ctx)
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: "test", version: "0.0.0" })
  await client.connect(clientT)
  return client
}

type ToolResult = Awaited<ReturnType<Client["callTool"]>>
const errorOf = (r: ToolResult) => (r.structuredContent as { error: { code: string; message: string; details?: Record<string, unknown> } }).error
const data = <T = Record<string, unknown>>(r: ToolResult) => r.structuredContent as T

const READ_TOOLS = ["whoami", "list_athletes", "search_exercises", "get_exercises", "list_routines", "get_routine", "list_assignments", "search", "fetch"]
const WRITE_TOOLS = [
  "create_exercise", "create_routine", "update_routine", "edit_routine", "duplicate_routine", "archive_routine",
  "replace_exercise", "add_exercise", "remove_item", "move_item", "update_sets", "update_item_fields", "update_block", "adjust_difficulty", "adjust_rest",
  "assign_routine", "cancel_assignment",
]
// Solo con el flag training_plans
const PLAN_READ_TOOLS = ["list_plans", "get_plan"]
const PLAN_WRITE_TOOLS = ["create_plan", "update_plan", "duplicate_plan", "schedule_plan", "cancel_plan_assignment"]

const planView = () => ({
  planId: PLAN, teamId: TEAM, name: "Mesociclo de fuerza", description: null, goal: "Fuerza máxima", weeks: 2, status: "draft",
  createdAt: UPDATED.toISOString(), updatedAt: UPDATED.toISOString(),
  schedule: [
    { week: 1, name: "Acumulación", focus: null, notes: null, days: [{ weekday: 1, workouts: [{ workoutId: id(21), position: 0, routineId: ROUTINE, routineName: "Fuerza", notes: null }] }] },
    { week: 2, name: null, focus: null, notes: null, days: [] },
  ],
  assignments: [],
})

describe("createMcpServer", () => {
  it("publica instructions en español", async () => {
    const client = await connect(makeCtx())
    assert.equal(client.getInstructions(), MCP_INSTRUCTIONS)
    assert.match(MCP_INSTRUCTIONS, /Confirma con el usuario antes de guardar, asignar/)
  })

  it("con todos los scopes registra todas las herramientas, con nombres únicos", async () => {
    const { tools } = await (await connect(makeCtx())).listTools()
    const names = tools.map((t) => t.name)
    assert.equal(new Set(names).size, names.length)
    assert.deepEqual([...names].sort(), [...READ_TOOLS, ...WRITE_TOOLS].sort())
    for (const t of tools) {
      assert.equal(t.annotations?.readOnlyHint, READ_TOOLS.includes(t.name), `${t.name}: readOnlyHint`)
      assert.equal(t.annotations?.openWorldHint, false)
      assert.ok(t.description && t.description.length > 20, `${t.name}: descripción`)
    }
    assert.equal(tools.find((t) => t.name === "archive_routine")!.annotations?.destructiveHint, true)
    assert.equal(tools.find((t) => t.name === "cancel_assignment")!.annotations?.destructiveHint, true)
  })

  it("un principal de solo lectura no ve herramientas W y llamarlas da INSUFFICIENT_SCOPE", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ scopes: ["atleta:read"], calls }))
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    assert.deepEqual(names, [...READ_TOOLS].sort())
    for (const name of ["create_routine", "update_sets", "assign_routine"]) {
      const r = await client.callTool({ name, arguments: {} })
      assert.equal(r.isError, true)
      assert.equal(errorOf(r).code, "INSUFFICIENT_SCOPE")
    }
    assert.equal(calls.length, 0)
    // Una herramienta que no existe sigue siendo "not found" del SDK
    const unknown = await client.callTool({ name: "no_existe", arguments: {} })
    assert.equal(unknown.isError, true)
    assert.match((unknown.content as { text: string }[])[0]!.text, /not found/)
    // Sin escritura tampoco se ofrecen los prompts que escriben
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name)
    assert.deepEqual(prompts, ["revisar_adherencia"])
  })

  it("sin el flag evaluation la categoría solo admite training", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ calls }))
    const create = (await client.listTools()).tools.find((t) => t.name === "create_routine")!
    const category = (create.inputSchema.properties as Record<string, { enum?: string[] }>).category!
    assert.deepEqual(category.enum, ["training"])
    const r = await client.callTool({ name: "create_routine", arguments: { name: "Eval", category: "evaluation" } })
    assert.equal(errorOf(r).code, "INVALID_INPUT")
    assert.equal(calls.some((c) => c.path === "routines.create"), false)

    const withEval = await connect(makeCtx({ features: ["mcp", "evaluation"] }))
    const create2 = (await withEval.listTools()).tools.find((t) => t.name === "create_routine")!
    assert.deepEqual((create2.inputSchema.properties as Record<string, { enum?: string[] }>).category!.enum, ["training", "evaluation"])
  })

  it("los errores vuelven con isError, código y mensaje en español", async () => {
    const client = await connect(makeCtx({
      overrides: {
        "routines.get": () => { throw new TRPCError({ code: "NOT_FOUND" }) },
        "routines.rename": () => { throw new TRPCError({ code: "CONFLICT", message: "La rutina cambió desde que la leíste.", cause: new ErrorDetails({ updatedAt: UPDATED.toISOString() }, { hint: ROUTINE_CONFLICT_HINT }) }) },
      },
    }))
    const nf = await client.callTool({ name: "get_routine", arguments: { routineId: ROUTINE } })
    assert.equal(nf.isError, true)
    assert.equal(errorOf(nf).code, "NOT_FOUND")
    assert.match((nf.content as { text: string }[])[0]!.text, /^NOT_FOUND: /)

    const conflict = await client.callTool({ name: "update_routine", arguments: { routineId: ROUTINE, expectedUpdatedAt: "2026-09-01T00:00:00Z", name: "Otro" } })
    assert.equal(errorOf(conflict).code, "CONFLICT")
    assert.match(errorOf(conflict).message, /get_routine/)
    assert.deepEqual(errorOf(conflict).details, { updatedAt: UPDATED.toISOString() })

    const empty = await client.callTool({ name: "update_routine", arguments: { routineId: ROUTINE, expectedUpdatedAt: UPDATED.toISOString() } })
    assert.equal(errorOf(empty).code, "INVALID_INPUT")

    const bad = await client.callTool({ name: "get_routine", arguments: { routineId: "no-uuid" } })
    assert.equal(errorOf(bad).code, "INVALID_INPUT")
  })

  it("create_routine normaliza el contenido amigable (atajo count) antes de llamar a routines.create", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ calls }))
    const r = await client.callTool({
      name: "create_routine",
      arguments: { name: "Nueva", content: { items: [{ type: "exercise", exerciseId: SQUAT, sets: { count: 3, setType: "reps", targetReps: 8 } }] } },
    })
    assert.equal(r.isError, undefined)
    const create = calls.find((c) => c.path === "routines.create")!.input as { teamId: string; category: string; content: RoutineContent }
    assert.equal(create.teamId, TEAM) // equipo implícito: el único donde es coach
    assert.equal(create.category, "training")
    const item = create.content.items[0]!
    assert.equal(item.type === "exercise" && item.sets.length, 3)
    assert.equal(data(r).itemCount, 1)

    const tooMany = await client.callTool({
      name: "create_routine",
      arguments: { name: "Grande", content: { items: Array.from({ length: 21 }, () => ({ type: "exercise", exerciseId: SQUAT, sets: { count: 1, setType: "reps" } })) } },
    })
    assert.equal(errorOf(tooMany).code, "INVALID_INPUT")
  })

  it("las herramientas de habilidad editan y guardan con la versión leída", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ calls }))
    const r = await client.callTool({ name: "update_sets", arguments: { routineId: ROUTINE, itemId: ITEM, sets: [{ setType: "reps", targetReps: 3, loadType: "percent_rm", loadValue: 85 }] } })
    assert.equal(r.isError, undefined, JSON.stringify(r.content))
    const save = calls.find((c) => c.path === "routines.updateContent")!.input as { id: string; content: RoutineContent; expectedUpdatedAt: string }
    assert.equal(save.expectedUpdatedAt, UPDATED.toISOString())
    const item = save.content.items.find((i) => i.id === ITEM)!
    assert.deepEqual(item.type === "exercise" && item.sets, [{ setNumber: 1, setType: "reps", targetReps: 3, loadType: "percent_rm", loadValue: 85 }])
    const out = data<{ updatedAt: string; saved: boolean; changes: { type: string; itemId: string }[] }>(r)
    assert.equal(out.saved, true)
    assert.equal(out.updatedAt, "2026-10-02T00:00:00.000Z")
    assert.deepEqual(out.changes.map((c) => [c.type, c.itemId]), [["update_sets", ITEM]])
  })

  it("expectedUpdatedAt viejo en una habilidad: CONFLICT antes de editar", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ calls }))
    const r = await client.callTool({ name: "remove_item", arguments: { routineId: ROUTINE, itemId: ITEM2, expectedUpdatedAt: "2026-09-01T00:00:00.000Z" } })
    assert.equal(errorOf(r).code, "CONFLICT")
    assert.deepEqual(errorOf(r).details, { updatedAt: UPDATED.toISOString() })
    assert.equal(calls.some((c) => c.path === "routines.updateContent"), false)
  })

  it("adjust_rest: el refine da INVALID_INPUT y con segundos guarda", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ calls }))
    const bad = await client.callTool({ name: "adjust_rest", arguments: { routineId: ROUTINE } })
    assert.equal(errorOf(bad).code, "INVALID_INPUT")
    assert.equal(calls.length, 0)
    const ok = await client.callTool({ name: "adjust_rest", arguments: { routineId: ROUTINE, seconds: 60, targetItemIds: [ITEM] } })
    assert.equal(ok.isError, undefined, JSON.stringify(ok.content))
    assert.match(data<{ message: string }>(ok).message, /60 s/)
    const save = calls.find((c) => c.path === "routines.updateContent")!.input as { content: RoutineContent }
    const item = save.content.items.find((i) => i.id === ITEM)!
    assert.equal(item.type === "exercise" && item.restSeconds, 60)
  })

  it("edit_routine es atómica: si una operación falla no se guarda nada", async () => {
    const calls: Call[] = []
    const client = await connect(makeCtx({ calls }))
    const r = await client.callTool({
      name: "edit_routine",
      arguments: { routineId: ROUTINE, ops: [{ op: "update_item_fields", itemId: ITEM, restSeconds: 30 }, { op: "remove_item", itemId: id(999) }] },
    })
    assert.equal(errorOf(r).code, "BAD_REQUEST")
    assert.match(errorOf(r).message, /^Operación 2 \(remove_item\)/)
    assert.deepEqual(errorOf(r).details, { opIndex: 1 })
    assert.equal(calls.some((c) => c.path === "routines.updateContent"), false)

    const ok = await client.callTool({
      name: "edit_routine",
      arguments: { routineId: ROUTINE, ops: [{ op: "update_item_fields", itemId: ITEM, restSeconds: 30 }, { op: "move_item", itemId: ITEM2, toPosition: 0 }] },
    })
    assert.equal(ok.isError, undefined, JSON.stringify(ok.content))
    assert.equal(data<{ changes: unknown[] }>(ok).changes.length, 2)
  })

  it("resources y prompts", async () => {
    const client = await connect(makeCtx())
    const resources = (await client.listResources()).resources.map((r) => r.uri).sort()
    assert.deepEqual(resources, ["atleta://guia/contenido-rutina", "atleta://guia/programacion"])
    const templates = (await client.listResourceTemplates()).resourceTemplates.map((t) => t.uriTemplate)
    assert.deepEqual(templates, ["atleta://rutinas/{routineId}"])
    const guide = await client.readResource({ uri: "atleta://guia/contenido-rutina" })
    const text = (guide.contents[0] as { text: string }).text
    assert.match(text, /JSON Schema/)
    assert.match(text, /"exerciseId"/)
    const rutina = await client.readResource({ uri: `atleta://rutinas/${ROUTINE}` })
    assert.equal(JSON.parse((rutina.contents[0] as { text: string }).text).id, ROUTINE)

    const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort()
    assert.deepEqual(prompts, ["ajustar_entrenamiento", "crear_entrenamiento", "revisar_adherencia"])
    const p = await client.getPrompt({ name: "ajustar_entrenamiento", arguments: { routine_id: ROUTINE, cambio: "más difícil" } })
    assert.match((p.messages[0]!.content as { text: string }).text, /expectedUpdatedAt/)
  })

  it("whoami devuelve equipo por defecto, hoy en UTC y límites", async () => {
    const client = await connect(makeCtx({ features: ["mcp", "evaluation"] }))
    const r = data<{ defaultTeamId: string; today: string; features: string[]; scopes: string[]; limits: { maxItems: number } }>(
      await client.callTool({ name: "whoami", arguments: {} }),
    )
    assert.equal(r.defaultTeamId, TEAM)
    assert.equal(r.today, "2026-10-05")
    assert.deepEqual(r.features, ["mcp", "evaluation"])
    assert.deepEqual(r.scopes, ["atleta:read", "atleta:write"])
    assert.equal(r.limits.maxItems, 20)
  })
})

describe("createMcpServer con todos los flags", () => {
  const allFlags = (scopes?: McpScope[], calls?: Call[]) =>
    makeCtx({ features: [...FEATURES], scopes, calls, overrides: { "plans.get": () => planView() } })

  it("con todos los scopes publica exactamente las herramientas esperadas, sin nombres repetidos", async () => {
    const client = await connect(allFlags())
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    assert.equal(new Set(names).size, names.length)
    assert.deepEqual([...names].sort(), [...READ_TOOLS, ...WRITE_TOOLS, ...PLAN_READ_TOOLS, ...PLAN_WRITE_TOOLS].sort())
    for (const t of tools) assert.equal(t.annotations?.readOnlyHint, [...READ_TOOLS, ...PLAN_READ_TOOLS].includes(t.name), `${t.name}: readOnlyHint`)
    for (const name of ["update_plan", "cancel_plan_assignment"]) assert.equal(tools.find((t) => t.name === name)!.annotations?.destructiveHint, true, name)

    const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort()
    assert.deepEqual(prompts, ["ajustar_entrenamiento", "crear_entrenamiento", "planificar_mesociclo", "revisar_adherencia"])
    const templates = (await client.listResourceTemplates()).resourceTemplates.map((t) => t.uriTemplate).sort()
    assert.deepEqual(templates, ["atleta://planes/{planId}", "atleta://rutinas/{routineId}"])
  })

  it("con solo atleta:read no aparece ninguna herramienta W y las de plan responden INSUFFICIENT_SCOPE", async () => {
    const calls: Call[] = []
    const client = await connect(allFlags(["atleta:read"], calls))
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name).sort(), [...READ_TOOLS, ...PLAN_READ_TOOLS].sort())
    for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name}: readOnlyHint`)
    for (const name of [...WRITE_TOOLS, ...PLAN_WRITE_TOOLS]) {
      const r = await client.callTool({ name, arguments: {} })
      assert.equal(errorOf(r).code, "INSUFFICIENT_SCOPE", name)
    }
    assert.equal(calls.length, 0)
    assert.deepEqual((await client.listPrompts()).prompts.map((p) => p.name), ["revisar_adherencia"])
  })

  it("fetch acepta plan:<uuid> y el resource atleta://planes/{planId} devuelve el JSON de get_plan", async () => {
    const client = await connect(allFlags())
    const r = await client.callTool({ name: "fetch", arguments: { id: `plan:${PLAN}` } })
    assert.equal(r.isError, undefined, JSON.stringify(r.content))
    const doc = data<{ id: string; title: string; text: string; url: string; metadata: Record<string, unknown> }>(r)
    assert.equal(doc.id, `plan:${PLAN}`)
    assert.equal(doc.title, "Mesociclo de fuerza")
    assert.match(doc.text, /Objetivo: Fuerza máxima/)
    assert.match(doc.text, /## Semana 1: Acumulación\n- lunes: Fuerza/)
    assert.match(doc.text, /## Semana 2\n\(sin entrenamientos\)/)
    assert.deepEqual(doc.metadata, { type: "plan", teamId: TEAM, status: "draft", weeks: 2, updatedAt: UPDATED.toISOString() })

    const getPlan = data(await client.callTool({ name: "get_plan", arguments: { planId: PLAN } }))
    const resource = await client.readResource({ uri: `atleta://planes/${PLAN}` })
    assert.deepEqual(JSON.parse((resource.contents[0] as { text: string }).text), getPlan)

    // Sin el flag no hay tipo "plan" ni plantilla de resource
    const noPlans = await connect(makeCtx())
    assert.equal(errorOf(await noPlans.callTool({ name: "fetch", arguments: { id: `plan:${PLAN}` } })).code, "NOT_FOUND")
    await assert.rejects(noPlans.readResource({ uri: `atleta://planes/${PLAN}` }))
  })
})
