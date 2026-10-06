import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { RoutineContent } from "@atleta/db/schema"
import { diffRoutine, sameValue } from "../src/lib/ai-routine-diff"

const A = "00000000-0000-4000-8000-000000000101"
const B = "00000000-0000-4000-8000-000000000102"
const C = "00000000-0000-4000-8000-000000000103"
const names: Record<string, string> = { [A]: "Squat", [B]: "Bench", [C]: "Row" }
const nameOf = (id: string) => names[id] ?? id

const set = (n: number) => ({ setNumber: n, setType: "reps" as const, targetReps: 8, loadType: "rpe" as const, loadValue: 7 })
const ex = (id: string, exerciseId: string, order: number) => ({
  type: "exercise" as const, id, exerciseId, order, restSeconds: 90, sets: [set(1), set(2)],
})
const base = (): RoutineContent => ({ v: 1, items: [ex("i1", A, 0), ex("i2", B, 1), ex("i3", C, 2)] })

/** Misma información con otro orden de claves (como lo devuelve zod). */
function reorderKeys<T>(v: T): T {
  if (Array.isArray(v)) return v.map(reorderKeys) as T
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorderKeys(x)])) as T
  }
  return v
}

describe("sameValue", () => {
  it("ignora el orden de claves y undefined/null/ausente", () => {
    assert.equal(sameValue({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }), true)
    assert.equal(sameValue({ a: 1, b: undefined }, { a: 1 }), true)
    assert.equal(sameValue({ a: 1, b: null }, { a: 1 }), true)
    assert.equal(sameValue({ a: 1 }, { a: 2 }), false)
    assert.equal(sameValue([1, 2], [2, 1]), false)
    assert.equal(sameValue([1], [1, 2]), false)
  })
})

describe("diffRoutine", () => {
  it("mismo contenido con otro orden de claves da 0 cambios", () => {
    const d = diffRoutine(base(), reorderKeys(base()), nameOf, [])
    assert.equal(d.entries.length, 0)
    assert.equal(d.changedIds.length, 0)
    assert.equal(d.preview.size, 0)
  })

  it("campos opcionales undefined vs ausentes no cuentan", () => {
    const after = base()
    ;(after.items[0] as { notes?: string }).notes = undefined
    assert.equal(diffRoutine(base(), reorderKeys(after), nameOf, []).entries.length, 0)
  })

  it("un cambio real produce exactamente una entrada", () => {
    const after = reorderKeys(base())
    const it = after.items.find((i) => i.id === "i2")
    if (it?.type !== "exercise") throw new Error("x")
    it.sets = it.sets.map((s) => ({ ...s, loadValue: 8 }))
    const d = diffRoutine(base(), after, nameOf, [])
    assert.equal(d.entries.length, 1)
    assert.equal(d.entries[0]!.id, "i2")
    assert.equal(d.entries[0]!.type, "modified")
  })

  it("un reemplazo de ejercicio cuenta como un solo cambio", () => {
    const after = reorderKeys(base())
    const it = after.items.find((i) => i.id === "i1")
    if (it?.type !== "exercise") throw new Error("x")
    it.exerciseId = C
    const d = diffRoutine(base(), after, nameOf, [])
    assert.equal(d.entries.length, 1)
    assert.deepEqual(d.preview.get("i1")?.name, { before: "Squat", after: "Row" })
  })

  it("detecta ítem movido", () => {
    const after = reorderKeys(base())
    after.items.forEach((i) => { i.order = i.id === "i3" ? 0 : i.order + 1 })
    const d = diffRoutine(base(), after, nameOf, [])
    assert.equal(d.entries.length, 1)
    assert.equal(d.entries[0]!.type, "moved")
    assert.equal(d.entries[0]!.id, "i3")
  })

  it("detecta ítem agregado y eliminado", () => {
    const added = reorderKeys(base())
    added.items.push(ex("i4", A, 3))
    const da = diffRoutine(base(), added, nameOf, [])
    assert.deepEqual(da.entries.map((e) => [e.id, e.type]), [["i4", "added"]])

    const removed = reorderKeys(base())
    removed.items = removed.items.filter((i) => i.id !== "i2")
    removed.items.forEach((i, n) => { i.order = n })
    const dr = diffRoutine(base(), removed, nameOf, [])
    assert.deepEqual(dr.entries.map((e) => [e.id, e.type]), [["i2", "removed"]])
  })
})
