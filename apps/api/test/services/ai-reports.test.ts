import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computePctChange } from "../../src/services/ai-reports"

describe("computePctChange", () => {
  it("trata un RM previo de 0 como sin dato previo (sin Infinity/NaN)", () => {
    assert.equal(computePctChange("225", "0"), null)
    assert.equal(computePctChange("225", "0.00"), null)
    assert.equal(computePctChange("0", "0"), null)
  })

  it("calcula el porcentaje con cambio positivo", () => {
    assert.equal(computePctChange("220", "200"), "10.0")
  })

  it("calcula el porcentaje con cambio negativo", () => {
    assert.equal(computePctChange("180", "200"), "-10.0")
  })

  it("devuelve null sin RM previo", () => {
    assert.equal(computePctChange("200", null), null)
    assert.equal(computePctChange("200", undefined), null)
  })
})
