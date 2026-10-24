// Herramientas de catálogo de ejercicios: search_exercises, get_exercises y create_exercise.
// Reutilizan las habilidades del editor (search_exercises y propose_new_exercise: mismas entradas y
// misma búsqueda/alta) y el criterio único de visibilidad (services/exercise-visibility.ts).

import { db } from "@atleta/db/client"
import { exercise } from "@atleta/db/schema"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { and, inArray } from "drizzle-orm"
import { z } from "zod"
import { attachDetails } from "../../routers/exercises"
import { objectShapeOf } from "../../services/ai-routine-editor/adapters/mcp"
import { normalizeAvoid } from "../../services/ai-routine-editor/avoid"
import { proposeNewExerciseSkill, searchExercisesSkill } from "../../services/ai-routine-editor/skills-basic"
import { proposeNewExercise, searchExercises, type Ctx } from "../../services/ai-routines"
import { exerciseVisibilityWhere, memberTeamIds } from "../../services/exercise-visibility"
import { resolveTeamId } from "../context"
import { McpToolError } from "../errors"
import { registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"

const MAX_GET_EXERCISES = 30

const teamIdInput = z.string().uuid().optional().describe("Equipo cuyo catálogo se usa; omítelo si solo tienes uno")

/** Contexto de las funciones de catálogo de la IA de rutinas (búsqueda y alta en el equipo). */
function catalogCtx(userId: string, teamId: string, avoid?: string[] | null): Ctx {
  return { userId, teamId, allowedEquipment: null, knownIds: new Set(), created: [], avoid: normalizeAvoid(avoid) }
}

const youtubeUrl = (id: string | null) => (id ? `https://www.youtube.com/watch?v=${id}` : null)

export function registerCatalogTools(server: McpServer, ctx: McpToolContext): void {
  registerAtletaTool(server, ctx, {
    name: "search_exercises",
    title: "Buscar ejercicios",
    description:
      "Busca en el catálogo de ejercicios del equipo (nombres en español; búsqueda parcial por nombre y filtros por patrón, zona, dificultad y calentamiento). Devuelve hasta 12 resultados con su id, que es el exerciseId que piden create_routine, add_exercise y replace_exercise. `avoid` excluye ejercicios cuyo nombre o equipamiento contenga esos términos (p. ej. [\"barra\", \"salto\"]).",
    scope: "atleta:read",
    input: {
      teamId: teamIdInput,
      ...objectShapeOf(searchExercisesSkill.inputSchema as z.ZodTypeAny),
      avoid: z.array(z.string().max(60)).max(8).optional().describe("Términos a excluir (nombre o equipamiento)"),
    },
    async run(args, ctx) {
      const { teamId: rawTeamId, avoid, ...query } = args
      const teamId = await resolveTeamId(ctx, rawTeamId, "member")
      const results = await searchExercises(query, catalogCtx(ctx.principal.user.id, teamId, avoid))
      return {
        teamId,
        results: results.map((r) => ({
          id: r.id,
          name: r.name,
          difficulty: r.difficulty,
          patterns: r.patterns,
          equipment: r.equipment,
          primaryMuscles: r.primaryMuscles,
          ...(r.warmup && { warmup: true }),
          ...(r.contraindications && { contraindications: r.contraindications }),
        })),
      }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "get_exercises",
    title: "Detalle de ejercicios",
    description:
      `Devuelve el detalle de hasta ${MAX_GET_EXERCISES} ejercicios por id (descripción, dificultad, patrones, equipamiento, músculos, contraindicaciones y video). Los ids que no existen o no puedes ver salen en notFound.`,
    scope: "atleta:read",
    input: {
      teamId: z.string().uuid().optional().describe("Limita la visibilidad al catálogo de ese equipo; por defecto, todos tus equipos"),
      ids: z.array(z.string().uuid()).min(1).max(MAX_GET_EXERCISES),
    },
    async run(args, ctx) {
      const userId = ctx.principal.user.id
      const teamIds = args.teamId ? [await resolveTeamId(ctx, args.teamId, "member")] : await memberTeamIds(userId)
      const ids = [...new Set(args.ids)]
      const rows = await db
        .select()
        .from(exercise)
        .where(and(inArray(exercise.id, ids), exerciseVisibilityWhere({ userId, teamIds })))
      const detailed = await attachDetails(rows)
      const found = new Set(detailed.map((e) => e.id))
      return {
        exercises: detailed.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          difficulty: e.difficulty,
          patterns: e.movementPatterns,
          equipment: e.equipment.map((q) => q.equipmentName),
          muscles: e.muscles.map((m) => ({ name: m.muscleName, role: m.role, bodyZone: m.bodyZone })),
          contraindications: e.contraindications,
          videoUrl: youtubeUrl(e.youtubeVideoId),
        })),
        notFound: ids.filter((id) => !found.has(id)),
      }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "create_exercise",
    title: "Crear ejercicio",
    description:
      "Crea un ejercicio en el catálogo privado del equipo, solo si search_exercises no encontró un equivalente razonable. Si ya existe uno visible con el mismo nombre devuelve ese (existed: true). Confirma con el usuario antes de crearlo. Máximo 10 por hora.",
    scope: "atleta:write",
    input: { teamId: teamIdInput, ...objectShapeOf(proposeNewExerciseSkill.inputSchema as z.ZodTypeAny) },
    async run(args, ctx) {
      const { teamId: rawTeamId, ...proposal } = args
      const teamId = await resolveTeamId(ctx, rawTeamId, "coach")
      const userId = ctx.principal.user.id
      const limit = ctx.limiters.exerciseCreate.hit(userId)
      if (!limit.ok) {
        throw new McpToolError("RATE_LIMITED", `Creaste demasiados ejercicios en la última hora. Reintenta en ${limit.retryAfterSeconds} s o usa uno del catálogo.`, {
          retryAfterSeconds: limit.retryAfterSeconds,
        })
      }
      const created = await proposeNewExercise(proposal, catalogCtx(userId, teamId))
      if ("error" in created && created.error) throw new McpToolError("BAD_REQUEST", created.error)
      if (!("id" in created) || !created.id) throw new McpToolError("BAD_REQUEST", "No se pudo crear el ejercicio.")
      return { id: created.id, name: created.name, teamId, existed: "note" in created && !!created.note }
    },
  })
}
