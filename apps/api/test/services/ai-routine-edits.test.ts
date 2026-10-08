import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RoutineContent } from "@atleta/db/schema"
import { applyEdit, applyEdits, RoutineEditError, type EditOp, type EditOptions } from "../../src/services/ai-routine-edits"
import { routineContentSchema } from "../../src/services/routine-content-schema"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const SQUAT = id(101)
const PRESS = id(102)
const ROW = id(103)
const PLANK = id(104)
const NEW_EX = id(105)

const ITEM_SQUAT = id(1)
const ITEM_PRESS = id(2)
const BLOCK = id(3)
const BLOCK_ROW = id(4)
const BLOCK_PLANK = id(5)

function fixture(): RoutineContent {
  return {
    v: 1,
    items: [
      { type: "exercise", id: ITEM_SQUAT, exerciseId: SQUAT, order: 0, goal: "strength", tempo: "2-1-1-0", restSeconds: 180, notes: "Profundidad paralela",
        sets: [1, 2, 3].map((n) => ({ setNumber: n, setType: "reps" as const, targetReps: 5, loadType: "rpe" as const, loadValue: 8 })) },
      { type: "exercise", id: ITEM_PRESS, exerciseId: PRESS, order: 1, sets: [{ setNumber: 1, setType: "reps", targetReps: 10 }] },
      { type: "block", id: BLOCK, order: 2, name: "Accesorios", rounds: 3, exercises: [
        { id: BLOCK_ROW, exerciseId: ROW, order: 0, restSeconds: 30, sets: [{ setNumber: 1, setType: "reps", targetReps: 8 }] },
        { id: BLOCK_PLANK, exerciseId: PLANK, order: 1, sets: [{ setNumber: 1, setType: "time", targetDurationSeconds: 30 }] },
      ] },
    ],
  }
}

const baseOpts: EditOptions = {
  knownExerciseIds: new Set([NEW_EX]),
  exerciseNames: { [SQUAT]: "Sentadilla", [PRESS]: "Press banca", [ROW]: "Remo", [PLANK]: "Plancha", [NEW_EX]: "Prensa" },
  newId: () => id(900),
}

function fails(fn: () => unknown, match: RegExp) {
  assert.throws(fn, (err) => err instanceof RoutineEditError && match.test(err.message))
}

describe("applyEdits: replace_exercise", () => {
  it("cambia el ejercicio, conserva series/tempo/descanso y el id del ítem", () => {
    const { content, changes } = applyEdit(fixture(), { op: "replace_exercise", itemId: ITEM_SQUAT, newExerciseId: NEW_EX }, baseOpts)
    const item = content.items[0]!
    assert.equal(item.type, "exercise")
    if (item.type !== "exercise") return
    assert.equal(item.id, ITEM_SQUAT)
    assert.equal(item.exerciseId, NEW_EX)
    assert.equal(item.sets.length, 3)
    assert.equal(item.tempo, "2-1-1-0")
    assert.equal(item.restSeconds, 180)
    assert.equal(item.notes, undefined, "las notas del ejercicio anterior se descartan")
    assert.equal(changes.length, 1)
    assert.equal(changes[0]!.type, "replace_exercise")
    assert.equal(changes[0]!.itemId, ITEM_SQUAT)
    assert.equal(changes[0]!.summary, "Cambió Sentadilla por Prensa")
    assert.equal((changes[0]!.before as { exerciseId: string }).exerciseId, SQUAT)
    assert.equal((changes[0]!.after as { exerciseId: string }).exerciseId, NEW_EX)
  })

  it("funciona dentro de un bloque y reporta blockId", () => {
    const { content, changes } = applyEdit(fixture(), { op: "replace_exercise", itemId: BLOCK_ROW, newExerciseId: NEW_EX }, baseOpts)
    const block = content.items[2]!
    assert.equal(block.type === "block" && block.exercises[0]!.exerciseId, NEW_EX)
    assert.equal(changes[0]!.blockId, BLOCK)
  })

  it("permite nuevas series con keepSets=false", () => {
    const { content } = applyEdit(fixture(), {
      op: "replace_exercise", itemId: ITEM_SQUAT, newExerciseId: NEW_EX, keepSets: false,
      sets: [{ setType: "time", targetDurationSeconds: 40 }],
    }, baseOpts)
    const item = content.items[0]!
    assert.deepEqual(item.type === "exercise" && item.sets, [{ setNumber: 1, setType: "time", targetDurationSeconds: 40 }])
  })

  it("exige sets con keepSets=false", () => {
    fails(() => applyEdit(fixture(), { op: "replace_exercise", itemId: ITEM_SQUAT, newExerciseId: NEW_EX, keepSets: false }, baseOpts), /sets/)
  })

  it("rechaza exerciseId que no salió de una búsqueda", () => {
    fails(() => applyEdit(fixture(), { op: "replace_exercise", itemId: ITEM_SQUAT, newExerciseId: id(777) }, baseOpts), /search_exercises/)
  })

  it("rechaza ids de ítem desconocidos y bloques", () => {
    fails(() => applyEdit(fixture(), { op: "replace_exercise", itemId: id(999), newExerciseId: NEW_EX }, baseOpts), /No existe/)
    fails(() => applyEdit(fixture(), { op: "replace_exercise", itemId: BLOCK, newExerciseId: NEW_EX }, baseOpts), /no a bloques/)
  })
})

describe("applyEdits: add_exercise", () => {
  const sets = [{ setType: "reps" as const, targetReps: 12, loadType: "rpe" as const, loadValue: 7 }]

  it("agrega en la posición indicada y renumera", () => {
    const { content, changes } = applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, position: 1, goal: "hypertrophy", sets }, baseOpts)
    assert.deepEqual(content.items.map((i) => i.order), [0, 1, 2, 3])
    assert.equal(content.items[1]!.id, id(900))
    assert.equal(changes[0]!.type, "add_exercise")
    assert.equal(changes[0]!.before, null)
    assert.equal(changes[0]!.itemId, id(900))
  })

  it("agrega al final por defecto y dentro de un bloque", () => {
    const end = applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, sets }, baseOpts).content
    assert.equal(end.items.at(-1)!.id, id(900))
    const inBlock = applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, blockId: BLOCK, position: 0, sets }, baseOpts)
    const block = inBlock.content.items[2]!
    assert.equal(block.type === "block" && block.exercises.length, 3)
    assert.equal(block.type === "block" && block.exercises[0]!.id, id(900))
    assert.equal(inBlock.changes[0]!.blockId, BLOCK)
  })

  it("rechaza ids no obtenidos de búsqueda, bloque inexistente y series vacías", () => {
    fails(() => applyEdit(fixture(), { op: "add_exercise", exerciseId: id(777), sets }, baseOpts), /search_exercises/)
    fails(() => applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, blockId: ITEM_SQUAT, sets }, baseOpts), /no es un bloque/)
    fails(() => applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, sets: [] }, baseOpts), /inválida/)
  })

  it("no inventa fixed_kg ni percent_rm sin permiso", () => {
    fails(() => applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, sets: [{ setType: "reps", targetReps: 5, loadType: "fixed_kg", loadValue: 60 }] }, baseOpts), /fixed_kg/)
    fails(() => applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, sets: [{ setType: "reps", targetReps: 5, loadType: "percent_rm", loadValue: 80 }] }, baseOpts), /percent_rm/)
    const ok = applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, sets: [{ setType: "reps", targetReps: 5, loadType: "fixed_kg", loadValue: 60 }] }, { ...baseOpts, allowFixedKg: true })
    assert.equal(ok.changes.length, 1)
  })
})

describe("applyEdits: remove_item", () => {
  it("elimina un ejercicio suelto y un bloque completo", () => {
    const one = applyEdit(fixture(), { op: "remove_item", itemId: ITEM_PRESS }, baseOpts)
    assert.equal(one.content.items.length, 2)
    assert.deepEqual(one.content.items.map((i) => i.order), [0, 1])
    assert.equal(one.changes[0]!.after, null)
    assert.equal(one.changes[0]!.summary, "Eliminó Press banca")

    const block = applyEdit(fixture(), { op: "remove_item", itemId: BLOCK }, baseOpts)
    assert.equal(block.content.items.length, 2)
    assert.equal(block.changes[0]!.itemKind, "block")
  })

  it("quita un ejercicio de un bloque pero no deja el bloque vacío", () => {
    const { content } = applyEdit(fixture(), { op: "remove_item", itemId: BLOCK_ROW }, baseOpts)
    const block = content.items[2]!
    assert.equal(block.type === "block" && block.exercises.length, 1)
    assert.equal(block.type === "block" && block.exercises[0]!.order, 0)
    fails(() => applyEdits(fixture(), [
      { op: "remove_item", itemId: BLOCK_ROW }, { op: "remove_item", itemId: BLOCK_PLANK },
    ], baseOpts), /vacío/)
  })

  it("rechaza id desconocido", () => {
    fails(() => applyEdit(fixture(), { op: "remove_item", itemId: id(999) }, baseOpts), /No existe/)
  })
})

describe("applyEdits: move_item", () => {
  it("reordena el nivel superior", () => {
    const { content, changes } = applyEdit(fixture(), { op: "move_item", itemId: ITEM_SQUAT, toPosition: 1 }, baseOpts)
    assert.deepEqual(content.items.map((i) => i.id), [ITEM_PRESS, ITEM_SQUAT, BLOCK])
    assert.deepEqual(changes[0]!.before, { blockId: null, position: 0 })
    assert.deepEqual(changes[0]!.after, { blockId: null, position: 1 })
  })

  it("mete un ejercicio suelto en un bloque y lo saca de nuevo", () => {
    const into = applyEdit(fixture(), { op: "move_item", itemId: ITEM_PRESS, toBlockId: BLOCK, toPosition: 0 }, baseOpts).content
    const block = into.items.find((i) => i.type === "block")!
    assert.equal(block.type === "block" && block.exercises[0]!.id, ITEM_PRESS)
    assert.equal(into.items.length, 2)
    assert.ok(routineContentSchema.safeParse(into).success)

    const out = applyEdit(into, { op: "move_item", itemId: ITEM_PRESS, toPosition: 0 }, baseOpts).content
    assert.equal(out.items[0]!.id, ITEM_PRESS)
    assert.equal(out.items[0]!.type, "exercise")
  })

  it("rechaza anidar bloques, posición idéntica y destinos inválidos", () => {
    fails(() => applyEdit(fixture(), { op: "move_item", itemId: BLOCK, toBlockId: BLOCK, toPosition: 0 }, baseOpts), /bloque/)
    fails(() => applyEdit(fixture(), { op: "move_item", itemId: ITEM_SQUAT, toPosition: 0 }, baseOpts), /ya está/)
    fails(() => applyEdit(fixture(), { op: "move_item", itemId: ITEM_SQUAT, toBlockId: ITEM_PRESS, toPosition: 0 }, baseOpts), /no es un bloque/)
  })
})

describe("applyEdits: update_sets / update_item_fields / update_block", () => {
  it("update_sets reemplaza las series y numera desde 1", () => {
    const { content, changes } = applyEdit(fixture(), {
      op: "update_sets", itemId: ITEM_SQUAT,
      sets: [{ setType: "reps", targetReps: 3, loadType: "rpe", loadValue: 9 }, { setType: "reps", targetReps: 3, loadType: "rpe", loadValue: 9 }],
    }, baseOpts)
    const item = content.items[0]!
    assert.deepEqual(item.type === "exercise" && item.sets.map((s) => s.setNumber), [1, 2])
    assert.equal((changes[0]!.before as { sets: unknown[] }).sets.length, 3)
    assert.equal((changes[0]!.after as { sets: unknown[] }).sets.length, 2)
  })

  it("update_sets permite repetir un fixed_kg que ya existía", () => {
    const base = fixture()
    const first = base.items[1]!
    if (first.type === "exercise") first.sets = [{ setNumber: 1, setType: "reps", targetReps: 5, loadType: "fixed_kg", loadValue: 100 }]
    const ok = applyEdit(base, { op: "update_sets", itemId: ITEM_PRESS, sets: [{ setType: "reps", targetReps: 6, loadType: "fixed_kg", loadValue: 100 }] }, baseOpts)
    assert.equal(ok.changes.length, 1)
    fails(() => applyEdit(base, { op: "update_sets", itemId: ITEM_PRESS, sets: [{ setType: "reps", targetReps: 6, loadType: "fixed_kg", loadValue: 110 }] }, baseOpts), /fixed_kg/)
  })

  it("update_item_fields cambia, borra con null y reporta before/after", () => {
    const { content, changes } = applyEdit(fixture(), { op: "update_item_fields", itemId: ITEM_SQUAT, restSeconds: 120, tempo: null, notes: "Pausa abajo" }, baseOpts)
    const item = content.items[0]!
    assert.equal(item.type === "exercise" && item.restSeconds, 120)
    assert.equal(item.type === "exercise" && item.tempo, undefined)
    assert.equal(item.type === "exercise" && item.notes, "Pausa abajo")
    assert.deepEqual(changes[0]!.before, { restSeconds: 180, tempo: "2-1-1-0", notes: "Profundidad paralela" })
    assert.deepEqual(changes[0]!.after, { restSeconds: 120, tempo: null, notes: "Pausa abajo" })
  })

  it("update_item_fields rechaza tempo inválido y operaciones sin efecto", () => {
    fails(() => applyEdit(fixture(), { op: "update_item_fields", itemId: ITEM_SQUAT, tempo: "lento" }, baseOpts), /inválida/)
    fails(() => applyEdit(fixture(), { op: "update_item_fields", itemId: ITEM_SQUAT, restSeconds: 180 }, baseOpts), /no cambia/)
  })

  it("update_block cambia rondas y nombre; rounds < 2 se rechaza", () => {
    const { content, changes } = applyEdit(fixture(), { op: "update_block", itemId: BLOCK, rounds: 4, name: "Superserie" }, baseOpts)
    const block = content.items[2]!
    assert.equal(block.type === "block" && block.rounds, 4)
    assert.equal(block.type === "block" && block.name, "Superserie")
    assert.equal(changes[0]!.itemKind, "block")
    assert.deepEqual(changes[0]!.before, { rounds: 3, name: "Accesorios" })
    fails(() => applyEdit(fixture(), { op: "update_block", itemId: BLOCK, rounds: 1 }, baseOpts), /inválida/)
    fails(() => applyEdit(fixture(), { op: "update_block", itemId: ITEM_SQUAT, rounds: 3 }, baseOpts), /bloques/)
  })
})

describe("applyEdits: propiedades generales", () => {
  it("no muta el contenido original", () => {
    const original = fixture()
    const snapshot = structuredClone(original)
    applyEdits(original, [
      { op: "remove_item", itemId: ITEM_PRESS },
      { op: "update_block", itemId: BLOCK, rounds: 5 },
    ], baseOpts)
    assert.deepEqual(original, snapshot)
  })

  it("es atómica: si una operación falla no se devuelve nada y el error trae el índice", () => {
    const ops: EditOp[] = [
      { op: "remove_item", itemId: ITEM_PRESS },
      { op: "remove_item", itemId: id(999) },
    ]
    assert.throws(() => applyEdits(fixture(), ops, baseOpts), (err) => err instanceof RoutineEditError && err.opIndex === 1)
  })

  it("aplica varias operaciones en orden y el resultado pasa el zod de la rutina", () => {
    const { content, changes } = applyEdits(fixture(), [
      { op: "replace_exercise", itemId: ITEM_PRESS, newExerciseId: NEW_EX },
      { op: "move_item", itemId: ITEM_PRESS, toPosition: 0 },
      { op: "update_item_fields", itemId: ITEM_PRESS, goal: "hypertrophy" },
    ], baseOpts)
    assert.equal(changes.length, 3)
    assert.equal(content.items[0]!.id, ITEM_PRESS)
    assert.ok(routineContentSchema.safeParse(content).success)
    assert.deepEqual(content.items.map((i) => i.order), [0, 1, 2])
  })

  it("rechaza operaciones mal formadas", () => {
    assert.throws(() => applyEdits(fixture(), [{ op: "explode" } as unknown as EditOp], baseOpts), RoutineEditError)
    assert.throws(() => applyEdits(fixture(), [{ op: "remove_item", itemId: "no-uuid" } as EditOp], baseOpts), RoutineEditError)
  })

  it("respeta el máximo de ítems", () => {
    let content = fixture()
    const sets = [{ setType: "reps" as const, targetReps: 5 }]
    for (let i = content.items.length; i < 20; i++) content = applyEdit(content, { op: "add_exercise", exerciseId: NEW_EX, sets }, { ...baseOpts, newId: () => id(2000 + i) }).content
    assert.equal(content.items.length, 20)
    fails(() => applyEdit(content, { op: "add_exercise", exerciseId: NEW_EX, sets }, baseOpts), /máximo/)
  })
})

describe("applyEdits: por cada lado (perSide)", () => {
  it("el esquema del contenido acepta perSide opcional y rechaza valores no booleanos", () => {
    const content = fixture()
    const plank = content.items[2]!
    if (plank.type !== "block") throw new Error("fixture")
    plank.exercises[1]!.perSide = true
    assert.equal(routineContentSchema.safeParse(content).success, true)
    assert.equal(routineContentSchema.safeParse(fixture()).success, true, "sin perSide sigue siendo válido")
    ;(plank.exercises[1] as unknown as Record<string, unknown>).perSide = "sí"
    assert.equal(routineContentSchema.safeParse(content).success, false)
  })

  it("update_item_fields marca perSide y con false lo quita del contenido", () => {
    const on = applyEdit(fixture(), { op: "update_item_fields", itemId: ITEM_SQUAT, perSide: true }, baseOpts)
    const item = on.content.items[0]!
    assert.equal(item.type === "exercise" && item.perSide, true)
    assert.deepEqual(on.changes[0]!.after, { perSide: true })
    assert.match(on.changes[0]!.summary, /por cada lado/)

    const off = applyEdit(on.content, { op: "update_item_fields", itemId: ITEM_SQUAT, perSide: false }, baseOpts)
    const item2 = off.content.items[0]!
    assert.equal(item2.type === "exercise" && "perSide" in item2, false)
    fails(() => applyEdit(fixture(), { op: "update_item_fields", itemId: ITEM_SQUAT, perSide: false }, baseOpts), /no cambia/)
  })

  it("add_exercise guarda perSide y otras ediciones lo conservan", () => {
    const sets = [{ setType: "time" as const, targetDurationSeconds: 30 }]
    const added = applyEdit(fixture(), { op: "add_exercise", exerciseId: NEW_EX, perSide: true, sets }, baseOpts)
    const ex = added.content.items.find((i) => i.id === id(900))!
    assert.equal(ex.type === "exercise" && ex.perSide, true)

    const withSide = applyEdit(fixture(), { op: "update_item_fields", itemId: ITEM_SQUAT, perSide: true }, baseOpts).content
    const edited = applyEdits(withSide, [
      { op: "update_sets", itemId: ITEM_SQUAT, sets: [{ setType: "reps", targetReps: 12 }] },
      { op: "replace_exercise", itemId: ITEM_SQUAT, newExerciseId: NEW_EX },
      { op: "move_item", itemId: ITEM_SQUAT, toPosition: 1 },
    ], baseOpts)
    const moved = edited.content.items.find((i) => i.id === ITEM_SQUAT)!
    assert.equal(moved.type === "exercise" && moved.perSide, true)
  })
})
