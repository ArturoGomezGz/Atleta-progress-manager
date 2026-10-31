import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RoutineContent } from "@atleta/db/schema"
import { summarizeSets, toAssignmentView, toRoutineSummary, toRoutineView } from "../../src/mcp/format"
import { normalizeRoutineContent, routineContentInputSchema } from "../../src/services/routine-content-input"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const content: RoutineContent = {
  v: 1,
  items: [
    {
      type: "block", id: id(2), order: 1, name: "Core", rounds: 3, restBetweenRoundsSeconds: 60,
      exercises: [
        { id: id(21), exerciseId: id(102), order: 1, sets: [{ setNumber: 1, setType: "reps", targetReps: 12 }], perSide: true },
        { id: id(22), exerciseId: id(103), order: 0, sets: [{ setNumber: 1, setType: "time", targetDurationSeconds: 40 }] },
      ],
    },
    {
      type: "exercise", id: id(1), exerciseId: id(101), order: 0, restSeconds: 120, tempo: "3-1-1-0", goal: "strength",
      sets: [1, 2, 3].map((n) => ({ setNumber: n, setType: "reps" as const, targetReps: 5, loadType: "rpe" as const, loadValue: 8 })),
    },
  ],
}

const row = {
  id: id(9), teamId: id(8), name: "Fuerza A", category: "training" as const, kind: "main" as const,
  updatedAt: new Date("2026-10-01T10:00:00.123Z"), archivedAt: null, content,
  exerciseNames: { [id(101)]: "Sentadilla", [id(102)]: "Zancada" },
}

describe("format", () => {
  it("summarizeSets agrupa series iguales y lista las distintas", () => {
    assert.equal(summarizeSets(content.items[1]!.type === "exercise" ? content.items[1]!.sets : []), "3 × 5 reps @ RPE 8")
    assert.equal(
      summarizeSets([
        { setNumber: 2, setType: "reps", targetReps: 8, loadType: "percent_rm", loadValue: 70 },
        { setNumber: 1, setType: "distance", targetDistanceMeters: 400 },
        { setNumber: 3, setType: "amrap", loadType: "fixed_kg", loadValue: 20 },
      ]),
      "400 m · 8 reps @ 70% RM · AMRAP @ 20 kg",
    )
    assert.equal(summarizeSets([]), "sin series")
  })

  it("toRoutineSummary cuenta elementos y ejercicios y expone archived", () => {
    assert.deepEqual(toRoutineSummary(row), {
      id: id(9), name: "Fuerza A", category: "training", kind: "main", updatedAt: "2026-10-01T10:00:00.123Z", archived: false, itemCount: 2, exerciseCount: 3,
    })
    assert.equal(toRoutineSummary({ ...row, archivedAt: new Date() }).archived, true)
  })

  it("outline: ordena por order, posiciones desde 0, nombres y series resumidas", () => {
    const view = toRoutineView(row)
    assert.equal(view.content, undefined)
    const [first, block] = view.items!
    assert.deepEqual(first, {
      type: "exercise", position: 0, id: id(1), exerciseId: id(101), exercise: "Sentadilla", sets: "3 × 5 reps @ RPE 8",
      restSeconds: 120, tempo: "3-1-1-0", goal: "strength",
    })
    assert.equal(block!.type, "block")
    if (block!.type !== "block") return
    assert.equal(block.position, 1)
    assert.deepEqual(block.exercises.map((e) => [e.position, e.exercise, e.sets]), [
      [0, "Ejercicio no disponible", "1 × 40 s"],
      [1, "Zancada", "1 × 12 reps"],
    ])
    assert.equal(block.exercises[1]!.perSide, true)
  })

  it("detail: content en el formato de entrada (round-trip con normalize conserva ids)", () => {
    const view = toRoutineView(row, "detail")
    assert.equal(view.items, undefined)
    assert.deepEqual(view.exerciseNames, row.exerciseNames)
    routineContentInputSchema.parse(view.content) // lo acepta update_routine tal cual
    const again = normalizeRoutineContent(view.content!)
    assert.deepEqual(again.items.map((i) => i.id), [id(1), id(2)])
  })

  it("toAssignmentView: athletes solo para coach y fechas en ISO", () => {
    const s = {
      id: id(5), status: "scheduled" as const, startedAt: new Date("2026-10-02T00:00:00Z"), scheduledDate: "2026-10-10",
      routineId: id(9), routineName: "Fuerza A", planAssignmentId: null,
      kind: "warmup" as const, position: 0, scheduledTime: "07:30",
      athletes: [{ userId: "u1", name: "Ana", status: "scheduled" }],
    }
    assert.deepEqual(toAssignmentView(s, { includeAthletes: true }), {
      sessionId: id(5), routineId: id(9), routineName: "Fuerza A", scheduledDate: "2026-10-10", kind: "warmup", position: 0, scheduledTime: "07:30", startedAt: "2026-10-02T00:00:00.000Z",
      status: "scheduled", planAssignmentId: null, athletes: [{ athleteId: "u1", name: "Ana", status: "scheduled" }],
    })
    assert.equal("athletes" in toAssignmentView(s, { includeAthletes: false }), false)
  })
})
