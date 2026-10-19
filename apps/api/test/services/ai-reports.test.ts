import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { validateReportText } from "../../src/services/ai-reports"

describe("validateReportText", () => {
  it("lanza si la respuesta está vacía", () => {
    assert.throws(() => validateReportText(""), /vacía o demasiado corta/)
    assert.throws(() => validateReportText("   \n  "), /vacía o demasiado corta/)
  })

  it("lanza si la respuesta es demasiado corta e incluye el finishReason", () => {
    assert.throws(() => validateReportText("Hola.", "MAX_TOKENS"), /finishReason: MAX_TOKENS/)
  })

  it("devuelve el texto recortado si la respuesta es normal", () => {
    const body = "a".repeat(200)
    assert.equal(validateReportText(`  ${body}\n`, "STOP"), body)
  })
})
