import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { ZodError } from "zod"
import type { RoutineContent } from "@atleta/db/schema"
import {
  assertRoutineLimits,
  MAX_CONTENT_JSON_CHARS,
  normalizeRoutineContent,
  routineContentInputSchema,
  toContentInput,
  type RoutineContentInput,
} from "../../src/services/routine-content-input"

const EX_A = "11111111-1111-4111-8111-111111111111"
const EX_B = "22222222-2222-4222-8222-222222222222"
const ITEM_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

// Generador determinista de ids (uuid v4 válidos) para comparar resultados
function seqIds() {
  let n = 0
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
}

const sample: RoutineContentInput = {
  items: [
    {
      type: "exercise",
      exerciseId: EX_A,
      sets: { count: 3, setType: "reps", targetReps: 10, loadType: "rpe", loadValue: 7 },
      restSeconds: 90,
      tempo: "3-1-x-0",
      goal: "strength",
      notes: "  Espalda neutra  ",
    },
    {
      type: "block",
      name: "Core",
      rounds: 3,
      restBetweenRoundsSeconds: 60,
      exercises: [
        { exerciseId: EX_B, sets: [{ setType: "time", targetDurationSeconds: 30 }], perSide: true },
        { exerciseId: EX_A, sets: [{ setType: "reps", targetReps: 12 }] },
      ],
    },
  ],
}

describe("normalizeRoutineContent", () => {
  it("numera order y setNumber, expande count y genera ids", () => {
    const c = normalizeRoutineContent(sample, { newId: seqIds() })
    assert.equal(c.v, 1)
    assert.equal(c.items.length, 2)
    const [first, block] = c.items
    assert.equal(first!.type, "exercise")
    assert.equal(first!.order, 0)
    if (first!.type !== "exercise") throw new Error("tipo")
    assert.deepEqual(first!.sets.map((s) => s.setNumber), [1, 2, 3])
    assert.deepEqual(first!.sets[0], { setNumber: 1, setType: "reps", targetReps: 10, loadType: "rpe", loadValue: 7 })
    assert.equal(first!.tempo, "3-1-X-0")
    assert.equal(first!.notes, "Espalda neutra")
    assert.equal(block!.order, 1)
    if (block!.type !== "block") throw new Error("tipo")
    assert.deepEqual(block!.exercises.map((e) => e.order), [0, 1])
    assert.equal(block!.exercises[0]!.perSide, true)
    assert.equal(block!.exercises[1]!.perSide, undefined)

    const ids = [first!.id, block!.id, ...block!.exercises.map((e) => e.id)]
    assert.equal(new Set(ids).size, ids.length)
  })

  it("conserva ids válidos y regenera los repetidos", () => {
    const c = normalizeRoutineContent(
      {
        items: [
          { type: "exercise", id: ITEM_1, exerciseId: EX_A, sets: [{ setType: "reps", targetReps: 5 }] },
          { type: "exercise", id: ITEM_1, exerciseId: EX_B, sets: [{ setType: "reps", targetReps: 5 }] },
        ],
      },
      { newId: seqIds() },
    )
    assert.equal(c.items[0]!.id, ITEM_1)
    assert.notEqual(c.items[1]!.id, ITEM_1)
  })

  it("loadValue sin loadType es inválido", () => {
    assert.throws(
      () => normalizeRoutineContent({ items: [{ type: "exercise", exerciseId: EX_A, sets: [{ setType: "reps", loadValue: 8 }] }] }),
      ZodError,
    )
  })

  it("acota loadValue según loadType", () => {
    const bad = (loadType: "rpe" | "percent_rm" | "fixed_kg", loadValue: number) =>
      routineContentInputSchema.safeParse({ items: [{ type: "exercise", exerciseId: EX_A, sets: [{ setType: "reps", loadType, loadValue }] }] }).success === false
    assert.equal(bad("rpe", 11), true)
    assert.equal(bad("rpe", 8), false)
    assert.equal(bad("percent_rm", 121), true)
    assert.equal(bad("percent_rm", 80), false)
    assert.equal(bad("fixed_kg", 1001), true)
  })

  it("rechaza campos desconocidos y tempo mal formado", () => {
    assert.equal(routineContentInputSchema.safeParse({ items: [{ type: "exercise", exerciseId: EX_A, order: 0, sets: [{ setType: "reps" }] }] }).success, false)
    assert.equal(routineContentInputSchema.safeParse({ items: [{ type: "exercise", exerciseId: EX_A, tempo: "3120", sets: [{ setType: "reps" }] }] }).success, false)
  })

  it("aplica los límites: 21 ítems, 11 en bloque, 13 series, rondas", () => {
    const ex = { type: "exercise" as const, exerciseId: EX_A, sets: [{ setType: "reps" as const, targetReps: 5 }] }
    assert.throws(() => normalizeRoutineContent({ items: Array.from({ length: 21 }, () => ex) }), ZodError)
    assert.doesNotThrow(() => normalizeRoutineContent({ items: Array.from({ length: 20 }, () => ex) }))

    const blockWith = (n: number, rounds = 3) => ({
      items: [{ type: "block" as const, rounds, exercises: Array.from({ length: n }, () => ({ exerciseId: EX_A, sets: ex.sets })) }],
    })
    assert.throws(() => normalizeRoutineContent(blockWith(11)), ZodError)
    assert.doesNotThrow(() => normalizeRoutineContent(blockWith(10)))
    assert.throws(() => normalizeRoutineContent(blockWith(2, 1)), ZodError)
    assert.throws(() => normalizeRoutineContent(blockWith(2, 21)), ZodError)

    const sets13 = Array.from({ length: 13 }, () => ({ setType: "reps" as const, targetReps: 5 }))
    assert.throws(() => normalizeRoutineContent({ items: [{ ...ex, sets: sets13 }] }), ZodError)
    assert.throws(() => normalizeRoutineContent({ items: [{ ...ex, sets: { count: 13, setType: "reps" } }] }), ZodError)
  })

  it("rechaza contenido de más de 60 000 caracteres", () => {
    const longNotes = "x".repeat(300)
    const ex = { exerciseId: EX_A, notes: longNotes, sets: Array.from({ length: 12 }, () => ({ setType: "reps" as const, targetReps: 5 })) }
    const huge = { items: Array.from({ length: 20 }, () => ({ type: "block" as const, rounds: 2, exercises: Array.from({ length: 10 }, () => ex) })) }
    assert.ok(JSON.stringify(huge).length > MAX_CONTENT_JSON_CHARS)
    const r = routineContentInputSchema.safeParse(huge)
    assert.equal(r.success, false)
    assert.match(JSON.stringify(r.error?.issues), /60000/)
  })
})

describe("toContentInput", () => {
  it("ida y vuelta: normalize(toContentInput(c)) === c", () => {
    const c = normalizeRoutineContent(sample, { newId: seqIds() })
    const input = toContentInput(c)
    // Sin order ni setNumber, con ids
    assert.equal("order" in input.items[0]!, false)
    assert.equal(input.items[0]!.id, c.items[0]!.id)
    assert.deepEqual(normalizeRoutineContent(input, { newId: () => { throw new Error("no debe generar ids") } }), c)
  })

  it("ordena por order y quita los campos legados", () => {
    const stored: RoutineContent = {
      v: 1,
      mode: "sequential",
      items: [
        { type: "exercise", id: EX_B, exerciseId: EX_B, order: 1, sets: [{ setNumber: 1, setType: "reps", targetReps: 3 }] },
        { type: "exercise", id: EX_A, exerciseId: EX_A, order: 0, sets: [{ setNumber: 2, setType: "reps", targetReps: 2 }, { setNumber: 1, setType: "reps", targetReps: 1 }] },
      ],
    }
    const input = toContentInput(stored)
    assert.deepEqual(Object.keys(input), ["items"])
    assert.equal(input.items[0]!.id, EX_A)
    const sets = input.items[0]!.type === "exercise" ? input.items[0]!.sets : []
    assert.deepEqual(Array.isArray(sets) && sets.map((s) => s.targetReps), [1, 2])
  })
})

describe("assertRoutineLimits", () => {
  it("lanza BAD_REQUEST con contenido que excede los límites", () => {
    const item = { type: "exercise" as const, id: EX_A, exerciseId: EX_A, order: 0, sets: [{ setNumber: 1, setType: "reps" as const }] }
    const content: RoutineContent = { v: 1, items: Array.from({ length: 21 }, (_, i) => ({ ...item, order: i })) }
    assert.throws(() => assertRoutineLimits(content), (err: unknown) => err instanceof TRPCError && err.code === "BAD_REQUEST")
    assert.doesNotThrow(() => assertRoutineLimits({ v: 1, items: content.items.slice(0, 20) }))
  })
})
