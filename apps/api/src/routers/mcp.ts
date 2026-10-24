import { router } from "../trpc"

// Conector MCP (flag `mcp`): URL del conector, tokens personales (PAT) y apps OAuth
// conectadas. Stub del Paquete A; lo llena el Paquete B (connectionInfo, listTokens,
// createToken, revokeToken, listConnectedApps, revokeApp), todo con featureProcedure("mcp").
// Ver docs/mcp.md.
export const mcpRouter = router({})
