import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpToolContext } from "../types"

// Planes multi-semana (flag training_plans): list_plans, get_plan, create_plan, update_plan, duplicate_plan, schedule_plan, cancel_plan_assignment y el prompt planificar_mesociclo.
// Stub del Paquete A (no registra nada); lo llena el Paquete D. Ver docs/mcp.md.
export function registerPlanTools(_server: McpServer, _ctx: McpToolContext): void {}
