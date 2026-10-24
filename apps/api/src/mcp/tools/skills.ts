import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpToolContext } from "../types"

// Una herramienta por habilidad del AI Routine Editor con mcp: "yes" (add_exercise, replace_exercise, update_sets…).
// Stub del Paquete A (no registra nada); lo llena el Paquete C. Ver docs/mcp.md.
export function registerSkillTools(_server: McpServer, _ctx: McpToolContext): void {}
