import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_PLAN_INLINE_ROUTINES,
  MAX_PLAN_WORKOUTS,
  MAX_SCHEDULE_ATHLETES,
  planCancelAssignmentInputSchema,
  planCreateInputSchema,
  planScheduleInputSchema,
  planUpdateInputSchema,
  planWorkoutInputSchema,
} from "../../src/services/training-plan-input"

const TEAM = "11111111-1111-4111-8111-111111111111"
const ROUTINE = "22222222-2222-4222-8222-222222222222"
const PLAN = "33333333-3333-4333-8333-333333333333"
const EX = "44444444-4444-4444-8444-444444444444"

const content = { items: [{ type: "exercise", exerciseId: EX, sets: { count: 3, setType: "reps", targetReps: 8 } }] }
const base = { teamId: TEAM, name: "Bloque de fuerza", weeks: 4 }

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.error?.issues ?? []).map((i) => i.message).join(" | ")

describe("training-plan-input", () => {
  it("un hueco lleva exactamente uno de routineId o routineKey", () => {
    assert.equal(planWorkoutInputSchema.safeParse({ week: 1, weekday: 1, routineId: ROUTINE }).success, true)
    assert.equal(planWorkoutInputSchema.safeParse({ week: 1, weekday: 1, routineKey: "a" }).success, true)
    const both = planWorkoutInputSchema.safeParse({ week: 1, weekday: 1, routineId: ROUTINE, routineKey: "a" })
    assert.equal(both.success, false)
    assert.match(messages(both), /exactamente uno/)
    const none = planWorkoutInputSchema.safeParse({ week: 1, weekday: 1 })
    assert.equal(none.success, false)
    assert.match(messages(none), /exactamente uno/)
  })

  it("weekday ISO 1..7 y semana 1..16", () => {
    for (const bad of [{ week: 1, weekday: 0 }, { week: 1, weekday: 8 }, { week: 0, weekday: 1 }, { week: 17, weekday: 1 }, { week: 1.5, weekday: 1 }]) {
      assert.equal(planWorkoutInputSchema.safeParse({ ...bad, routineId: ROUTINE }).success, false, JSON.stringify(bad))
    }
  })

  it("create: rutinas por key, keys únicas y referenciadas, semanas dentro del plan", () => {
    const ok = planCreateInputSchema.safeParse({
      ...base,
      weekMeta: [{ week: 4, name: "Descarga" }],
      routines: [{ key: "A", name: "Fuerza A", content }],
      workouts: [{ week: 1, weekday: 1, routineKey: "A" }, { week: 4, weekday: 5, routineId: ROUTINE }],
    })
    assert.equal(ok.success, true, messages(ok))

    const unknownKey = planCreateInputSchema.safeParse({ ...base, workouts: [{ week: 1, weekday: 1, routineKey: "B" }] })
    assert.equal(unknownKey.success, false)
    assert.match(messages(unknownKey), /key "B"/)

    const dupKey = planCreateInputSchema.safeParse({
      ...base,
      routines: [{ key: "A", name: "x", content }, { key: "A", name: "y", content }],
      workouts: [],
    })
    assert.match(messages(dupKey), /repetida/)

    const outside = planCreateInputSchema.safeParse({ ...base, workouts: [{ week: 5, weekday: 1, routineId: ROUTINE }] })
    assert.match(messages(outside), /excede/)
    const metaOutside = planCreateInputSchema.safeParse({ ...base, weekMeta: [{ week: 6 }], workouts: [] })
    assert.match(messages(metaOutside), /excede/)
    const metaDup = planCreateInputSchema.safeParse({ ...base, weekMeta: [{ week: 1 }, { week: 1 }], workouts: [] })
    assert.match(messages(metaDup), /repetida/)
  })

  it("create: límites de semanas, huecos, rutinas inline y textos", () => {
    assert.equal(planCreateInputSchema.safeParse({ ...base, weeks: 16, workouts: [] }).success, true)
    assert.equal(planCreateInputSchema.safeParse({ ...base, weeks: 17, workouts: [] }).success, false)
    assert.equal(planCreateInputSchema.safeParse({ ...base, weeks: 0, workouts: [] }).success, false)

    const slots = (n: number) => Array.from({ length: n }, (_, i) => ({ week: 1 + Math.floor(i / 7), weekday: 1 + (i % 7), routineId: ROUTINE }))
    assert.equal(planCreateInputSchema.safeParse({ ...base, weeks: 16, workouts: slots(MAX_PLAN_WORKOUTS) }).success, true)
    assert.equal(planCreateInputSchema.safeParse({ ...base, weeks: 16, workouts: slots(MAX_PLAN_WORKOUTS + 1) }).success, false)

    const routines = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, name: `R${i}`, content }))
    assert.equal(planCreateInputSchema.safeParse({ ...base, routines: routines(MAX_PLAN_INLINE_ROUTINES), workouts: [] }).success, true)
    assert.equal(planCreateInputSchema.safeParse({ ...base, routines: routines(MAX_PLAN_INLINE_ROUTINES + 1), workouts: [] }).success, false)

    assert.equal(planCreateInputSchema.safeParse({ ...base, name: "", workouts: [] }).success, false)
    assert.equal(planCreateInputSchema.safeParse({ ...base, name: "x".repeat(121), workouts: [] }).success, false)
    assert.equal(planCreateInputSchema.safeParse({ ...base, goal: "x".repeat(301), workouts: [] }).success, false)
    assert.equal(planCreateInputSchema.safeParse({ ...base, description: "x".repeat(2001), workouts: [] }).success, false)
    assert.equal(planCreateInputSchema.safeParse({ ...base, routines: [{ key: "x".repeat(41), name: "R", content }], workouts: [] }).success, false)
    assert.equal(
      planCreateInputSchema.safeParse({ ...base, workouts: [{ week: 1, weekday: 1, routineId: ROUTINE, notes: "x".repeat(301) }] }).success,
      false,
    )
    // El contenido de una rutina inline se valida con routineContentInputSchema
    const badContent = { items: [{ type: "exercise", exerciseId: EX, sets: { count: 13, setType: "reps" } }] }
    assert.equal(planCreateInputSchema.safeParse({ ...base, routines: [{ key: "A", name: "R", content: badContent }], workouts: [] }).success, false)
    // Campos desconocidos se rechazan
    assert.equal(planCreateInputSchema.safeParse({ ...base, workouts: [], extra: 1 }).success, false)
  })

  it("update: exige expectedUpdatedAt y algún cambio; replaceWorkouts no se combina", () => {
    const at = "2026-10-24T12:00:00.000Z"
    assert.equal(planUpdateInputSchema.safeParse({ planId: PLAN, expectedUpdatedAt: at, name: "Nuevo" }).success, true)
    assert.equal(planUpdateInputSchema.safeParse({ planId: PLAN, name: "Nuevo" }).success, false)
    assert.match(messages(planUpdateInputSchema.safeParse({ planId: PLAN, expectedUpdatedAt: at })), /No hay cambios/)
    const mixed = planUpdateInputSchema.safeParse({
      planId: PLAN,
      expectedUpdatedAt: at,
      replaceWorkouts: [],
      removeWorkoutIds: [ROUTINE],
    })
    assert.match(messages(mixed), /no se combina/)
    const badKey = planUpdateInputSchema.safeParse({ planId: PLAN, expectedUpdatedAt: at, addWorkouts: [{ week: 1, weekday: 2, routineKey: "nope" }] })
    assert.match(messages(badKey), /key "nope"/)
    assert.equal(planUpdateInputSchema.safeParse({ planId: PLAN, expectedUpdatedAt: at, description: null }).success, true)
  })

  it("schedule y cancel: atletas 1..50, fechas YYYY-MM-DD, dryRun por defecto false", () => {
    const parsed = planScheduleInputSchema.parse({ planId: PLAN, athleteIds: ["a"], startDate: "2026-10-26" })
    assert.equal(parsed.dryRun, false)
    assert.equal(planScheduleInputSchema.safeParse({ planId: PLAN, athleteIds: [], startDate: "2026-10-26" }).success, false)
    const many = Array.from({ length: MAX_SCHEDULE_ATHLETES + 1 }, (_, i) => `a${i}`)
    assert.equal(planScheduleInputSchema.safeParse({ planId: PLAN, athleteIds: many, startDate: "2026-10-26" }).success, false)
    assert.equal(planScheduleInputSchema.safeParse({ planId: PLAN, athleteIds: ["a"], startDate: "26/10/2026" }).success, false)
    assert.equal(planScheduleInputSchema.safeParse({ planId: PLAN, athleteIds: ["a"], startDate: "2026-02-30" }).success, false)
    assert.equal(planCancelAssignmentInputSchema.safeParse({ assignmentId: PLAN, fromDate: "2026-11-01" }).success, true)
    assert.equal(planCancelAssignmentInputSchema.safeParse({ assignmentId: "x" }).success, false)
  })
})
