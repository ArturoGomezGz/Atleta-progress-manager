import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpToolContext } from "../types"

// Herramientas de cuenta: whoami, list_athletes.
// Stub del Paquete A (no registra nada); lo llena el Paquete C. Ver docs/mcp.md.
export function registerAccountTools(_server: McpServer, _ctx: McpToolContext): void {}
