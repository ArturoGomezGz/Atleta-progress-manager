import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildProgressPrompt, type RmEntry } from "../../src/services/ai-reports"

const entry = (rmLbs: string, day: number): RmEntry => ({
  rmLbs,
  recordedAt: new Date(Date.UTC(2026, 0, day)),
  source: "auto",
})

describe("buildProgressPrompt", () => {
  it("incluye el porcentaje de cambio cuando el anterior es válido", () => {
    const current = entry("110", 2)
    const prompt = buildProgressPrompt({ exerciseName: "Sentadilla", current, history: [entry("100", 1), current] })
    assert.ok(prompt.includes("el cambio de 10.0% respecto al registro anterior"))
  })

  it("no produce Infinity ni NaN cuando el anterior es 0", () => {
    const current = entry("150", 2)
    const prompt = buildProgressPrompt({ exerciseName: "Sentadilla", current, history: [entry("0", 1), current] })
    assert.ok(!prompt.includes("Infinity"))
    assert.ok(!prompt.includes("NaN"))
    assert.ok(prompt.includes("sin porcentaje de cambio respecto al registro anterior"))
  })

  it("menciona que es el primer registro cuando no hay anterior", () => {
    const current = entry("150", 1)
    const prompt = buildProgressPrompt({ exerciseName: "Sentadilla", current, history: [current] })
    assert.ok(prompt.includes("que es el primer registro"))
  })
})
