// search / fetch: las dos herramientas de solo lectura que ChatGPT (deep research y conectores)
// espera con esta forma exacta: search({query}) → {results[{id,title,url}]} y
// fetch({id}) → {id,title,text,url,metadata}. Los ids llevan prefijo de tipo ("routine:<uuid>",
// "exercise:<uuid>"). Otros módulos pueden sumar tipos con addSearchFetchProvider (p. ej. "plan:"
// desde tools/plans.ts) sin tocar este archivo.

import { db } from "@atleta/db/client"
import { exercise } from "@atleta/db/schema"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { and, inArray } from "drizzle-orm"
import { z } from "zod"
import { containsText } from "../../lib/text-search"
import { attachDetails } from "../../routers/exercises"
import { normalizeText } from "../../services/ai-routine-editor/avoid"
import { exerciseVisibilityWhere, memberTeamIds } from "../../services/exercise-visibility"
import { McpToolError } from "../errors"
import { routineOutline } from "../format"
import { registerAtletaTool } from "../tool"
import type { McpToolContext } from "../types"

const MAX_RESULTS = 20
const MAX_TEAMS_SEARCHED = 10

export type SearchResult = { id: string; title: string; url: string }
export type FetchResult = { id: string; title: string; text: string; url: string; metadata?: Record<string, unknown> }

export type SearchFetchProvider = {
  /** Prefijo del id ("plan" → "plan:<uuid>"). */
  kind: string
  search?(query: string, ctx: McpToolContext): Promise<SearchResult[]>
  fetch(id: string, ctx: McpToolContext): Promise<FetchResult>
}

const extraProviders = new WeakMap<McpServer, SearchFetchProvider[]>()

/** Suma un tipo de documento a search/fetch de este servidor (se consulta al llamar, no al registrar). */
export function addSearchFetchProvider(server: McpServer, provider: SearchFetchProvider): void {
  extraProviders.set(server, [...(extraProviders.get(server) ?? []), provider])
}

export const webUrl = () => (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "")

// ─── Rutinas ──────────────────────────────────────────────────────────────────

async function searchRoutines(query: string, ctx: McpToolContext): Promise<SearchResult[]> {
  const needle = normalizeText(query)
  const teams = (await ctx.caller.teams.list()).slice(0, MAX_TEAMS_SEARCHED)
  const perTeam = await Promise.all(
    teams.map(async (t) => {
      const rows = await ctx.caller.routines.list({ teamId: t.team.id })
      return rows
        .filter((r) => !needle || normalizeText(r.name).includes(needle))
        .map((r) => ({
          id: `routine:${r.id}`,
          title: teams.length > 1 ? `${r.name} — ${t.team.name}` : r.name,
          url: `${webUrl()}/teams/${t.team.id}/plantillas/${r.id}`,
          updatedAt: r.updatedAt.getTime(),
        }))
    }),
  )
  return perTeam.flat().sort((a, b) => b.updatedAt - a.updatedAt).map(({ updatedAt: _u, ...r }) => r)
}

async function fetchRoutine(id: string, ctx: McpToolContext): Promise<FetchResult> {
  const r = await ctx.caller.routines.get({ id })
  const lines = [`# ${r.name}`, "", `Categoría: ${r.category === "evaluation" ? "evaluación" : "entrenamiento"}${r.archivedAt ? " (archivada)" : ""}`, ""]
  for (const it of routineOutline(r.content, r.exerciseNames)) {
    if (it.type === "exercise") {
      lines.push(`${it.position + 1}. ${it.exercise}: ${it.sets}${it.restSeconds ? `, descanso ${it.restSeconds} s` : ""}${it.notes ? ` — ${it.notes}` : ""}`)
    } else {
      lines.push(`${it.position + 1}. Circuito${it.name ? ` "${it.name}"` : ""} × ${it.rounds} rondas:`)
      for (const e of it.exercises) lines.push(`   - ${e.exercise}: ${e.sets}${e.notes ? ` — ${e.notes}` : ""}`)
    }
  }
  if (r.content.items.length === 0) lines.push("(sin ejercicios)")
  return {
    id: `routine:${r.id}`,
    title: r.name,
    text: lines.join("\n"),
    url: `${webUrl()}/teams/${r.teamId}/plantillas/${r.id}`,
    metadata: { type: "routine", teamId: r.teamId, category: r.category, updatedAt: r.updatedAt.toISOString(), archived: r.archivedAt != null },
  }
}

// ─── Ejercicios ───────────────────────────────────────────────────────────────

async function exerciseScope(ctx: McpToolContext) {
  const userId = ctx.principal.user.id
  const teamIds = await memberTeamIds(userId)
  return { userId, teamIds, catalogUrl: teamIds[0] ? `${webUrl()}/teams/${teamIds[0]}/ejercicios` : webUrl() }
}

async function searchExercisesByName(query: string, ctx: McpToolContext): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const scope = await exerciseScope(ctx)
  const rows = await db
    .select({ id: exercise.id, name: exercise.name })
    .from(exercise)
    .where(and(exerciseVisibilityWhere(scope), containsText(exercise.name, q)))
    .orderBy(exercise.name)
    .limit(10)
  return rows.map((e) => ({ id: `exercise:${e.id}`, title: e.name, url: scope.catalogUrl }))
}

async function fetchExercise(id: string, ctx: McpToolContext): Promise<FetchResult> {
  const scope = await exerciseScope(ctx)
  const rows = await db.select().from(exercise).where(and(inArray(exercise.id, [id]), exerciseVisibilityWhere(scope)))
  const [e] = await attachDetails(rows)
  if (!e) throw new McpToolError("NOT_FOUND", "No existe ese ejercicio o no está disponible para ti.")
  const primary = e.muscles.filter((m) => m.role === "primary").map((m) => m.muscleName)
  const lines = [
    `# ${e.name}`,
    "",
    e.description ?? "",
    "",
    `Dificultad: ${e.difficulty ?? "—"}`,
    `Patrones: ${e.movementPatterns?.join(", ") || "—"}`,
    `Músculos principales: ${primary.join(", ") || "—"}`,
    `Equipamiento: ${e.equipment.map((q) => q.equipmentName).join(", ") || "ninguno"}`,
    ...(e.contraindications ? [`Contraindicaciones: ${e.contraindications}`] : []),
  ]
  return {
    id: `exercise:${e.id}`,
    title: e.name,
    text: lines.join("\n"),
    url: e.youtubeVideoId ? `https://www.youtube.com/watch?v=${e.youtubeVideoId}` : scope.catalogUrl,
    metadata: { type: "exercise", difficulty: e.difficulty, patterns: e.movementPatterns },
  }
}

// ─── Registro ─────────────────────────────────────────────────────────────────

const ID_RE = /^([a-z_]+):(.+)$/i
const uuidSchema = z.string().uuid()

export function registerSearchFetchTools(server: McpServer, ctx: McpToolContext): void {
  registerAtletaTool(server, ctx, {
    name: "search",
    title: "Buscar",
    description:
      "Busca por nombre rutinas de tus equipos y ejercicios del catálogo (y planes si están disponibles). Devuelve ids del tipo \"routine:<uuid>\", \"exercise:<uuid>\" o \"plan:<uuid>\" para leer con fetch.",
    scope: "atleta:read",
    input: { query: z.string().max(120) },
    async run(args, ctx) {
      const providers = extraProviders.get(server) ?? []
      const groups = await Promise.all([
        searchRoutines(args.query, ctx),
        searchExercisesByName(args.query, ctx),
        ...providers.map((p) => (p.search ? p.search(args.query, ctx) : Promise.resolve([]))),
      ])
      return { results: groups.flat().slice(0, MAX_RESULTS) }
    },
  })

  registerAtletaTool(server, ctx, {
    name: "fetch",
    title: "Leer documento",
    description: "Lee el documento completo de un id devuelto por search (\"routine:<uuid>\", \"exercise:<uuid>\", \"plan:<uuid>\"…) como texto.",
    scope: "atleta:read",
    input: { id: z.string().max(80) },
    async run(args, ctx) {
      const m = ID_RE.exec(args.id.trim())
      if (!m) throw new McpToolError("INVALID_INPUT", "El id debe tener la forma \"<tipo>:<uuid>\" (p. ej. \"routine:<uuid>\"), tal como lo devuelve search.")
      const kind = m[1]!.toLowerCase()
      const id = m[2]!.toLowerCase()
      // Un uuid mal formado (p. ej. 36 guiones) llegaba a Postgres y respondía INTERNAL
      if (!uuidSchema.safeParse(id).success) {
        throw new McpToolError("INVALID_INPUT", `El id "${kind}:…" no lleva un uuid válido. Usa el id tal como lo devuelve search.`)
      }
      if (kind === "routine") return fetchRoutine(id, ctx)
      if (kind === "exercise") return fetchExercise(id, ctx)
      const provider = (extraProviders.get(server) ?? []).find((p) => p.kind === kind)
      if (!provider) throw new McpToolError("NOT_FOUND", `Tipo de documento desconocido: ${kind}.`)
      return provider.fetch(id, ctx)
    },
  })
}
