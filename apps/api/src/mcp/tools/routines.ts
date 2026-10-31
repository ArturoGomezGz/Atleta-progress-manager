// Herramientas de rutinas (plantillas): list_routines, get_routine, create_routine, update_routine,
// edit_routine, duplicate_routine y archive_routine. Todas pasan por los procedimientos routines.*
// (mismas reglas de rol, flag `evaluation` y visibilidad de ejercicios que la web). Las ediciones
// atómicas (add_exercise, update_sets…) son las habilidades del editor (tools/skills.ts).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { applyEdits, editOpSchema, RoutineEditError } from "../../services/ai-routine-edits"
import { normalizeText } from "../../services/ai-routine-editor/avoid"
import { normalizeRoutineContent, routineContentInputSchema } from "../../services/routine-content-input"
import { DEFAULT_KIND_POSITION, ROUTINE_KINDS } from "../../services/routine-kind"
import { resolveTeamId } from "../context"
import { McpToolError } from "../errors"
import { toRoutineSummary, toRoutineView } from "../format"
import { registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"
import {
  compactChanges,
  expectedUpdatedAtInput,
  knownExercises,
  loadRoutineForEdit,
  referencedExerciseIds,
  routineIdInput,
  saveRoutineContent,
} from "./skills"

const MAX_EDIT_OPS = 25
const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 100

const kindInput = z
  .enum(ROUTINE_KINDS)
  .describe(`Tipo del entrenamiento: warmup (calentamiento), main (principal) o recovery (recuperación). Orden por defecto en el día: warmup ${DEFAULT_KIND_POSITION.warmup}, main ${DEFAULT_KIND_POSITION.main}, recovery ${DEFAULT_KIND_POSITION.recovery}. Las evaluaciones no tienen tipo.`)

const teamIdInput = z.string().uuid().optional().describe("Equipo; omítelo si solo eres coach de uno (ver whoami)")

const CONTENT_HELP =
  "Contenido: { items: [...] } con hasta 20 elementos; cada uno es un ejercicio { type: \"exercise\", exerciseId, sets, restSeconds?, tempo?, goal?, notes?, perSide? } o un circuito { type: \"block\", name?, rounds 2–20, restBetweenRoundsSeconds?, exercises[1..10] }. `sets` es una lista de series o el atajo { count, setType, targetReps?, … }. Formato completo en el resource atleta://guia/contenido-rutina."

/** Sin el flag `evaluation` la categoría solo admite "training" (igual que en la web). */
function categoryInput(ctx: McpToolContext) {
  return (ctx.features.has("evaluation") ? z.enum(["training", "evaluation"]) : z.enum(["training"])) as z.ZodEnum<["training", "evaluation"]>
}

export function registerRoutineTools(server: McpServer, ctx: McpToolContext): void {
  const category = categoryInput(ctx)

  registerAtletaTool(server, ctx, {
    name: "list_routines",
    title: "Listar rutinas",
    description:
      "Lista las rutinas (plantillas) de un equipo, de la editada más recientemente a la más antigua, con su id, categoría, tipo (kind), updatedAt y tamaño. `query` filtra por nombre (sin distinguir acentos ni mayúsculas). Las archivadas solo salen con includeArchived.",
    scope: "atleta:read",
    input: {
      teamId: teamIdInput,
      category: category.optional(),
      kind: kindInput.optional().describe("Solo entrenamientos de este tipo"),
      query: z.string().max(80).optional(),
      includeArchived: z.boolean().optional(),
      limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional().describe(`Por defecto ${DEFAULT_LIST_LIMIT}`),
    },
    async run(args, ctx) {
      const teamId = await resolveTeamId(ctx, args.teamId, "member")
      const rows = await ctx.caller.routines.list({ teamId, category: args.category, kind: args.kind, includeArchived: args.includeArchived })
      const needle = args.query ? normalizeText(args.query) : ""
      const matching = rows
        .filter((r) => !needle || normalizeText(r.name).includes(needle))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      return { teamId, total: matching.length, routines: matching.slice(0, args.limit ?? DEFAULT_LIST_LIMIT).map(toRoutineSummary) }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "get_routine",
    title: "Ver rutina",
    description:
      "Devuelve una rutina con su updatedAt (para expectedUpdatedAt). format \"outline\" (por defecto): elementos legibles con sus ids (itemId de las herramientas de edición), nombre del ejercicio y series resumidas. format \"detail\": `content` en el formato exacto que acepta update_routine, más exerciseNames.",
    scope: "atleta:read",
    input: { routineId: routineIdInput, format: z.enum(["outline", "detail"]).optional() },
    async run(args, ctx) {
      const r = await ctx.caller.routines.get({ id: args.routineId })
      return toRoutineView(r, args.format ?? "outline")
    },
  })

  registerAtletaTool(server, ctx, {
    name: "create_routine",
    title: "Crear rutina",
    description:
      `Crea una rutina (plantilla) en un equipo del que eres coach, vacía o con contenido. Los exerciseId salen de search_exercises. ${CONTENT_HELP} Confirma con el usuario antes de guardarla.`,
    scope: "atleta:write",
    annotations: { destructiveHint: false },
    input: {
      teamId: teamIdInput,
      name: z.string().trim().min(1).max(120),
      category: category.optional().describe("Por defecto \"training\""),
      kind: kindInput.optional().describe("Solo entrenamientos; por defecto \"main\""),
      content: routineContentInputSchema.optional(),
    },
    async run(args, ctx) {
      const teamId = await resolveTeamId(ctx, args.teamId, "coach")
      const content = args.content ? normalizeRoutineContent(args.content) : undefined
      const r = await ctx.caller.routines.create({ teamId, name: args.name, category: args.category ?? "training", kind: args.kind, content })
      return { routineId: r!.id, teamId, name: r!.name, kind: r!.kind, updatedAt: r!.updatedAt.toISOString(), itemCount: r!.content.items.length }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "update_routine",
    title: "Reemplazar rutina",
    description:
      `Renombra una rutina, cambia su tipo (kind) y/o reemplaza TODO su contenido (para cambios puntuales usa edit_routine o las herramientas de edición). Exige expectedUpdatedAt: si la rutina cambió desde que la leíste falla con CONFLICT. Conserva el id de cada elemento que no cambie (get_routine format "detail") para no perder su historial. ${CONTENT_HELP}`,
    scope: "atleta:write",
    annotations: { destructiveHint: true, idempotentHint: true },
    input: {
      routineId: routineIdInput,
      expectedUpdatedAt: z.string().datetime({ offset: true }).describe("updatedAt que leíste con get_routine"),
      name: z.string().trim().min(1).max(120).optional(),
      kind: kindInput.optional().describe("Cambia el tipo (solo entrenamientos)"),
      content: routineContentInputSchema.optional(),
    },
    async run(args, ctx) {
      if (args.name === undefined && args.content === undefined && args.kind === undefined) {
        throw new McpToolError("INVALID_INPUT", "Indica name, kind, content o varios.")
      }
      const updated = args.content
        ? await ctx.caller.routines.updateContent({
            id: args.routineId,
            content: normalizeRoutineContent(args.content),
            name: args.name,
            kind: args.kind,
            expectedUpdatedAt: args.expectedUpdatedAt,
          })
        : await ctx.caller.routines.rename({ id: args.routineId, name: args.name, kind: args.kind, expectedUpdatedAt: args.expectedUpdatedAt })
      return { routineId: updated.id, name: updated.name, kind: updated.kind, updatedAt: updated.updatedAt.toISOString(), itemCount: updated.content.items.length }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "edit_routine",
    title: "Editar rutina (varias operaciones)",
    description:
      `Aplica de 1 a ${MAX_EDIT_OPS} operaciones de edición en orden y las guarda juntas; es atómica: si una falla no se aplica ninguna. Cada operación es { op, … } con op = add_exercise, replace_exercise, remove_item, move_item, update_sets, update_item_fields o update_block (mismos campos que la herramienta homónima). Los itemId salen de get_routine; los ids de ejercicios o bloques creados en la misma llamada no se conocen hasta la respuesta. expectedUpdatedAt opcional (CONFLICT si la rutina cambió).`,
    scope: "atleta:write",
    annotations: { destructiveHint: true, idempotentHint: false },
    input: {
      routineId: routineIdInput,
      expectedUpdatedAt: expectedUpdatedAtInput,
      ops: z.array(editOpSchema).min(1).max(MAX_EDIT_OPS),
    },
    async run(args, ctx) {
      const { routine, expected } = await loadRoutineForEdit(ctx, args.routineId, args.expectedUpdatedAt)
      const { known, names } = await knownExercises(ctx, routine, referencedExerciseIds(args.ops))
      let edited: ReturnType<typeof applyEdits>
      try {
        edited = applyEdits(routine.content, args.ops, { knownExerciseIds: known, exerciseNames: names, allowFixedKg: true, allowPercentRm: true })
      } catch (err) {
        if (!(err instanceof RoutineEditError)) throw err
        const where = err.opIndex !== undefined ? `Operación ${err.opIndex + 1} (${args.ops[err.opIndex]?.op}): ` : ""
        throw new McpToolError("BAD_REQUEST", `${where}${err.message} No se aplicó ningún cambio.`, err.opIndex !== undefined ? { opIndex: err.opIndex } : undefined)
      }
      const updated = await saveRoutineContent(ctx, args.routineId, edited.content, expected)
      return { routineId: args.routineId, updatedAt: updated.updatedAt.toISOString(), changes: compactChanges(edited.changes) }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "duplicate_routine",
    title: "Duplicar rutina",
    description: "Copia una rutina (con ids nuevos) en el mismo equipo. Sin name se llama \"<nombre> (copia)\".",
    scope: "atleta:write",
    annotations: { destructiveHint: false },
    input: { routineId: routineIdInput, name: z.string().trim().min(1).max(120).optional() },
    async run(args, ctx) {
      const copy = await ctx.caller.routines.duplicate({ id: args.routineId, name: args.name })
      return { routineId: copy!.id, name: copy!.name, updatedAt: copy!.updatedAt.toISOString() }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "archive_routine",
    title: "Archivar rutina",
    description:
      "Archiva una rutina (sale de list_routines y no se puede asignar; lo ya asignado no cambia) o la restaura con archived: false. Confirma con el usuario antes de archivar.",
    scope: "atleta:write",
    annotations: { destructiveHint: true, idempotentHint: true },
    input: { routineId: routineIdInput, archived: z.boolean().optional().describe("Por defecto true; false la restaura") },
    async run(args, ctx) {
      const r = await ctx.caller.routines.archive({ id: args.routineId, archived: args.archived ?? true })
      return { routineId: r.id, archived: r.archivedAt != null, updatedAt: r.updatedAt.toISOString() }
    },
  })
}
