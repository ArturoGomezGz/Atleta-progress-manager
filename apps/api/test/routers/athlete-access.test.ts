import assert from "node:assert/strict"
import { test } from "node:test"
import { canViewAthlete } from "../../src/routers/teams"

test("coach puede ver los datos de otro atleta", () => {
  assert.equal(canViewAthlete({ role: "coach", userId: "coach-1", athleteId: "athlete-1" }), true)
})

test("atleta puede ver sus propios datos", () => {
  assert.equal(canViewAthlete({ role: "athlete", userId: "athlete-1", athleteId: "athlete-1" }), true)
})

test("atleta no puede ver los datos de otro atleta", () => {
  assert.equal(canViewAthlete({ role: "athlete", userId: "athlete-1", athleteId: "athlete-2" }), false)
})

test("coach con selfAthlete (role sigue siendo coach) puede ver sus propios datos", () => {
  assert.equal(canViewAthlete({ role: "coach", userId: "coach-1", athleteId: "coach-1" }), true)
})
