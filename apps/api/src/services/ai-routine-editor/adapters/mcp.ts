// Adaptador: habilidades del registro -> herramientas MCP. Igual que adapters/openai.ts, no cambia
// las definiciones: deriva de cada habilidad apta (MCP "Sí", ejecutable, de edición o compuesta) el
// nombre, la descripción y el shape zod de su entrada. La herramienta la registra mcp/tools/skills.ts,
// que la ejecuta con createRuntime y guarda el resultado. Las de catálogo (search_exercises,
// propose_new_exercise → create_exercise) se exponen aparte, en mcp/tools/catalog.ts.

import { z } from "zod"
import { isRunnable, SKILLS } from "../skills"
import type { AnySkill, SkillCategory } from "../types"

/** Categorías que se exponen como herramienta MCP generada (operan sobre una rutina guardada). */
export const MCP_SKILL_CATEGORIES: readonly SkillCategory[] = ["edit", "compound"]

export type McpSkillTool = {
  /** Nombre de la herramienta: el id de la habilidad. */
  name: string
  title: string
  description: string
  skill: AnySkill
  /** Campos de la entrada, para publicar el JSON Schema (sin los refine del objeto). */
  shape: z.ZodRawShape
  /** Valida con el schema completo de la habilidad (incluye refine, p. ej. el de adjust_rest). */
  parse(input: unknown): unknown
}

export function isMcpSkill(skill: AnySkill): boolean {
  return skill.mcp === "yes" && isRunnable(skill) && MCP_SKILL_CATEGORIES.includes(skill.category) && !!skill.inputSchema
}

/** Shape de un objeto zod, atravesando los ZodEffects (refine/transform) que lo envuelvan. */
export function objectShapeOf(schema: z.ZodTypeAny): z.ZodRawShape {
  if (schema instanceof z.ZodObject) return schema.shape as z.ZodRawShape
  if (schema instanceof z.ZodEffects) return objectShapeOf(schema.innerType())
  throw new Error("La entrada de la habilidad no es un objeto zod")
}

export function mcpSkillTools(skills: readonly AnySkill[] = SKILLS): McpSkillTool[] {
  return skills.filter(isMcpSkill).map((skill) => ({
    name: skill.id,
    title: skill.name,
    description: skill.description,
    skill,
    shape: objectShapeOf(skill.inputSchema as z.ZodTypeAny),
    parse: (input: unknown) => skill.inputSchema!.parse(input),
  }))
}
