import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addDays,
  computePlanCalendar,
  isoWeekday,
  mondayOf,
  workoutDate,
  type PlanCalendarWorkout,
} from "../../src/services/plan-calendar"

const R = "routine-1"
let seq = 0
const w = (weekNumber: number, weekday: number, extra: Partial<PlanCalendarWorkout> = {}): PlanCalendarWorkout => ({
  id: `w${++seq}`,
  weekNumber,
  weekday,
  position: 0,
  routineId: R,
  ...extra,
})

describe("plan-calendar", () => {
  it("weekday ISO, lunes de la semana y suma de días", () => {
    assert.equal(isoWeekday("2026-10-19"), 1) // lunes
    assert.equal(isoWeekday("2026-10-24"), 6) // sábado
    assert.equal(isoWeekday("2026-10-25"), 7) // domingo
    assert.equal(mondayOf("2026-10-19"), "2026-10-19")
    assert.equal(mondayOf("2026-10-25"), "2026-10-19")
    assert.equal(addDays("2026-10-31", 1), "2026-11-01")
    assert.equal(addDays("2026-11-01", -1), "2026-10-31")
    assert.throws(() => mondayOf("2026-02-30"))
  })

  it("alinea la semana 1 al lunes de startDate", () => {
    assert.equal(workoutDate("2026-10-19", 1, 1), "2026-10-19")
    assert.equal(workoutDate("2026-10-19", 1, 7), "2026-10-25")
    assert.equal(workoutDate("2026-10-19", 2, 3), "2026-10-28")
    assert.equal(workoutDate("2026-10-19", 4, 5), "2026-11-13")
    // startDate en sábado: la semana 1 sigue empezando el lunes anterior
    assert.equal(workoutDate("2026-10-24", 1, 1), "2026-10-19")
    assert.equal(workoutDate("2026-10-24", 2, 1), "2026-10-26")

    const { entries, skipped } = computePlanCalendar({
      startDate: "2026-10-19",
      today: "2026-10-01",
      workouts: [w(2, 1), w(1, 1), w(1, 3), w(1, 5)],
    })
    assert.deepEqual(entries.map((e) => [e.date, e.week, e.weekday]), [
      ["2026-10-19", 1, 1],
      ["2026-10-21", 1, 3],
      ["2026-10-23", 1, 5],
      ["2026-10-26", 2, 1],
    ])
    assert.deepEqual(skipped, [])
  })

  it("inicio a mitad de semana: los días anteriores a startDate → before_start", () => {
    const mon = w(1, 1)
    const wed = w(1, 3)
    const thu = w(1, 4)
    const nextMon = w(2, 1)
    const { entries, skipped } = computePlanCalendar({ startDate: "2026-10-21", today: "2026-10-01", workouts: [mon, wed, thu, nextMon] })
    assert.deepEqual(entries.map((e) => e.workoutId), [wed.id, thu.id, nextMon.id])
    assert.deepEqual(entries.map((e) => e.date), ["2026-10-21", "2026-10-22", "2026-10-26"])
    assert.deepEqual(skipped, [{ workoutId: mon.id, week: 1, weekday: 1, reason: "before_start" }])
  })

  it("huecos antes de hoy → past (hoy sí se programa)", () => {
    const a = w(1, 1)
    const b = w(1, 3)
    const c = w(1, 4)
    const { entries, skipped } = computePlanCalendar({ startDate: "2026-10-19", today: "2026-10-21", workouts: [a, b, c] })
    assert.deepEqual(entries.map((e) => [e.workoutId, e.date]), [[b.id, "2026-10-21"], [c.id, "2026-10-22"]])
    assert.deepEqual(skipped, [{ workoutId: a.id, week: 1, weekday: 1, reason: "past" }])
  })

  it("hueco sin rutina → no_routine; before_start tiene prioridad", () => {
    const noRoutine = w(1, 5, { routineId: null })
    const beforeAndNoRoutine = w(1, 1, { routineId: null })
    const { entries, skipped } = computePlanCalendar({
      startDate: "2026-10-20",
      today: "2026-10-01",
      workouts: [noRoutine, beforeAndNoRoutine, w(1, 2)],
    })
    assert.equal(entries.length, 1)
    assert.deepEqual(skipped.map((s) => [s.workoutId, s.reason]), [
      [beforeAndNoRoutine.id, "before_start"],
      [noRoutine.id, "no_routine"],
    ])
  })

  it("cruza el cambio de año", () => {
    // 2026-12-30 es miércoles: la semana 1 empieza el lunes 2026-12-28
    const { entries } = computePlanCalendar({
      startDate: "2026-12-30",
      today: "2026-12-01",
      workouts: [w(1, 3), w(1, 7), w(2, 1), w(2, 5)],
    })
    assert.deepEqual(entries.map((e) => e.date), ["2026-12-30", "2027-01-03", "2027-01-04", "2027-01-08"])
  })

  it("29 de febrero de 2028 (bisiesto)", () => {
    // 2028-02-24 es jueves; la semana 2 empieza el lunes 2028-02-28
    const { entries } = computePlanCalendar({
      startDate: "2028-02-24",
      today: "2028-01-01",
      workouts: [w(2, 1), w(2, 2), w(2, 3)],
    })
    assert.deepEqual(entries.map((e) => e.date), ["2028-02-28", "2028-02-29", "2028-03-01"])
    assert.equal(workoutDate("2028-02-29", 1, 2), "2028-02-29")
  })

  it("varios entrenamientos el mismo día se ordenan por position", () => {
    const late = w(1, 2, { position: 2, routineId: "r-c" })
    const first = w(1, 2, { position: 0, routineId: "r-a" })
    const mid = w(1, 2, { position: 1, routineId: "r-b" })
    const monday = w(1, 1, { position: 5 })
    const { entries } = computePlanCalendar({ startDate: "2026-10-19", today: "2026-10-19", workouts: [late, first, monday, mid] })
    assert.deepEqual(entries.map((e) => e.workoutId), [monday.id, first.id, mid.id, late.id])
    assert.deepEqual(entries.slice(1).map((e) => [e.date, e.position, e.routineId]), [
      ["2026-10-20", 0, "r-a"],
      ["2026-10-20", 1, "r-b"],
      ["2026-10-20", 2, "r-c"],
    ])
  })
})
