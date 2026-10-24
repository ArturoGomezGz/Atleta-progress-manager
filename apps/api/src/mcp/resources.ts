import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpToolContext } from "./types"

// Resources: atleta://guia/contenido-rutina, atleta://guia/programacion y las plantillas atleta://rutinas/{routineId} y atleta://planes/{planId}.
// Stub del Paquete A (no registra nada); lo llena el Paquete C. Ver docs/mcp.md.
export function registerResources(_server: McpServer, _ctx: McpToolContext): void {}
