// Registro de habilidades del AI Routine Editor. Única lista que consumen el agente del editor y
// (a futuro) un servidor MCP o adaptador REST. Documentación: docs/habilidades-ia-rutinas.md.

import { BASIC_SKILLS } from "./skills-basic"
import { COMPOUND_SKILLS } from "./skills-compound"
import { PLANNED_SKILLS } from "./skills-planned"
import type { AnySkill } from "./types"

export const SKILLS: readonly AnySkill[] = [...BASIC_SKILLS, ...COMPOUND_SKILLS, ...PLANNED_SKILLS]

const byId = new Map(SKILLS.map((s) => [s.id, s]))

export function getSkill(id: string): AnySkill | undefined {
  return byId.get(id)
}

/** Una habilidad que se puede ejecutar de forma determinista (tiene `run`). */
export function isRunnable(skill: AnySkill): boolean {
  return skill.status !== "planned" && typeof skill.run === "function"
}
