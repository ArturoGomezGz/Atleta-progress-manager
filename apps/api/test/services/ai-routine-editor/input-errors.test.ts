import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { friendlyTweakInputMessage } from "../../../src/services/ai-routine-editor/input"

describe("friendlyTweakInputMessage", () => {
  const issue = (path: (string | number)[], message: string, code = "custom") => ({ path, message, code })
  it("traduce los casos comunes", () => {
    assert.match(friendlyTweakInputMessage([issue(["message"], "x", "too_small")]), /Escribe qué quieres cambiar/)
    assert.match(friendlyTweakInputMessage([issue(["message"], "x", "too_big")]), /demasiado largo/)
    assert.match(friendlyTweakInputMessage([issue(["routineContent"], "La rutina está vacía")]), /al menos un ejercicio/)
    assert.match(friendlyTweakInputMessage([issue(["routineContent"], "Máximo 30 ítems")]), /demasiados ítems/)
    assert.match(friendlyTweakInputMessage([issue(["routineContent"], "La rutina es demasiado grande")]), /demasiado grande/)
    assert.ok(!friendlyTweakInputMessage([issue(["routineContent", "items", 0], "Required")]).startsWith("["))
  })
})
