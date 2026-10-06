// Tipos del registro de habilidades (skills) del AI Routine Editor.
// Las definiciones NO dependen de OpenAI ni de tRPC: un adaptador (adapters/openai.ts) las convierte
// en tools de un modelo, y un futuro servidor MCP o adaptador REST podría usar el mismo registro.
// Fuente de verdad documental: docs/habilidades-ia-rutinas.md (hay una prueba que las mantiene alineadas).

import type { RoutineContent } from "@atleta/db/schema"
import type { z } from "zod"
import type { EditOp, RoutineChange } from "../ai-routine-edits"
import type { AlternativeInfo } from "./alternatives"

export type JsonSchema = Record<string, unknown>

export type SkillCategory = "read" | "catalog" | "edit" | "compound" | "account"
export type SkillExecution = "deterministic" | "llm"
/** read: no toca nada. draft: cambia solo el borrador que el cliente envía. persist: escribe en base de datos. */
export type SkillScope = "read" | "draft" | "persist"
export type SkillStatus = "available" | "limited" | "planned"
export type SkillRisk = "low" | "medium" | "high"
export type McpFit = "yes" | "no" | "pending"

/** Ejercicio de catálogo tal como lo ve una habilidad (mínimo necesario). */
export type CatalogExercise = { id: string; name: string; equipment?: string[]; [k: string]: unknown }

/** Acceso al catálogo que el runtime inyecta (la implementación real vive en deps.ts). */
export type CatalogPort = {
  search(args: unknown): Promise<CatalogExercise[]>
  /** Ejercicio de referencia y candidatos del catálogo (sin ranking: lo hace `rankAlternatives`). */
  alternatives(exerciseId: string): Promise<{ target: AlternativeInfo | null; pool: AlternativeInfo[] }>
}

export type AppliedOp = { op: EditOp; change: RoutineChange }

/** Entorno de una ejecución: el borrador sobre el que se opera y lo que las habilidades pueden consultar. */
export type SkillRuntime = {
  getContent(): RoutineContent
  names: Record<string, string>
  knownExerciseIds: Set<string>
  /** Términos a excluir en búsquedas (ya normalizados). */
  avoid: string[]
  catalog: CatalogPort
  /** El entrenador pidió explícitamente repetir un ejercicio ya presente (add_exercise). */
  allowRepeatExercises?: boolean
  /** Aplica una operación pura sobre el borrador, la registra y devuelve el cambio. Lanza RoutineEditError si no es válida. */
  apply(op: EditOp): RoutineChange
}

export type SkillOutput = {
  /** Resultado compacto (JSON) para quien llamó la habilidad. Nunca incluye la rutina completa. */
  result: unknown
  /** Frase en español para el usuario (habilidades compuestas deterministas). */
  message?: string
  /** Datos de ejecución útiles para el guardián de alcance (p. ej. la palanca elegida). */
  meta?: Record<string, unknown>
}

export type SkillDef<I = unknown> = {
  id: string
  name: string
  description: string
  category: SkillCategory
  execution: SkillExecution
  scope: SkillScope
  status: SkillStatus
  risk: SkillRisk
  mcp: McpFit
  /** Clave de feature flag (apps/api/src/lib/features.ts) que habilita la habilidad. */
  flag?: string
  /** AAAA-MM-DD */
  reviewedAt: string
  notes?: string
  /** Para habilidades dirigidas por LLM: las habilidades atómicas que se exponen al modelo. */
  composedOf?: string[]
  /** Entrada validada (zod). Ausente en habilidades planeadas. */
  inputSchema?: z.ZodType<I, z.ZodTypeDef, unknown>
  /** JSON Schema de la entrada, para adaptadores que exponen la habilidad a un modelo. */
  parameters?: JsonSchema
  /** Ausente en habilidades planeadas y en las dirigidas por LLM (las ejecuta el agente del editor). */
  run?: (input: I, rt: SkillRuntime) => Promise<SkillOutput> | SkillOutput
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySkill = SkillDef<any>

export function defineSkill<I>(def: SkillDef<I>): SkillDef<I> {
  return def
}
