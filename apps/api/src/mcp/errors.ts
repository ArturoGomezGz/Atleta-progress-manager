// Errores de herramientas MCP: todo error se devuelve como resultado `isError` (no
// como error JSON-RPC) para que el modelo lo lea y corrija. Formato:
//   content: [{ type: "text", text: "<CODE>: <mensaje en español con la acción sugerida>" }]
//   structuredContent: { error: { code, message, details? } }
// Nunca se incluyen tokens, argumentos ni errores internos (en producción). Ver docs/mcp.md.

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { TRPCError } from "@trpc/server"
import { ZodError, defaultErrorMap, type ZodIssue } from "zod"
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

const TYPE_NAMES: Record<string, string> = {
  string: "texto",
  number: "número",
  integer: "entero",
  float: "decimal",
  boolean: "booleano",
  object: "objeto",
  array: "lista",
  null: "null",
  date: "fecha",
  bigint: "entero",
  nan: "NaN",
}
const typeName = (t: string) => TYPE_NAMES[t] ?? t

// Una unión (p. ej. `sets`: lista de series o atajo { count, … }) falla con un "Invalid input"
// genérico; el issue útil es el más profundo de sus alternativas (el campo concreto que falló).
// A igual profundidad gana el que no es un simple "tipo equivocado" de la alternativa entera.
function deepestIssue(issue: ZodIssue): ZodIssue {
  if (issue.code !== "invalid_union") return issue
  const candidates = issue.unionErrors.flatMap((e) => e.issues.map(deepestIssue))
  let best: ZodIssue = issue
  for (const c of candidates) {
    const deeper = c.path.length > best.path.length
    const sameDepthBetter = c.path.length === best.path.length && (best === issue || (best.code === "invalid_type" && c.code !== "invalid_type"))
    if (deeper || sameDepthBetter) best = c
  }
  return best
}

const isDefaultMessage = (issue: ZodIssue) => issue.message === defaultErrorMap(issue, { defaultError: issue.message, data: undefined }).message

function list(values: readonly unknown[]): string {
  return values.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(", ")
}

/** Mensaje en español de un issue de zod. Los mensajes propios (no los de zod) se conservan. */
export function issueMessageEs(issue: ZodIssue): string {
  // Los custom y los que ya traen un mensaje propio (p. ej. regex con explicación) van tal cual
  if (issue.code === "custom" || !isDefaultMessage(issue)) return issue.message
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") return "es obligatorio"
      return `se esperaba ${typeName(issue.expected)} y llegó ${typeName(issue.received)}`
    case "too_small": {
      const n = Number(issue.minimum)
      if (issue.type === "string") return issue.exact ? `debe tener exactamente ${n} caracteres` : n === 1 ? "no puede estar vacío" : `debe tener al menos ${n} caracteres`
      if (issue.type === "array" || issue.type === "set") return issue.exact ? `debe tener exactamente ${n} elementos` : `debe tener al menos ${n} elemento${n === 1 ? "" : "s"}`
      if (issue.type === "date") return `debe ser posterior a ${new Date(n).toISOString()}`
      return issue.inclusive ? `debe ser mayor o igual que ${n}` : `debe ser mayor que ${n}`
    }
    case "too_big": {
      const n = Number(issue.maximum)
      if (issue.type === "string") return issue.exact ? `debe tener exactamente ${n} caracteres` : `debe tener como máximo ${n} caracteres`
      if (issue.type === "array" || issue.type === "set") return issue.exact ? `debe tener exactamente ${n} elementos` : `debe tener como máximo ${n} elemento${n === 1 ? "" : "s"}`
      if (issue.type === "date") return `debe ser anterior a ${new Date(n).toISOString()}`
      return issue.inclusive ? `debe ser menor o igual que ${n}` : `debe ser menor que ${n}`
    }
    case "invalid_string": {
      const v = issue.validation
      if (v === "uuid") return "debe ser un UUID (el id tal como lo devuelve la herramienta de listado o búsqueda)"
      if (v === "datetime") return "debe ser una fecha y hora ISO 8601, p. ej. 2026-01-31T12:00:00.000Z (usa el updatedAt tal como lo leíste)"
      if (v === "date") return "debe ser una fecha AAAA-MM-DD"
      if (v === "email") return "debe ser un correo válido"
      if (v === "url") return "debe ser una URL válida"
      if (v === "regex") return "no tiene el formato esperado"
      if (typeof v === "object" && "startsWith" in v) return `debe empezar por "${v.startsWith}"`
      if (typeof v === "object" && "endsWith" in v) return `debe terminar en "${v.endsWith}"`
      if (typeof v === "object" && "includes" in v) return `debe incluir "${v.includes}"`
      return "no tiene el formato esperado"
    }
    case "invalid_enum_value":
      return `valor no válido ${JSON.stringify(issue.received)}; opciones: ${list(issue.options)}`
    case "invalid_literal":
      return `debe ser ${JSON.stringify(issue.expected)}`
    case "invalid_union_discriminator":
      return `valor no válido; opciones: ${list(issue.options)}`
    case "unrecognized_keys":
      return `campo${issue.keys.length === 1 ? "" : "s"} desconocido${issue.keys.length === 1 ? "" : "s"}: ${list(issue.keys)} (revisa el nombre exacto, con mayúsculas y minúsculas)`
    case "not_multiple_of":
      return `debe ser múltiplo de ${String(issue.multipleOf)}`
    case "not_finite":
      return "debe ser un número finito"
    case "invalid_date":
      return "fecha no válida"
    case "invalid_union":
      return "no coincide con ninguna de las formas aceptadas"
    default:
      return issue.message
  }
}

function zodMessage(err: ZodError): { message: string; details: Record<string, unknown> } {
  const flat = err.issues.map(deepestIssue)
  const issues = flat.slice(0, MAX_ISSUES).map((i) => ({ path: i.path.join(".") || "(raíz)", message: issueMessageEs(i) }))
  const extra = flat.length > MAX_ISSUES ? ` (y ${flat.length - MAX_ISSUES} más)` : ""
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
