import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildProgressPrompt, type RmEntry } from "../../src/services/ai-reports"

const entry = (rmLbs: string, day: number): RmEntry => ({
  rmLbs,
  recordedAt: new Date(Date.UTC(2026, 0, day)),
  source: "manual",
})

describe("buildProgressPrompt", () => {
  it("indica que es el primer registro cuando solo hay uno en el historial", () => {
    const current = entry("100", 1)
    const prompt = buildProgressPrompt({ exerciseName: "Sentadilla", current, history: [current] })
    assert.ok(prompt.includes("que es el primer registro"))
  })

  it("calcula el cambio porcentual respecto al registro anterior", () => {
    const current = entry("110", 2)
    const prompt = buildProgressPrompt({ exerciseName: "Sentadilla", current, history: [entry("100", 1), current] })
    assert.ok(prompt.includes("10.0%"))
  })

  it("no produce Infinity ni NaN cuando el registro anterior es 0", () => {
    const current = entry("110", 2)
    const prompt = buildProgressPrompt({ exerciseName: "Sentadilla", current, history: [entry("0", 1), current] })
    assert.ok(!prompt.includes("Infinity"))
    assert.ok(!prompt.includes("NaN"))
  })
})
