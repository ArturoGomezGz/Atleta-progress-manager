// Servidor MCP de Atleta: se crea uno por request (transporte Streamable HTTP stateless,
// ver mcp/http.ts). Stub del Paquete A: registra los módulos de herramientas con sus
// nombres definitivos; el Paquete C lo reemplaza (instructions y registro completo) y
// el D solo implementa registerPlanTools. Ver docs/mcp.md.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerPrompts } from "./prompts"
import { registerResources } from "./resources"
import { registerAccountTools } from "./tools/account"
import { registerAssignmentTools } from "./tools/assignments"
import { registerCatalogTools } from "./tools/catalog"
import { registerPlanTools } from "./tools/plans"
import { registerRoutineTools } from "./tools/routines"
import { registerSearchFetchTools } from "./tools/search-fetch"
import { registerSkillTools } from "./tools/skills"
import type { McpToolContext } from "./types"

export const MCP_SERVER_NAME = "atleta"
export const MCP_SERVER_VERSION = "0.1.0"

export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, title: "Atleta", version: MCP_SERVER_VERSION })

  registerAccountTools(server, ctx)
  registerCatalogTools(server, ctx)
  registerRoutineTools(server, ctx)
  registerSkillTools(server, ctx)
  registerAssignmentTools(server, ctx)
  registerSearchFetchTools(server, ctx)
  registerPlanTools(server, ctx)
  registerResources(server, ctx)
  registerPrompts(server, ctx)

  return server
}
