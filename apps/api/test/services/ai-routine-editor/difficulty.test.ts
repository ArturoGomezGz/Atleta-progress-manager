import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RoutineContent } from "@atleta/db/schema"
import { planDifficulty, restOps } from "../../../src/services/ai-routine-editor/difficulty"
import { adjustDifficultySkill, adjustRestSkill } from "../../../src/services/ai-routine-editor/skills-compound"
import { createRuntime } from "../../../src/services/ai-routine-editor/runtime"
import { content, id, ITEM_DIPS, ITEM_PRESS, ITEM_ROW, ITEM_SQUAT, NAMES, TEAM } from "./helpers"

const run = (c: RoutineContent) => createRuntime({ original: c, names: NAMES, avoid: [], userId: "u", teamId: TEAM, allowFixedKg: false, deps: { async searchExercises() { return [] }, async proposeNewExercise() { return {} } } })

const exercise = (c: RoutineContent, itemId: string) => {
  const it = c.items.find((i) => i.id === itemId)
  assert.ok(it && it.type === "exercise")
  return it
}

describe("adjust_difficulty (determinista)", () => {
  it("sin palanca explícita sube la intensidad: RPE +1 y no toca ejercicios sin carga", () => {
    const rt = run(content())
    const out = adjustDifficultySkill.run!({ direction: "up" }, rt) as { message: string; meta: { knob: string } }
    assert.equal(out.meta.knob, "intensity")
    const c = rt.working()
    assert.deepEqual(exercise(c, ITEM_SQUAT).sets.map((s) => s.loadValue), [8, 8, 8])
    assert.deepEqual(exercise(c, ITEM_ROW).sets.map((s) => s.loadValue), [7.5, 7.5])
    assert.equal(exercise(c, ITEM_DIPS).sets.length, 1, "peso corporal intacto")
    assert.equal(exercise(c, ITEM_SQUAT).sets.length, 3, "no agrega series: una sola palanca")
    assert.ok(rt.applied.every((a) => a.change.type === "update_sets"))
    assert.match(out.message, /Subí la intensidad en 3 ítems/)
  })

  it("respeta el tope de RPE 9 y máximo 2 ejercicios en RPE >= 9", () => {
    const c = content()
    for (const it of c.items) if (it.type === "exercise") it.sets = it.sets.map((s) => ({ ...s, loadType: "rpe" as const, loadValue: 8 }))
    // 3 ejercicios con RPE 8 -> solo 2 pueden llegar a 9; el tercero queda en 8.5
    const { ops } = planDifficulty(c, { direction: "up", knob: "intensity" })
    const finals = ops.map((o) => (o.op === "update_sets" ? o.sets[0]!.loadValue : null))
    assert.equal(finals.filter((v) => v === 9).length, 2)
    assert.ok(finals.every((v) => v != null && v <= 9))
    assert.ok(finals.includes(8.5))
  })

  it("bajar la intensidad respeta el piso de RPE 5 y no sube lo que ya estaba abajo", () => {
    const c = content()
    const sq = exercise(c, ITEM_SQUAT)
    sq.sets = sq.sets.map((s) => ({ ...s, loadValue: 5 }))
    const { ops } = planDifficulty(c, { direction: "down", knob: "intensity" })
    assert.ok(!ops.some((o) => o.op === "update_sets" && o.itemId === ITEM_SQUAT))
    const press = ops.find((o) => o.op === "update_sets" && o.itemId === ITEM_PRESS)
    assert.ok(press && press.op === "update_sets" && press.sets.every((s) => s.loadValue === 6))
  })

  it("% RM sube de 5 en 5 con tope 95 y nunca toca fixed_kg", () => {
    const c = content()
    exercise(c, ITEM_SQUAT).sets = [{ setNumber: 1, setType: "reps", targetReps: 3, loadType: "percent_rm", loadValue: 92 }]
    exercise(c, ITEM_PRESS).sets = [{ setNumber: 1, setType: "reps", targetReps: 5, loadType: "fixed_kg", loadValue: 60 }]
    const { ops } = planDifficulty(c, { direction: "up", knob: "intensity" })
    const sq = ops.find((o) => o.op === "update_sets" && o.itemId === ITEM_SQUAT)
    assert.ok(sq && sq.op === "update_sets" && sq.sets[0]!.loadValue === 95)
    assert.ok(!ops.some((o) => o.op === "update_sets" && o.itemId === ITEM_PRESS))
  })

  it("volumen: ±1 serie con límites 2..6 y rondas de bloques", () => {
    const c = content()
    c.items.push({ type: "block", id: id(50), order: 4, name: "Core", rounds: 8, exercises: [{ id: id(51), exerciseId: ROW_ID, order: 0, sets: [{ setNumber: 1, setType: "reps", targetReps: 10 }] }] })
    const up = planDifficulty(c, { direction: "up", knob: "volume" }).ops
    assert.ok(up.some((o) => o.op === "update_sets" && o.itemId === ITEM_SQUAT && o.sets.length === 4))
    assert.ok(!up.some((o) => o.op === "update_block"), "rondas ya en el tope")
    const down = planDifficulty(c, { direction: "down", knob: "volume" }).ops
    assert.ok(down.some((o) => o.op === "update_sets" && o.itemId === ITEM_SQUAT && o.sets.length === 2))
    assert.ok(!down.some((o) => o.op === "update_sets" && o.itemId === ITEM_PRESS), "con 2 series no baja más")
    assert.ok(down.some((o) => o.op === "update_block" && o.rounds === 7))
  })

  it("descanso: más difícil = menos descanso (±15 s) y solo donde ya existe", () => {
    const rt = run(content())
    adjustDifficultySkill.run!({ direction: "up", knob: "rest" }, rt)
    const c = rt.working()
    assert.equal(exercise(c, ITEM_SQUAT).restSeconds, 105)
    assert.equal(exercise(c, ITEM_ROW).restSeconds, 45)
    assert.equal(exercise(c, ITEM_DIPS).restSeconds, undefined)
    assert.ok(rt.applied.every((a) => a.change.type === "update_item_fields"))
  })

  it("acota a los ítems objetivo", () => {
    const { ops } = planDifficulty(content(), { direction: "up", targetIds: [ITEM_PRESS] })
    assert.deepEqual(ops.map((o) => (o.op === "update_sets" ? o.itemId : null)), [ITEM_PRESS])
  })

  it("sin margen devuelve un mensaje y ningún cambio", () => {
    const c: RoutineContent = { v: 1, items: [{ type: "exercise", id: ITEM_DIPS, exerciseId: id(104), order: 0, sets: [{ setNumber: 1, setType: "reps", targetReps: 10 }] }] }
    const rt = run(c)
    const out = adjustDifficultySkill.run!({ direction: "down", knob: "intensity" }, rt) as { message: string }
    assert.equal(rt.applied.length, 0)
    assert.match(out.message, /No encontré margen/)
  })

  it("nunca agrega, quita ni reemplaza ejercicios", () => {
    for (const knob of ["intensity", "volume", "rest"] as const) for (const direction of ["up", "down"] as const) {
      const rt = run(content())
      adjustDifficultySkill.run!({ direction, knob }, rt)
      assert.ok(rt.applied.every((a) => ["update_sets", "update_item_fields", "update_block"].includes(a.change.type)))
      assert.equal(rt.working().items.length, 4)
    }
  })
})

describe("adjust_rest (determinista)", () => {
  it("fija un valor exacto en el ejercicio indicado", () => {
    const rt = run(content())
    const out = adjustRestSkill.run!({ seconds: 90, targetItemIds: [ITEM_SQUAT] }, rt) as { message: string }
    assert.equal(exercise(rt.working(), ITEM_SQUAT).restSeconds, 90)
    assert.equal(exercise(rt.working(), ITEM_ROW).restSeconds, 60)
    assert.match(out.message, /90 s/)
  })

  it("sube o baja 15 s respetando 15..600", () => {
    const c = content()
    exercise(c, ITEM_ROW).restSeconds = 20
    const down = restOps(c, { more: false, scope: null }).find((o) => o.op === "update_item_fields" && o.itemId === ITEM_ROW)
    assert.ok(down && down.op === "update_item_fields" && down.restSeconds === 15)
    const up = restOps(c, { more: true, scope: null }).find((o) => o.op === "update_item_fields" && o.itemId === ITEM_SQUAT)
    assert.ok(up && up.op === "update_item_fields" && up.restSeconds === 135)
  })

  it("exige dirección o segundos", () => {
    assert.equal(adjustRestSkill.inputSchema!.safeParse({}).success, false)
    assert.equal(adjustRestSkill.inputSchema!.safeParse({ direction: "down" }).success, true)
  })
})

const ROW_ID = id(103)
