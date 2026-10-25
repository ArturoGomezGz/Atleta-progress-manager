// Servidor MCP de Atleta: se crea uno por request (transporte Streamable HTTP stateless, ver
// mcp/http.ts). Registra las herramientas (tools/*), los resources y los prompts según los scopes
// del token y los flags del usuario. Ver docs/mcp.md.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CallToolRequestSchema, ListToolsRequestSchema, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js"
import { McpToolError, toToolError } from "./errors"
import { registerPrompts } from "./prompts"
import { registerResources } from "./resources"
import { registerAccountTools } from "./tools/account"
import { registerAssignmentTools } from "./tools/assignments"
import { registerCatalogTools } from "./tools/catalog"
import { registerPlanTools } from "./tools/plans"
import { registerRoutineTools } from "./tools/routines"
import { registerSearchFetchTools } from "./tools/search-fetch"
import { registerSkillTools } from "./tools/skills"
import { publishedInputSchema } from "./tool"
import { MCP_SCOPES, type McpToolContext } from "./types"

export const MCP_SERVER_NAME = "atleta"
export const MCP_SERVER_VERSION = "0.1.0"

export const MCP_INSTRUCTIONS = `Atleta es una app para coaches: catálogo de ejercicios, rutinas (plantillas), asignación de sesiones a atletas y planes de varias semanas. Actúas como el usuario conectado, con sus mismos permisos.

Flujo recomendado:
1. whoami: equipos y rol, equipo por defecto, funciones activas, fecha de hoy (UTC) y límites. Si el usuario es coach de varios equipos, indica teamId.
2. list_athletes para conocer atletas (athleteId) y list_routines / get_routine para ver lo que ya existe.
3. search_exercises para elegir ejercicios: usa solo los ids que devuelve (create_exercise solo si no hay equivalente).
4. Para crear: create_routine con content (formato en el resource atleta://guia/contenido-rutina; convenciones en atleta://guia/programacion).
5. Para modificar: get_routine y luego la herramienta más acotada (add_exercise, replace_exercise, update_sets, adjust_difficulty, adjust_rest…) o edit_routine para varios cambios atómicos; update_routine reemplaza todo el contenido. Envía expectedUpdatedAt con el updatedAt que leíste; si responde CONFLICT, vuelve a leer la rutina y reintenta.
6. Para asignar: assign_routine (sin fechas = ahora; con fechas futuras queda programada) y revisa con list_assignments.
7. Si están disponibles las herramientas de planes: create_plan con sus rutinas, schedule_plan con dryRun para revisar el calendario y, tras confirmar, schedule_plan sin dryRun.

Reglas:
- Confirma con el usuario antes de guardar, asignar, cancelar o archivar: resume qué cambia, a quién y en qué fechas.
- No inventes pesos: usa RPE salvo que el usuario dé kilos o el atleta tenga RM.
- Lo asignado es una copia: editar la rutina después no cambia las sesiones ya asignadas.
- Los errores llegan como "CÓDIGO: mensaje" con la acción sugerida (FORBIDDEN, NOT_FOUND, BAD_REQUEST, CONFLICT, INVALID_INPUT, AMBIGUOUS_TEAM, RATE_LIMITED, INSUFFICIENT_SCOPE).`

type Register = (server: McpServer, ctx: McpToolContext) => void

const TOOL_MODULES: Register[] = [
  registerAccountTools,
  registerCatalogTools,
  registerRoutineTools,
  registerSkillTools,
  registerAssignmentTools,
  registerSearchFetchTools,
  registerPlanTools,
]

/** Nombres de herramientas que registran los módulos (envuelve registerTool solo para contarlas). */
function toolNamesFor(server: McpServer, ctx: McpToolContext, modules: Register[]): Set<string> {
  const names = new Set<string>()
  const register = server.registerTool.bind(server) as (name: string, ...rest: unknown[]) => unknown
  server.registerTool = ((name: string, ...rest: unknown[]) => {
    names.add(name)
    return register(name, ...rest)
  }) as McpServer["registerTool"]
  for (const fn of modules) fn(server, ctx)
  server.registerTool = register as McpServer["registerTool"]
  return names
}

/**
 * Herramientas que existen para este usuario (mismos flags) pero no se registraron por falta de
 * scope. Se calcula registrándolas en un servidor descartable con todos los scopes.
 */
function scopeHiddenTools(ctx: McpToolContext, registered: Set<string>): Set<string> {
  if (MCP_SCOPES.every((s) => ctx.principal.scopes.has(s))) return new Set()
  const probe = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION })
  const all = toolNamesFor(probe, { ...ctx, principal: { ...ctx.principal, scopes: new Set(MCP_SCOPES) } }, TOOL_MODULES)
  return new Set([...all].filter((n) => !registered.has(n)))
}

export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, title: "Atleta", version: MCP_SERVER_VERSION },
    { instructions: MCP_INSTRUCTIONS },
  )

  // Una herramienta oculta por falta de scope respondería "Tool X not found" (texto del SDK).
  // Interceptamos tools/call para responder INSUFFICIENT_SCOPE con nuestro formato, y tools/list
  // para publicar los JSON Schema sin $ref.
  let hidden = new Set<string>()
  const setHandler = server.server.setRequestHandler.bind(server.server)
  server.server.setRequestHandler = ((schema: unknown, handler: (req: never, extra: never) => unknown) => {
    // tools/list: el inputSchema publicado es el del wrapper, sin $ref (ver publishedInputSchema)
    if (schema === ListToolsRequestSchema) {
      return setHandler(ListToolsRequestSchema, async (req, extra) => {
        const res = (await (handler as (r: typeof req, e: typeof extra) => Promise<ListToolsResult>)(req, extra))
        return { ...res, tools: res.tools.map((t) => ({ ...t, inputSchema: (publishedInputSchema(server, t.name) as typeof t.inputSchema | undefined) ?? t.inputSchema })) }
      })
    }
    if (schema !== CallToolRequestSchema) return setHandler(schema as never, handler as never)
    return setHandler(CallToolRequestSchema, (req, extra) => {
      if (hidden.has(req.params.name)) {
        return toToolError(
          new McpToolError("INSUFFICIENT_SCOPE", "El token no tiene permiso de escritura (scope atleta:write). Reconecta la app con ese permiso."),
          { requestId: ctx.requestId },
        )
      }
      return (handler as (r: typeof req, e: typeof extra) => ReturnType<typeof toToolError>)(req, extra)
    })
  }) as typeof server.server.setRequestHandler

  const registered = toolNamesFor(server, ctx, TOOL_MODULES)
  hidden = scopeHiddenTools(ctx, registered)
  registerResources(server, ctx)
  registerPrompts(server, ctx)

  return server
}
