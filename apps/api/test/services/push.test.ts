import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { notifyWorkoutAssigned, pushEnabled } from "../../src/services/push"

describe("push", () => {
  it("sin FIREBASE_SERVICE_ACCOUNT queda desactivado y notificar no hace nada ni lanza", async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT
    assert.equal(pushEnabled(), false)
    await notifyWorkoutAssigned({
      coachId: "c", athleteIds: ["a"], routineId: "00000000-0000-0000-0000-000000000000",
      sessionIds: ["s"], dates: [null], today: "2026-10-29",
    })
  })
})
