import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { INTENTS } from "../../../src/services/ai-routine-editor/intents"
import { finishTool } from "../../../src/services/ai-routine-editor/adapters/openai"
import { getSkill, isRunnable, SKILLS } from "../../../src/services/ai-routine-editor/skills"

const DOC = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../docs/habilidades-ia-rutinas.md")

type Row = { id: string; ejecucion: string; alcance: string; estado: string; flag: string; mcp: string }

/** Filas de las tablas del catálogo: las que tienen una columna "Id" con el id entre comillas invertidas. */
function docRows(): Row[] {
  const rows: Row[] = []
  let header: string[] | null = null
  for (const line of readFileSync(DOC, "utf8").split("\n")) {
    if (!line.startsWith("|")) { header = null; continue }
    const cells = line.split("|").slice(1, -1).map((c) => c.trim())
    if (cells[0] === "Id") { header = cells.map((c) => c.toLowerCase()); continue }
    if (!header || /^-+$/.test(cells[0]!.replace(/[:\s]/g, ""))) continue
    const get = (name: string) => cells[header!.indexOf(name)] ?? ""
    const id = /^`([a-z_]+)`$/.exec(cells[0]!)?.[1]
    if (id) rows.push({ id, ejecucion: get("ejecución"), alcance: get("alcance"), estado: get("estado"), flag: get("flag"), mcp: get("mcp") })
  }
  return rows
}

const EJECUCION = { deterministic: "Determinista", llm: "LLM" }
const ALCANCE = { read: "Lectura", draft: "Borrador", persist: "Guardado" }
const ESTADO = { available: "Disponible", limited: "Limitada", planned: "Planeada" }
const MCP = { yes: "Sí", no: "No", pending: "Pendiente" }

describe("registro de habilidades vs docs/habilidades-ia-rutinas.md", () => {
  const rows = docRows()

  it("todo id del código está en el documento y viceversa", () => {
    const inDoc = rows.map((r) => r.id)
    assert.equal(new Set(inDoc).size, inDoc.length, "ids repetidos en el documento")
    const inCode = SKILLS.map((s) => s.id)
    assert.equal(new Set(inCode).size, inCode.length, "ids repetidos en el registro")
    assert.deepEqual(inCode.filter((id) => !inDoc.includes(id)), [], "habilidades del código que faltan en el documento")
    assert.deepEqual(inDoc.filter((id) => !inCode.includes(id)), [], "habilidades del documento que no existen en el código")
  })

  it("estado, ejecución, alcance, flag y MCP coinciden", () => {
    for (const s of SKILLS) {
      const row = rows.find((r) => r.id === s.id)!
      assert.equal(row.estado, ESTADO[s.status], `${s.id}: estado`)
      assert.equal(row.ejecucion, EJECUCION[s.execution], `${s.id}: ejecución`)
      assert.equal(row.alcance, ALCANCE[s.scope], `${s.id}: alcance`)
      assert.equal(row.mcp, MCP[s.mcp], `${s.id}: MCP`)
      assert.equal(row.flag, s.flag ? `\`${s.flag}\`` : "—", `${s.id}: flag`)
    }
  })
})

describe("coherencia del registro", () => {
  it("las habilidades no planeadas declaran entrada y flag; las planeadas no son ejecutables", () => {
    for (const s of SKILLS) {
      if (s.status === "planned") {
        assert.ok(!s.run && !s.inputSchema, `${s.id}: una planeada no puede tener código ejecutable`)
      } else {
        assert.ok(s.inputSchema && s.parameters && s.flag, `${s.id}: falta inputSchema, parameters o flag`)
        if (s.execution === "deterministic") assert.ok(isRunnable(s), `${s.id}: determinista sin run`)
      }
    }
  })

  it("las habilidades LLM declaran composedOf con habilidades disponibles", () => {
    for (const s of SKILLS.filter((x) => x.execution === "llm" && x.status !== "planned")) {
      assert.ok(s.composedOf?.length, `${s.id}: falta composedOf`)
      for (const id of s.composedOf!) assert.ok(getSkill(id) && isRunnable(getSkill(id)!), `${s.id}: ${id} no es ejecutable`)
    }
  })

  it("cada intención referencia habilidades ejecutables del registro", () => {
    for (const intent of Object.values(INTENTS)) {
      assert.ok(intent.skillIds.length > 0)
      for (const id of intent.skillIds) {
        const skill = getSkill(id)
        assert.ok(skill, `${intent.id}: ${id} no existe`)
        assert.equal(skill!.flag, "ai_routine_tweaks")
        assert.ok(skill!.parameters, `${intent.id}: ${id} sin parameters`)
      }
    }
  })

  it("el cierre del agente no choca con el id de una habilidad", () => {
    const name = finishTool.type === "function" ? finishTool.function.name : ""
    assert.equal(getSkill(name), undefined)
  })
})
