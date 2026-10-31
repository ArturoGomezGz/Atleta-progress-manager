import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { firstOpenSlot, slotLabel, suggestSlot, type DayPlanItem } from "../src/lib/day-plan"

const item = (routineName: string, kind: DayPlanItem["kind"], status: DayPlanItem["status"] = "pending"): DayPlanItem =>
  ({ sessionId: routineName, routineName, kind, athleteNames: ["Ana"], status })

describe("plan del día al asignar", () => {
  const plan = [item("Cal", "warmup"), item("Fuerza", "main"), item("Soltar", "recovery")]

  it("sugiere según el tipo", () => {
    assert.equal(suggestSlot("warmup", plan), 0)
    assert.equal(suggestSlot("recovery", plan), 3)
    assert.equal(suggestSlot("main", plan), 2) // después del principal, antes de la recuperación
    assert.equal(suggestSlot("main", [item("Cal", "warmup"), item("Soltar", "recovery")]), 1)
    assert.equal(suggestSlot("main", [item("Cal", "warmup")]), 1)
    assert.equal(suggestSlot("main", [item("Soltar", "recovery")]), 0)
  })

  it("no ofrece ranuras antes de lo hecho o en curso", () => {
    const p = [item("Cal", "warmup", "completed"), item("Fuerza", "main", "active"), item("Soltar", "recovery")]
    assert.equal(firstOpenSlot(p), 2)
    assert.equal(suggestSlot("warmup", p), 2)
    assert.equal(firstOpenSlot(plan), 0)
  })

  it("etiqueta las ranuras", () => {
    assert.deepEqual([0, 1, 3].map((i) => slotLabel(plan, i)), ["Al inicio del día", "Después de Cal", "Al final del día"])
  })
})
