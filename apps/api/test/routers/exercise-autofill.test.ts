import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sanitizeAutofillResult } from "../../src/routers/exercise-autofill"

const M1 = "11111111-1111-1111-1111-111111111111"
const M2 = "22222222-2222-2222-2222-222222222222"
const E1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const E2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const validMuscles = new Set([M1, M2])
const validEquipment = new Set([E1, E2])

const base = {
  difficulty: "intermediate" as const,
  movementPatterns: ["squat" as const],
  suitableFor: null,
}

describe("sanitizeAutofillResult", () => {
  it("deja pasar IDs válidos sin tocar el resto de campos", () => {
    const raw = {
      ...base,
      muscles: [{ muscleId: M1, role: "primary" as const }, { muscleId: M2, role: "secondary" as const }],
      equipment: [E1, E2],
    }
    assert.deepEqual(sanitizeAutofillResult(raw, validMuscles, validEquipment), raw)
  })

  it("descarta IDs fuera del catálogo o mal formados", () => {
    const out = sanitizeAutofillResult(
      {
        ...base,
        muscles: [
          { muscleId: M1, role: "primary" },
          { muscleId: "99999999-9999-9999-9999-999999999999", role: "secondary" },
          { muscleId: "no-es-uuid", role: "primary" },
        ],
        equipment: [E1, "inventado"],
      },
      validMuscles,
      validEquipment,
    )
    assert.deepEqual(out.muscles, [{ muscleId: M1, role: "primary" }])
    assert.deepEqual(out.equipment, [E1])
  })

  it("elimina duplicados y resuelve roles distintos a primary", () => {
    const out = sanitizeAutofillResult(
      {
        ...base,
        muscles: [
          { muscleId: M1, role: "secondary" },
          { muscleId: M1, role: "primary" },
          { muscleId: M2, role: "primary" },
          { muscleId: M2, role: "secondary" },
          { muscleId: M2, role: "secondary" },
        ],
        equipment: [E1, E1, E2],
      },
      validMuscles,
      validEquipment,
    )
    assert.deepEqual(out.muscles, [
      { muscleId: M1, role: "primary" },
      { muscleId: M2, role: "primary" },
    ])
    assert.deepEqual(out.equipment, [E1, E2])
  })
})
