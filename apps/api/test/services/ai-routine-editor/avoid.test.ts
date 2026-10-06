import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { matchesAvoid, normalizeAvoid, normalizeText } from "../../../src/services/ai-routine-editor/avoid"

describe("avoid", () => {
  it("normaliza acentos, mayúsculas y plurales", () => {
    assert.equal(normalizeText("  Sentadilla Búlgara "), "sentadilla bulgara")
    assert.deepEqual(normalizeAvoid(["Paralelas", "saltos", "Barra", "ab", "paralelas"]), ["paralela", "salto", "barra"])
    assert.deepEqual(normalizeAvoid(undefined), [])
  })

  it("coincide por nombre o por equipamiento, sin acentos ni mayúsculas", () => {
    const avoid = normalizeAvoid(["paralelas", "barra", "saltos"])
    assert.equal(matchesAvoid({ name: "Fondos en Paralelas" }, avoid), true)
    assert.equal(matchesAvoid({ name: "Press de pecho", equipment: [{ equipmentName: "Barra olímpica" }] }, avoid), true)
    assert.equal(matchesAvoid({ name: "Salto al cajón" }, avoid), true)
    assert.equal(matchesAvoid({ name: "Flexiones", equipment: ["Peso corporal"] }, avoid), false)
    assert.equal(matchesAvoid({ name: "Fondos en paralelas" }, []), false)
  })
})
