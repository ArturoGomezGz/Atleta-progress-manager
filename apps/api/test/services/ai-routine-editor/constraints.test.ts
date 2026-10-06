import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { rankAlternatives, type AlternativeInfo } from "../../../src/services/ai-routine-editor/alternatives"
import { extractAvoidFromMessage, matchesAvoid, normalizeAvoid } from "../../../src/services/ai-routine-editor/avoid"
import { detectInjuries, familyOf, messageWantsEasier, natureOf } from "../../../src/services/ai-routine-editor/constraints"

const ex = (id: string, name: string, over: Partial<AlternativeInfo> = {}): AlternativeInfo => ({
  id, name, difficulty: "intermediate", patterns: ["squat"], primaryMuscles: ["Quadriceps"], bodyZones: ["lower"], equipment: [], ...over,
})
const names = (list: { name: string }[]) => list.map((c) => c.name)

describe("avoid en español contra catálogo en inglés (N-04)", () => {
  it("'saltos' excluye Depth Jump y Box Jump", () => {
    const avoid = normalizeAvoid(["saltos"])
    assert.equal(matchesAvoid({ name: "Depth Jump" }, avoid), true)
    assert.equal(matchesAvoid({ name: "Barbell Front Squat", equipment: ["Barbell"] }, avoid), false)
  })
  it("'barra' y 'mancuernas' excluyen equipo/nombres en inglés", () => {
    assert.equal(matchesAvoid({ name: "Barbell Floor Press", equipment: ["Barbell"] }, normalizeAvoid(["barra"])), true)
    assert.equal(matchesAvoid({ name: "Dumbbell Pullover", equipment: ["Dumbbell"] }, normalizeAvoid(["mancuernas"])), true)
  })
  it("'no tengo barra ni nada' / 'solo peso corporal' = sin ningún equipo", () => {
    const avoid = extractAvoidFromMessage("no tengo barra ni nada")
    assert.ok(avoid.includes("equipo"))
    assert.equal(matchesAvoid({ name: "Bosu Push Up", equipment: ["Bosu"] }, avoid), true)
    assert.equal(matchesAvoid({ name: "Push Ups", equipment: [] }, avoid), false)
    assert.ok(extractAvoidFromMessage("solo tengo mi peso corporal").includes("equipo"))
    assert.deepEqual(normalizeAvoid(["peso corporal"]), ["equipo"])
  })
})

describe("restricciones del pedido", () => {
  it("detecta 'más fácil' y molestias", () => {
    assert.equal(messageWantsEasier("cámbialo por algo más fácil"), true)
    assert.equal(messageWantsEasier("cámbialo por algo parecido"), false)
    assert.deepEqual(detectInjuries("me duele la rodilla, cámbialo"), ["knee"])
    assert.deepEqual(detectInjuries("tengo dolor lumbar"), ["lowback"])
    assert.deepEqual(detectInjuries("cambia la sentadilla"), [])
    assert.deepEqual(detectInjuries("sin barra"), [])
  })
  it("clasifica la naturaleza y la familia por nombre", () => {
    assert.equal(natureOf({ name: "45 Degree Pistol Squat Hold" }), "isometric")
    assert.equal(natureOf({ name: "Box Jump" }), "plyometric")
    assert.equal(natureOf({ name: "Barbell Front Squat" }), "dynamic")
    assert.equal(familyOf("Barbell Bent-Over Row"), "row")
    assert.notEqual(familyOf("Dumbbell Pullover"), "row")
  })
})

describe("calidad de los candidatos de reemplazo (N-05)", () => {
  const squat = ex("t", "Barbell Back Squat", { equipment: ["Barbell"] })
  it("un squat no se sustituye por un hold isométrico ni por un salto", () => {
    const pool = [ex("a", "45 Degree Pistol Squat Hold"), ex("b", "Box Jump", { patterns: ["squat"] }), ex("c", "Barbell Front Squat", { equipment: ["Barbell"] }), ex("d", "Goblet Squat", { equipment: ["Dumbbell"] })]
    assert.deepEqual(names(rankAlternatives(squat, pool)).sort(), ["Barbell Front Squat", "Goblet Squat"])
  })
  it("un hold sí puede sustituir a otro hold", () => {
    const hold = ex("t", "Wall Sit Hold", { patterns: ["isometric"] })
    assert.deepEqual(names(rankAlternatives(hold, [ex("a", "Pistol Squat Hold", { patterns: ["isometric"] })])), ["Pistol Squat Hold"])
  })
  it("'más fácil': estrictamente menos difícil", () => {
    const chin = ex("t", "Chin Ups", { patterns: ["pull"], primaryMuscles: ["Lats"], difficulty: "intermediate" })
    const pool = [ex("a", "Same Level Chin Ups", { patterns: ["pull"], primaryMuscles: ["Lats"] }), ex("b", "Assisted Chin Ups", { patterns: ["pull"], primaryMuscles: ["Lats"], difficulty: "beginner" })]
    assert.deepEqual(names(rankAlternatives(chin, pool, { easier: true })), ["Assisted Chin Ups"])
    assert.equal(rankAlternatives(chin, pool).length, 2)
  })
  it("molestia de rodilla: descarta pistol, saltos y zancadas", () => {
    const pool = [ex("a", "Pistol Squat"), ex("b", "Bulgarian Squats"), ex("c", "Barbell Hip Thrust", { patterns: ["hinge"], primaryMuscles: ["Quadriceps"] }), ex("d", "Leg Press")]
    assert.deepEqual(names(rankAlternatives(squat, pool, { injuries: ["knee"] })).sort(), ["Barbell Hip Thrust", "Leg Press"])
  })
  it("un remo se sustituye por otro remo antes que por un pullover", () => {
    const row = ex("t", "Barbell Bent-Over Row", { patterns: ["pull"], primaryMuscles: ["Lats"], equipment: ["Barbell"] })
    const pool = [ex("a", "Dumbbell Pullover", { patterns: ["pull"], primaryMuscles: ["Lats"], equipment: ["Dumbbell"] }), ex("b", "Seal Row", { patterns: ["pull"], primaryMuscles: ["Lats"], equipment: ["Barbell"] })]
    assert.equal(rankAlternatives(row, pool)[0]!.name, "Seal Row")
  })
  it("sin ningún equipo y solo con candidatos con equipo: lista vacía (REP-018)", () => {
    const bench = ex("t", "Barbell Bench Press", { patterns: ["push"], equipment: ["Barbell"] })
    assert.deepEqual(rankAlternatives(bench, [ex("a", "Bosu Push Up", { patterns: ["push"], equipment: ["Bosu"] })], { avoid: ["equipo"] }), [])
  })
})
