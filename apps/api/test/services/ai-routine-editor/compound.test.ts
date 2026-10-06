import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { detectUnhandledRequest, looksCompound, resolveLeftover } from "../../../src/services/ai-routine-editor/compound"
import { buildFinalMessage } from "../../../src/services/ai-routine-editor/tweak"

describe("pedidos compuestos: lo que NO se hizo", () => {
  it("un pedido simple no declara nada aunque el modelo invente un leftover", () => {
    assert.equal(resolveLeftover("cambia los fondos por otro ejercicio", "replace_with_alternative", "cambiar los fondos"), undefined)
    assert.equal(resolveLeftover("ponle 12 repeticiones al remo", "edit_basic", "ponerle 12 repeticiones"), undefined)
    assert.equal(resolveLeftover("agrega una serie al press", "edit_basic", "cambiar el número de repeticiones"), undefined)
  })
  it("un pedido compuesto conserva lo que dijo el modelo", () => {
    assert.equal(resolveLeftover("cambia los fondos por otro y quita el press", "replace_with_alternative", "quitar el press."), "quitar el press")
  })
  it("si el modelo no dijo nada, se deduce la otra petición (INT-038, GRD-008)", () => {
    assert.equal(resolveLeftover("hazla más difícil y cambia el press banca", "adjust_difficulty"), "cambia el press banca")
    assert.equal(resolveLeftover("agrega un ejercicio de core y de paso sube los pesos de todo", "add_exercise"), "sube los pesos de todo")
    assert.equal(resolveLeftover("baja los descansos y agrega dominadas", "adjust_rest"), "agrega dominadas")
  })
  it("varias peticiones de la misma clase no cuentan como sobrantes", () => {
    assert.equal(detectUnhandledRequest("cambia la sentadilla y la plancha por otros más fáciles", "replace_with_alternative"), undefined)
    assert.equal(detectUnhandledRequest("cambia SOLO la plancha a 4 series, y también el remo a 5 y el press a 6", "edit_basic"), undefined)
    assert.equal(detectUnhandledRequest("sin barra y sin mancuernas, sustitúyelo", "replace_with_alternative"), undefined)
  })
  it("looksCompound distingue una petición de dos", () => {
    assert.equal(looksCompound("sustitúyelo"), false)
    assert.equal(looksCompound("cambia el press y quita la plancha"), true)
  })
})

describe("mensaje final", () => {
  const change = { type: "update_block", itemId: "x", itemKind: "block", blockId: null, summary: "Circuito A: rondas 2 → 3", before: null, after: null } as never
  it("una operación que no cambia nada se dice, no se reporta como fallo", () => {
    const msg = buildFinalMessage({ changes: [], dropped: 0, hadErrors: true, onlyNoops: true })
    assert.match(msg, /ya estaba así/)
    assert.doesNotMatch(buildFinalMessage({ changes: [], dropped: 0, hadErrors: true, onlyNoops: false }), /ya estaba así/)
  })
  it("sin doble punto y con el leftover limpio", () => {
    const msg = buildFinalMessage({ changes: [change], dropped: 0, hadErrors: false, leftover: "quitar el press" })
    assert.equal(msg, "Circuito A: rondas 2 → 3. No hice: quitar el press. Pídelo en otro ajuste.")
  })
})
