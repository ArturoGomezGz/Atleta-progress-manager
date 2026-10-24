// Contexto de las herramientas MCP: sesión sintética para el caller tRPC y resolución
// del equipo cuando el cliente no indica `teamId`.

import type { FastifyBaseLogger } from "fastify"
import { createCaller } from "../routers"
import type { Context } from "../trpc"
import { McpToolError } from "./errors"
import type { AppCaller, McpPrincipal, McpToolContext } from "./types"

type CallerSession = NonNullable<Context["session"]>

// Vida de la sesión sintética cuando el token no expira (PAT sin vencimiento)
const SYNTHETIC_SESSION_TTL_MS = 60 * 60 * 1000

/**
 * Sesión con la forma de better-auth para el principal MCP. No existe en la tabla
 * `session`: solo vive durante la request y sirve para que los procedimientos tRPC
 * apliquen las mismas reglas (assertCoach/assertMember/assertFeature) que en la web.
 */
export function callerSession(p: McpPrincipal, now: Date = new Date()): CallerSession {
  return {
    user: { ...p.user },
    session: {
      id: `mcp_${p.kind}_${p.tokenId}`,
      userId: p.user.id,
      token: "",
      expiresAt: p.expiresAt ?? new Date(now.getTime() + SYNTHETIC_SESSION_TTL_MS),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: "mcp",
    },
  } as CallerSession
}

/** Caller tRPC del principal; el log lleva `mcp: true` y el userId (nunca el token). */
export function createMcpCaller(p: McpPrincipal, log: FastifyBaseLogger, now: Date = new Date()): AppCaller {
  return createCaller({ session: callerSession(p, now), log: log.child({ mcp: true, userId: p.user.id }) })
}

/**
 * Equipo sobre el que actúa una herramienta.
 * - Con `teamId`: comprueba que el usuario pertenezca (y sea coach si `role` es "coach").
 * - Sin `teamId`: el único equipo donde es coach; con role "member", si no es coach de
 *   uno solo, su único equipo. Si hay varios candidatos falla con AMBIGUOUS_TEAM y la lista.
 */
export async function resolveTeamId(
  ctx: Pick<McpToolContext, "caller">,
  teamId: string | undefined,
  role: "coach" | "member" = "coach",
): Promise<string> {
  const teams = await ctx.caller.teams.list()
  const summary = teams.map((t) => ({ teamId: t.team.id, name: t.team.name, role: t.role }))

  if (teamId) {
    const membership = teams.find((t) => t.team.id === teamId)
    if (!membership) throw new McpToolError("FORBIDDEN", "No perteneces a ese equipo. Consulta tus equipos con whoami.")
    if (role === "coach" && membership.role !== "coach") {
      throw new McpToolError("FORBIDDEN", "Esta acción requiere ser coach del equipo.")
    }
    return teamId
  }

  const coachTeams = summary.filter((t) => t.role === "coach")
  if (coachTeams.length === 1) return coachTeams[0]!.teamId
  if (role === "member" && coachTeams.length === 0 && summary.length === 1) return summary[0]!.teamId

  const candidates = role === "coach" ? coachTeams : summary
  if (candidates.length === 0) {
    throw new McpToolError(
      "FORBIDDEN",
      role === "coach" ? "No eres coach de ningún equipo." : "No perteneces a ningún equipo.",
    )
  }
  throw new McpToolError(
    "AMBIGUOUS_TEAM",
    `Perteneces a varios equipos; indica teamId. Equipos: ${candidates.map((t) => `${t.name} (${t.teamId})`).join(", ")}.`,
    { teams: candidates },
  )
}
