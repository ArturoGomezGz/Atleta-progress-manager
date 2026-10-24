import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { z } from "zod"
import { isMcpSkill, mcpSkillTools, objectShapeOf } from "../../../src/services/ai-routine-editor/adapters/mcp"
import { isRunnable, SKILLS } from "../../../src/services/ai-routine-editor/skills"

describe("adaptador MCP de habilidades", () => {
  const tools = mcpSkillTools()

  it("genera una herramienta por cada habilidad MCP \"Sí\" ejecutable de edición o compuesta", () => {
    const expected = SKILLS.filter((s) => s.mcp === "yes" && isRunnable(s) && (s.category === "edit" || s.category === "compound")).map((s) => s.id)
    assert.deepEqual(tools.map((t) => t.name), expected)
    assert.deepEqual(
      [...expected].sort(),
      ["add_exercise", "adjust_difficulty", "adjust_rest", "move_item", "remove_item", "replace_exercise", "update_block", "update_item_fields", "update_sets"],
    )
  })

  it("no expone las LLM, las planeadas ni las de catálogo (esas tienen herramienta propia)", () => {
    const names = new Set(tools.map((t) => t.name))
    assert.equal(names.has("replace_with_alternative"), false) // LLM: MCP "No"
    assert.equal(names.has("duplicate_item"), false) // planeada
    assert.equal(names.has("search_exercises"), false) // catálogo: tools/catalog.ts
    for (const s of SKILLS.filter((x) => !isMcpSkill(x))) assert.equal(names.has(s.id), false, s.id)
  })

  it("publica el shape de la entrada y valida con el schema completo", () => {
    for (const t of tools) {
      assert.ok(Object.keys(t.shape).length > 0, `${t.name}: shape vacío`)
      assert.equal(t.description, t.skill.description)
    }
    const updateSets = tools.find((t) => t.name === "update_sets")!
    assert.deepEqual(Object.keys(updateSets.shape).sort(), ["itemId", "sets"])
    assert.throws(() => updateSets.parse({ itemId: "no-uuid", sets: [] }), z.ZodError)
  })

  it("adjust_rest aplica su refine (dirección o segundos)", () => {
    const adjustRest = tools.find((t) => t.name === "adjust_rest")!
    assert.deepEqual(Object.keys(adjustRest.shape).sort(), ["direction", "seconds", "targetItemIds"])
    assert.throws(() => adjustRest.parse({}), (err: unknown) => err instanceof z.ZodError && /dirección o segundos/.test(err.message))
    assert.deepEqual(adjustRest.parse({ seconds: 90 }), { seconds: 90 })
  })

  it("objectShapeOf atraviesa ZodEffects y rechaza lo que no es objeto", () => {
    const inner = z.object({ a: z.string() })
    assert.deepEqual(Object.keys(objectShapeOf(inner.refine(() => true).refine(() => true))), ["a"])
    assert.throws(() => objectShapeOf(z.string()))
  })
})
