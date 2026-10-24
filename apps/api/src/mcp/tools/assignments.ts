import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpToolContext } from "../types"

// Asignados: assign_routine, list_assignments, cancel_assignment.
// Stub del Paquete A (no registra nada); lo llena el Paquete C. Ver docs/mcp.md.
export function registerAssignmentTools(_server: McpServer, _ctx: McpToolContext): void {}
