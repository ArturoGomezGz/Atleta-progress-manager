import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { defaultPositionForKind, resolveRoutineKind, toHHMM } from "../../src/services/routine-kind"
import { calendarDate } from "../../src/services/session-calendar"
import { resolveAthleteToday } from "../../src/services/session-assign"

const now = new Date("2026-10-31T23:30:00Z")

describe("resolveAthleteToday", () => {
  it("acepta la fecha local a ±1 día de UTC", () => {
    assert.equal(resolveAthleteToday("2026-11-01", now), "2026-11-01")
    assert.equal(resolveAthleteToday("2026-10-30", now), "2026-10-30")
    assert.equal(resolveAthleteToday("2026-10-31", now), "2026-10-31")
  })
  it("ignora fechas lejanas o inválidas y usa UTC", () => {
    assert.equal(resolveAthleteToday("2026-11-02", now), "2026-10-31")
    assert.equal(resolveAthleteToday("2030-01-01", now), "2026-10-31")
    assert.equal(resolveAthleteToday("basura", now), "2026-10-31")
    assert.equal(resolveAthleteToday(undefined, now), "2026-10-31")
  })
})

describe("tipo de rutina", () => {
  it("orden por defecto warmup 0, main 1, recovery 2", () => {
    assert.deepEqual(["warmup", "main", "recovery"].map((k) => defaultPositionForKind(k as "main")), [0, 1, 2])
    assert.equal(defaultPositionForKind(null), 0)
  })
  it("training sin kind → main; evaluation → null y rechaza un kind", () => {
    assert.equal(resolveRoutineKind("training", undefined), "main")
    assert.equal(resolveRoutineKind("training", undefined, "recovery"), "recovery")
    assert.equal(resolveRoutineKind("training", "warmup", "main"), "warmup")
    assert.equal(resolveRoutineKind("evaluation", undefined), null)
    assert.throws(() => resolveRoutineKind("evaluation", "main"), /no tienen tipo/)
  })
  it("toHHMM recorta los segundos de Postgres", () => {
    assert.equal(toHHMM("08:30:00"), "08:30")
    assert.equal(toHHMM(null), null)
  })
})

describe("calendarDate", () => {
  const base = { startedAt: new Date("2026-10-20T10:00:00Z"), today: "2026-10-31" }
  it("con fecha programada, esa fecha", () => {
    assert.equal(calendarDate({ ...base, scheduledDate: "2026-11-05", athleteStatus: "scheduled" }), "2026-11-05")
  })
  it("sin fecha: hoy si sigue pendiente; si no, el día de creación", () => {
    assert.equal(calendarDate({ ...base, scheduledDate: null, athleteStatus: "scheduled" }), "2026-10-31")
    assert.equal(calendarDate({ ...base, scheduledDate: null, athleteStatus: "active" }), "2026-10-31")
    assert.equal(calendarDate({ ...base, scheduledDate: null, athleteStatus: "completed" }), "2026-10-20")
    assert.equal(calendarDate({ ...base, scheduledDate: null, athleteStatus: "cancelled" }), "2026-10-20")
  })
})
