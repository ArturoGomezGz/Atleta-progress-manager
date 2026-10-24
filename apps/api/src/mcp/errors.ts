// Errores de herramientas MCP: todo error se devuelve como resultado `isError` (no
// como error JSON-RPC) para que el modelo lo lea y corrija. Formato:
//   content: [{ type: "text", text: "<CODE>: <mensaje en español con la acción sugerida>" }]
//   structuredContent: { error: { code, message, details? } }
// Nunca se incluyen tokens, argumentos ni errores internos (en producción). Ver docs/mcp.md.

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { TRPCError } from "@trpc/server"
import { ZodError } from "zod"
import { RoutineEditError } from "../services/ai-routine-edits"

export type McpErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "AMBIGUOUS_TEAM"
  | "INSUFFICIENT_SCOPE"
  | "INTERNAL"

/** Error propio de la capa MCP (equipo ambiguo, scope, tasa…). */
export class McpToolError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "McpToolError"
  }
}

/**
 * Datos extra para el cliente adjuntos a un TRPCError como `cause`, p. ej.
 * `new TRPCError({ code: "CONFLICT", message, cause: new ErrorDetails({ updatedAt }, { hint: "Vuelve a leerla con get_routine y reintenta." }) })`.
 * `details` se expone tal cual (no debe contener nada sensible); `hint` es la acción sugerida
 * que la capa MCP añade al mensaje (el mensaje de tRPC, el que ve la web, no cambia).
 */
export class ErrorDetails extends Error {
  readonly hint?: string

  constructor(
    readonly details: Record<string, unknown>,
    opts: { hint?: string } = {},
  ) {
    super("details")
    this.name = "ErrorDetails"
    this.hint = opts.hint
  }
}

const MAX_ISSUES = 3

function zodMessage(err: ZodError): { message: string; details: Record<string, unknown> } {
  const issues = err.issues.slice(0, MAX_ISSUES).map((i) => ({ path: i.path.join(".") || "(raíz)", message: i.message }))
  const extra = err.issues.length > MAX_ISSUES ? ` (y ${err.issues.length - MAX_ISSUES} más)` : ""
  return {
    message: `Argumentos inválidos: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}${extra}. Corrige los campos y reintenta.`,
    details: { issues },
  }
}

/** Pista de los CONFLICT de rutina (routines.updateContent/rename y las herramientas de edición). */
export const ROUTINE_CONFLICT_HINT = "Vuelve a leerla con get_routine y reintenta."

// Acción sugerida cuando el error no trae su propia pista (ErrorDetails.hint)
const DEFAULT_HINT: Partial<Record<McpErrorCode, string>> = {
  CONFLICT: "Vuelve a leerlo y reintenta con su updatedAt actual.",
}

// Mensaje por defecto (con la acción sugerida) cuando el error no trae uno de negocio
const DEFAULT_MESSAGE: Record<McpErrorCode, string> = {
  FORBIDDEN: "No tienes permiso para esta acción. Revisa el equipo y tu rol con whoami.",
  NOT_FOUND: "No se encontró el recurso. Verifica el id (búscalo con la herramienta de listado correspondiente).",
  BAD_REQUEST: "La solicitud no es válida.",
  CONFLICT: "El recurso cambió desde que lo leíste.",
  RATE_LIMITED: "Demasiadas solicitudes seguidas. Espera un momento y reintenta.",
  INVALID_INPUT: "Argumentos inválidos.",
  AMBIGUOUS_TEAM: "Perteneces a varios equipos: indica teamId.",
  INSUFFICIENT_SCOPE: "El token no tiene permiso de escritura (scope atleta:write). Reconecta la app con ese permiso.",
  INTERNAL: "Ocurrió un error interno. Intenta de nuevo más tarde.",
}

const TRPC_TO_MCP: Partial<Record<TRPCError["code"], McpErrorCode>> = {
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  PRECONDITION_FAILED: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  TOO_MANY_REQUESTS: "RATE_LIMITED",
}

export type ToolErrorBody = { code: McpErrorCode; message: string; details?: Record<string, unknown> }

/** Clasifica un error cualquiera en código + mensaje seguros para el cliente. */
export function describeToolError(err: unknown, opts: { requestId?: string; production?: boolean } = {}): ToolErrorBody {
  const production = opts.production ?? process.env.NODE_ENV === "production"

  if (err instanceof McpToolError) return { code: err.code, message: err.message, ...(err.details && { details: err.details }) }
  if (err instanceof ZodError) return { code: "INVALID_INPUT", ...zodMessage(err) }
  if (err instanceof RoutineEditError) return { code: "BAD_REQUEST", message: err.message }

  if (err instanceof TRPCError) {
    // tRPC envuelve los errores de validación de input en BAD_REQUEST con el ZodError como causa
    if (err.cause instanceof ZodError) return { code: "INVALID_INPUT", ...zodMessage(err.cause) }
    const code = TRPC_TO_MCP[err.code]
    if (code) {
      // Sin mensaje de negocio tRPC usa el propio código como mensaje
      const own = err.message && err.message !== err.code ? err.message : null
      const extra = err.cause instanceof ErrorDetails ? err.cause : undefined
      const hint = extra?.hint ?? DEFAULT_HINT[code]
      const message = [own ?? DEFAULT_MESSAGE[code], hint].filter(Boolean).join(" ")
      return { code, message, ...(extra && { details: extra.details }) }
    }
  }

  // INTERNAL: en producción no se expone nada interno; el requestId permite buscarlo en los logs
  const internal = !production && err instanceof Error ? ` (${err.message})` : ""
  return {
    code: "INTERNAL",
    message: `${DEFAULT_MESSAGE.INTERNAL}${internal}`,
    ...(opts.requestId && { details: { requestId: opts.requestId } }),
  }
}

/** Resultado de herramienta con `isError: true` a partir de cualquier error. */
export function toToolError(err: unknown, opts: { requestId?: string; production?: boolean } = {}): CallToolResult {
  const error = describeToolError(err, opts)
  return {
    isError: true,
    content: [{ type: "text", text: `${error.code}: ${error.message}` }],
    structuredContent: { error },
  }
}
