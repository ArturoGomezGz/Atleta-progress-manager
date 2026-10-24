// Habilidades del AI Routine Editor como herramientas MCP: una por cada habilidad con MCP "Sí",
// ejecutable y de edición o compuesta (adapters/mcp.ts → mcpSkillTools). Cada llamada:
//   1. lee la rutina guardada (routines.get) y toma su updatedAt como versión esperada si el
//      cliente no envió expectedUpdatedAt (no se pierden cambios entre la lectura y la escritura);
//   2. valida que los exerciseId nuevos del input sean visibles y los precarga como conocidos;
//   3. ejecuta la habilidad con createRuntime (el coach dirige: se admiten % RM y kg);
//   4. guarda con routines.updateContent (FOR UPDATE + CONFLICT si la versión cambió).
// No exigen el flag ai_routine_tweaks (ese protege la UI y el costo del LLM interno; aquí no hay
// LLM): basta con el acceso MCP. Ver docs/habilidades-ia-rutinas.md §5 y docs/mcp.md.
// También exporta los pasos comunes que usa edit_routine (tools/routines.ts).

import { db } from "@atleta/db/client"
import { exercise, type RoutineContent } from "@atleta/db/schema"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TRPCError } from "@trpc/server"
import { and, inArray } from "drizzle-orm"
import { z } from "zod"
import type { RoutineChange } from "../../services/ai-routine-edits"
import { mcpSkillTools } from "../../services/ai-routine-editor/adapters/mcp"
import { createRuntime } from "../../services/ai-routine-editor/runtime"
import { proposeNewExercise, searchExercises } from "../../services/ai-routines"
import { exerciseVisibilityWhere, memberTeamIds } from "../../services/exercise-visibility"
import { assertRoutineLimits } from "../../services/routine-content-input"
import { ErrorDetails, McpToolError, ROUTINE_CONFLICT_HINT } from "../errors"
import { registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"

export const routineIdInput = z.string().uuid().describe("Id de la rutina (list_routines)")
export const expectedUpdatedAtInput = z
  .string()
  .datetime({ offset: true })
  .optional()
  .describe("updatedAt que leíste (get_routine). Si la rutina cambió desde entonces falla con CONFLICT. Si lo omites se usa la versión actual")

type LoadedRoutine = Awaited<ReturnType<McpToolContext["caller"]["routines"]["get"]>>

/** Rutina guardada + la versión contra la que se escribirá. */
export async function loadRoutineForEdit(ctx: McpToolContext, routineId: string, expectedUpdatedAt?: string) {
  const routine: LoadedRoutine = await ctx.caller.routines.get({ id: routineId })
  // Si ya es otra versión, se falla antes de editar sobre un contenido que el cliente no vio
  // (updateContent lo vuelve a comprobar con la fila bloqueada)
  if (expectedUpdatedAt !== undefined && Date.parse(expectedUpdatedAt) !== routine.updatedAt.getTime()) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "La rutina cambió desde que la leíste.",
      cause: new ErrorDetails({ updatedAt: routine.updatedAt.toISOString() }, { hint: ROUTINE_CONFLICT_HINT }),
    })
  }
  return { routine, expected: expectedUpdatedAt ?? routine.updatedAt.toISOString() }
}

function exerciseIdsOf(content: RoutineContent): Set<string> {
  return new Set(content.items.flatMap((it) => (it.type === "exercise" ? [it.exerciseId] : it.exercises.map((e) => e.exerciseId))))
}

/** exerciseId / newExerciseId que trae una operación o la entrada de una habilidad. */
export function referencedExerciseIds(inputs: readonly unknown[]): string[] {
  const ids: string[] = []
  for (const i of inputs) {
    if (!i || typeof i !== "object") continue
    for (const key of ["exerciseId", "newExerciseId"] as const) {
      const v = (i as Record<string, unknown>)[key]
      if (typeof v === "string") ids.push(v)
    }
  }
  return [...new Set(ids)]
}

/**
 * Ejercicios que la edición puede usar: los ya presentes en la rutina y los nuevos visibles para
 * el usuario (sistema, públicos, propios o de sus equipos; el mismo criterio que updateContent).
 * Falla con BAD_REQUEST si alguno nuevo no es visible. Devuelve también sus nombres.
 */
export async function knownExercises(ctx: McpToolContext, routine: LoadedRoutine, ids: readonly string[]) {
  const present = exerciseIdsOf(routine.content)
  const added = ids.filter((id) => !present.has(id))
  const names: Record<string, string> = { ...routine.exerciseNames }
  if (added.length > 0) {
    const userId = ctx.principal.user.id
    const teamIds = [...new Set([routine.teamId, ...(await memberTeamIds(userId))])]
    const rows = await db
      .select({ id: exercise.id, name: exercise.name })
      .from(exercise)
      .where(and(inArray(exercise.id, added), exerciseVisibilityWhere({ userId, teamIds })))
    for (const r of rows) names[r.id] = r.name
    const missing = added.filter((id) => !rows.some((r) => r.id === id))
    if (missing.length > 0) {
      throw new McpToolError(
        "BAD_REQUEST",
        `El ejercicio ${missing.join(", ")} no existe o no está disponible para este equipo. Búscalo con search_exercises y usa su id.`,
      )
    }
  }
  return { known: new Set(ids), names }
}

/** Guarda el contenido editado con la versión esperada. */
export async function saveRoutineContent(ctx: McpToolContext, routineId: string, content: RoutineContent, expected: string) {
  assertRoutineLimits(content)
  return ctx.caller.routines.updateContent({ id: routineId, content, expectedUpdatedAt: expected })
}

export const compactChanges = (changes: readonly RoutineChange[]) =>
  changes.map((c) => ({ type: c.type, itemId: c.itemId, summary: c.summary }))

const SAVE_NOTE =
  " Guarda el cambio en la rutina (no es un borrador): confirma con el usuario si no lo pidió explícitamente. Usa los ids de get_routine. Devuelve el updatedAt nuevo."

export function registerSkillTools(server: McpServer, ctx: McpToolContext): void {
  for (const tool of mcpSkillTools()) {
    registerAtletaTool(server, ctx, {
      name: tool.name,
      title: tool.title,
      description: tool.description + SAVE_NOTE,
      scope: "atleta:write",
      annotations: { destructiveHint: tool.skill.risk !== "low", idempotentHint: false },
      input: { routineId: routineIdInput, expectedUpdatedAt: expectedUpdatedAtInput, ...tool.shape },
      async run(args, ctx) {
        const { routineId, expectedUpdatedAt, ...rest } = args as Record<string, unknown> & { routineId: string; expectedUpdatedAt?: string }
        const input = tool.parse(rest) // schema completo de la habilidad (refine incluido)
        const { routine, expected } = await loadRoutineForEdit(ctx, routineId, expectedUpdatedAt)
        const { known, names } = await knownExercises(ctx, routine, referencedExerciseIds([input]))

        const rt = createRuntime({
          original: routine.content,
          names,
          avoid: [],
          userId: ctx.principal.user.id,
          teamId: routine.teamId,
          deps: { searchExercises, proposeNewExercise },
          // En MCP el coach dirige: puede pedir %RM o kg explícitamente
          allowFixedKg: true,
          allowPercentRm: true,
          knownExerciseIds: known,
        })
        const out = await tool.skill.run!(input, rt)
        const changes = compactChanges(rt.applied.map((a) => a.change))

        // Una compuesta sin margen no cambia nada: no se escribe (updatedAt sigue igual)
        if (rt.applied.length === 0) {
          return { routineId, updatedAt: routine.updatedAt.toISOString(), saved: false, result: out.result, ...(out.message && { message: out.message }), changes }
        }
        const updated = await saveRoutineContent(ctx, routineId, rt.working(), expected)
        return { routineId, updatedAt: updated.updatedAt.toISOString(), saved: true, result: out.result, ...(out.message && { message: out.message }), changes }
      },
    })
  }
}
