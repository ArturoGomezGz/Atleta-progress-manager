// Textos de la prescripción que ven web y móvil (módulos puros, copias entre sí).
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as mobile from "../../../mobile/src/lib/workout-text"
import * as web from "../../../web/src/lib/workout-text"
import { estimateMinutes, setsSummary } from "../../../web/src/lib/ai-routine-diff"

const reps = (n: number | null) => ({ setType: "reps", targetReps: n, targetDurationSeconds: null })
const time = (s: number) => ({ setType: "time", targetReps: null, targetDurationSeconds: s })

for (const [name, lib] of [["web", web], ["móvil", mobile]] as const) {
  describe(`workout-text (${name}): por cada lado`, () => {
    it("describeTarget agrega \"por lado\" solo con perSide", () => {
      assert.equal(lib.describeTarget(reps(12)), "12 repeticiones")
      assert.equal(lib.describeTarget(reps(12), true), "12 repeticiones por lado")
      assert.equal(lib.describeTarget(time(30), true), "30 segundos por lado")
      assert.equal(lib.describeTarget(reps(null), true), "Las repeticiones que puedas por lado")
    })

    it("summarizeTargets resume las series por lado", () => {
      assert.equal(lib.summarizeTargets([reps(12), reps(12), reps(12)]), "3 series de 12 repeticiones")
      assert.equal(lib.summarizeTargets([reps(12), reps(12), reps(12)], true), "3 series de 12 repeticiones por lado")
      assert.equal(lib.summarizeTargets([time(30), time(30)], true), "2 series de 30 segundos por lado")
      assert.equal(lib.summarizeTargets([reps(12), reps(10)], true), "2 series por lado")
      assert.equal(lib.summarizeTargets([], true), "Sin series")
    })
  })
}

describe("ai-routine-diff (web): por cada lado", () => {
  const sets = [1, 2, 3].map((n) => ({ setNumber: n, setType: "time" as const, targetDurationSeconds: 30 }))

  it("setsSummary marca \"por lado\"", () => {
    assert.equal(setsSummary(sets), "3 × 30s")
    assert.equal(setsSummary(sets, true), "3 × 30s por lado")
  })

  it("la duración estimada cuenta los dos lados", () => {
    const ex = { id: "a", exerciseId: "b", order: 0, sets }
    const one = estimateMinutes({ v: 1, items: [{ type: "exercise", ...ex, sets: [...sets, ...sets, ...sets, ...sets] }] })
    const both = estimateMinutes({ v: 1, items: [{ type: "exercise", ...ex, sets: [...sets, ...sets], perSide: true }] })
    assert.equal(one, 6)
    assert.equal(both, 6)
  })
})
