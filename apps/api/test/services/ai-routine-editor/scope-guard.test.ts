import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RoutineContent } from "@atleta/db/schema"
import { applyEdit, type EditOp } from "../../../src/services/ai-routine-edits"
import { guardChanges, outOfScopeReason, type ScopeContext } from "../../../src/services/ai-routine-editor/scope-guard"
import type { AppliedOp } from "../../../src/services/ai-routine-editor/types"
import { content, ITEM_DIPS, ITEM_PRESS, ITEM_ROW, ITEM_SQUAT, NAMES, NEW_EX } from "./helpers"

const opts = { knownExerciseIds: new Set([NEW_EX]), exerciseNames: NAMES, allowFixedKg: false }

/** Aplica ops en orden como lo haría el runtime y devuelve el contenido final y las ops registradas. */
function applyAll(original: RoutineContent, ops: EditOp[]) {
  let working = original
  const applied: AppliedOp[] = []
  for (const op of ops) {
    const res = applyEdit(working, op, opts)
    working = res.content
    applied.push({ op, change: res.changes[0]! })
  }
  return { working, applied }
}

const harder = (itemId: string): EditOp => ({ op: "update_sets", itemId, sets: [{ setType: "reps", targetReps: 5, loadType: "rpe", loadValue: 9 }] })

describe("guardián de alcance", () => {
  it("reproduce el bug de producción: reemplazo correcto + update_sets sueltos en otros ítems -> se quitan", () => {
    const original = content()
    const ctx: ScopeContext = { intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], original }
    const { working, applied } = applyAll(original, [
      { op: "replace_exercise", itemId: ITEM_DIPS, newExerciseId: NEW_EX },
      harder(ITEM_SQUAT), harder(ITEM_PRESS), harder(ITEM_ROW),
    ])
    const guarded = guardChanges(ctx, applied, working, opts)
    assert.equal(guarded.changes.length, 1)
    assert.equal(guarded.changes[0]!.type, "replace_exercise")
    assert.equal(guarded.dropped.length, 3)
    assert.ok(guarded.dropped.every((d) => d.type === "update_sets"))
    // El resultado conserva el reemplazo y deja intactos los demás ítems
    const byId = (id: string) => guarded.content.items.find((i) => i.id === id)
    assert.equal(byId(ITEM_DIPS)!.type === "exercise" && (byId(ITEM_DIPS) as { exerciseId: string }).exerciseId, NEW_EX)
    assert.deepEqual(byId(ITEM_SQUAT), original.items.find((i) => i.id === ITEM_SQUAT))
    assert.deepEqual(byId(ITEM_ROW), original.items.find((i) => i.id === ITEM_ROW))
  })

  it("sin cambios fuera de alcance devuelve el contenido de trabajo tal cual", () => {
    const original = content()
    const { working, applied } = applyAll(original, [{ op: "replace_exercise", itemId: ITEM_DIPS, newExerciseId: NEW_EX }])
    const guarded = guardChanges({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], original }, applied, working, opts)
    assert.equal(guarded.content, working)
    assert.equal(guarded.dropped.length, 0)
  })

  it("replace_with_alternative: permite ajustar series del ítem objetivo, pero no agregar ni quitar", () => {
    const original = content()
    const ctx: ScopeContext = { intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], original }
    const { applied } = applyAll(original, [
      { op: "update_sets", itemId: ITEM_DIPS, sets: [{ setType: "time", targetDurationSeconds: 30 }] },
      { op: "remove_item", itemId: ITEM_ROW },
      { op: "add_exercise", exerciseId: NEW_EX, sets: [{ setType: "reps", targetReps: 10 }] },
    ])
    assert.equal(outOfScopeReason(applied[0]!, ctx), null)
    assert.match(outOfScopeReason(applied[1]!, ctx)!, /remove_item no está permitido/)
    assert.match(outOfScopeReason(applied[2]!, ctx)!, /add_exercise no está permitido/)
  })

  it("adjust_difficulty: no permite reemplazar, agregar ni quitar, ni cambiar el trabajo por serie con la palanca de intensidad", () => {
    const original = content()
    const ctx: ScopeContext = { intent: "adjust_difficulty", targetItemIds: [], knob: "intensity", original }
    const { applied } = applyAll(original, [
      { op: "update_sets", itemId: ITEM_SQUAT, sets: Array.from({ length: 3 }, () => ({ setType: "reps" as const, targetReps: 5, loadType: "rpe" as const, loadValue: 8 })) },
      { op: "update_sets", itemId: ITEM_PRESS, sets: [{ setType: "reps", targetReps: 12, loadType: "rpe", loadValue: 7 }] },
      { op: "replace_exercise", itemId: ITEM_ROW, newExerciseId: NEW_EX },
      { op: "remove_item", itemId: ITEM_DIPS },
    ])
    assert.equal(outOfScopeReason(applied[0]!, ctx), null)
    assert.ok(outOfScopeReason(applied[1]!, ctx), "cambió reps y número de series: eso es volumen")
    assert.ok(outOfScopeReason(applied[2]!, ctx))
    assert.ok(outOfScopeReason(applied[3]!, ctx))
  })

  it("adjust_rest: solo descansos", () => {
    const original = content()
    const ctx: ScopeContext = { intent: "adjust_rest", targetItemIds: [], original }
    const { applied } = applyAll(original, [
      { op: "update_item_fields", itemId: ITEM_SQUAT, restSeconds: 90 },
      { op: "update_item_fields", itemId: ITEM_PRESS, notes: "otra cosa" },
      harder(ITEM_ROW),
    ])
    assert.equal(outOfScopeReason(applied[0]!, ctx), null)
    assert.ok(outOfScopeReason(applied[1]!, ctx))
    assert.ok(outOfScopeReason(applied[2]!, ctx))
  })

  it("edit_basic: solo sobre los ítems objetivo", () => {
    const original = content()
    const ctx: ScopeContext = { intent: "edit_basic", targetItemIds: [ITEM_PRESS], original }
    const { applied } = applyAll(original, [{ op: "update_item_fields", itemId: ITEM_PRESS, restSeconds: 45 }, { op: "update_item_fields", itemId: ITEM_ROW, restSeconds: 45 }])
    assert.equal(outOfScopeReason(applied[0]!, ctx), null)
    assert.ok(outOfScopeReason(applied[1]!, ctx))
  })

  it("descarta también las operaciones que dependían de una descartada", () => {
    const original = content()
    // add_exercise fuera de alcance (intent replace) y luego un update_sets sobre el ítem nuevo
    const first = applyEdit(original, { op: "add_exercise", exerciseId: NEW_EX, sets: [{ setType: "reps", targetReps: 10 }] }, opts)
    const newId = first.changes[0]!.itemId
    const second = applyEdit(first.content, { op: "update_sets", itemId: newId, sets: [{ setType: "reps", targetReps: 12 }] }, opts)
    const third = applyEdit(second.content, { op: "replace_exercise", itemId: ITEM_DIPS, newExerciseId: NEW_EX }, opts)
    const applied: AppliedOp[] = [
      { op: { op: "add_exercise", exerciseId: NEW_EX, sets: [{ setType: "reps", targetReps: 10 }] }, change: first.changes[0]! },
      { op: { op: "update_sets", itemId: newId, sets: [{ setType: "reps", targetReps: 12 }] }, change: second.changes[0]! },
      { op: { op: "replace_exercise", itemId: ITEM_DIPS, newExerciseId: NEW_EX }, change: third.changes[0]! },
    ]
    const guarded = guardChanges({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], original }, applied, third.content, opts)
    assert.equal(guarded.changes.length, 1)
    assert.equal(guarded.content.items.length, original.items.length)
  })
})
