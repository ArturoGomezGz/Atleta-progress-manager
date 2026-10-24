import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpToolContext } from "./types"

// Prompts: crear_entrenamiento, ajustar_entrenamiento, revisar_adherencia (planificar_mesociclo vive en tools/plans.ts).
// Stub del Paquete A (no registra nada); lo llena el Paquete C. Ver docs/mcp.md.
export function registerPrompts(_server: McpServer, _ctx: McpToolContext): void {}
