import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { rankAlternatives, type AlternativeInfo } from "../../../src/services/ai-routine-editor/alternatives"

const ex = (id: string, name: string, over: Partial<AlternativeInfo> = {}): AlternativeInfo => ({
  id, name, difficulty: "intermediate", patterns: ["push"], primaryMuscles: ["Chest"], bodyZones: ["upper"], equipment: [], ...over,
})
const target = ex("t", "Dips", { equipment: ["Parallel bars"] })
const names = (list: { name: string }[]) => list.map((c) => c.name)

describe("rankAlternatives (mock de catálogo)", () => {
  it("prefiere mismo patrón + mismo músculo primario sobre solo uno de los dos", () => {
    const pool = [
      ex("a", "Shoulder Press", { primaryMuscles: ["Shoulders"] }),
      ex("b", "Push Ups"),
      ex("c", "Chest Fly", { patterns: ["isometric"] }),
    ]
    assert.deepEqual(names(rankAlternatives(target, pool)), ["Push Ups", "Shoulder Press", "Chest Fly"])
  })

  it("excluye lo ya en la rutina (id o nombre), lo evitado y al propio objetivo", () => {
    const pool = [ex("t", "Dips"), ex("x", "Bench Press"), ex("y", "Bar Dips", { equipment: ["Paralelas"] }), ex("z", "Fondos en paralelas"), ex("w", "Push Ups")]
    const out = rankAlternatives(target, pool, { excludeIds: new Set(["x"]), excludeNames: ["push ups "], avoid: ["paralela"] })
    assert.deepEqual(out, [])
    assert.deepEqual(names(rankAlternatives(target, pool, { excludeIds: new Set(["x"]), avoid: ["paralela"] })), ["Push Ups"])
  })

  it("nunca sube la dificultad: un objetivo principiante no recibe avanzados", () => {
    const beginner = ex("t", "Wall Push Ups", { difficulty: "beginner" })
    const pool = [ex("a", "Ring Dips", { difficulty: "advanced" }), ex("b", "Push Ups", { difficulty: "intermediate" }), ex("c", "Knee Push Ups", { difficulty: "beginner" })]
    assert.deepEqual(names(rankAlternatives(beginner, pool)), ["Knee Push Ups"])
  })

  it("prefiere dificultad cercana y equipo parecido", () => {
    const pool = [ex("a", "Easy", { difficulty: "beginner" }), ex("b", "Same", { difficulty: "intermediate" })]
    assert.deepEqual(names(rankAlternatives(target, pool)), ["Same", "Easy"])
    const eq = [ex("a", "A Bodyweight"), ex("b", "B Bars", { equipment: ["Parallel bars"] })]
    assert.equal(rankAlternatives(target, eq)[0]!.name, "B Bars")
  })

  it("descarta lo sin relación y limita a 8", () => {
    const pool = [ex("s", "Squat", { patterns: ["squat"], primaryMuscles: ["Quads"], bodyZones: ["lower"] }), ...Array.from({ length: 12 }, (_, i) => ex(`p${i}`, `Push ${String(i).padStart(2, "0")}`))]
    const out = rankAlternatives(target, pool)
    assert.equal(out.length, 8)
    assert.ok(!names(out).includes("Squat"))
  })
})
