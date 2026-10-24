// Registro de herramientas MCP con las reglas comunes de Atleta. Toda herramienta se
// registra con registerAtletaTool; el wrapper:
//   - no la registra si al principal le falta el scope o el usuario no tiene el flag
//     (el cliente ni siquiera la ve en tools/list);
//   - revalida el scope dentro del handler (defensa en profundidad → INSUFFICIENT_SCOPE);
//   - valida los argumentos con zod y devuelve INVALID_INPUT con nuestro formato;
//   - aplica el límite de escrituras por usuario (limiters.write) si `write`;
//   - escribe una línea de log por llamada (sin tokens, argumentos ni contenido);
//   - convierte cualquier error con toToolError.
// El resultado de `run` se devuelve como JSON en `content` y como `structuredContent`.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import type { FeatureKey } from "../lib/features"
import { McpToolError, describeToolError, toToolError } from "./errors"
import type { McpScope, McpToolContext } from "./types"

export type AtletaToolDef<S extends z.ZodRawShape> = {
  /** snake_case, único en todo el servidor. */
  name: string
  title: string
  /** En español: qué hace, cuándo usarla y qué devuelve. */
  description: string
  scope: McpScope
  /** Flag requerido además de `mcp` (p. ej. "training_plans"). */
  feature?: FeatureKey
  /** Escritura: cuenta para limiters.write. Por defecto, true si scope es atleta:write. */
  write?: boolean
  annotations?: ToolAnnotations
  input: S
  run(args: z.objectOutputType<S, z.ZodTypeAny>, ctx: McpToolContext): Promise<unknown>
}

/** ¿Se registraría la herramienta para este contexto? (útil para tests y para whoami) */
export function isToolAvailable(ctx: McpToolContext, def: { scope: McpScope; feature?: FeatureKey }): boolean {
  return ctx.principal.scopes.has(def.scope) && (!def.feature || ctx.features.has(def.feature))
}

// El SDK valida los argumentos antes del handler y, si fallan, responde con su propio
// texto en inglés. Para devolver INVALID_INPUT con nuestro formato le damos un schema
// que publica el JSON Schema completo en tools/list (hereda `_def`/`shape` del objeto
// real) pero cuya validación siempre pasa; la validación real la hace el wrapper.
function advertisedSchema<S extends z.ZodRawShape>(schema: z.ZodObject<S>): z.ZodObject<S> {
  const lenient = Object.create(schema) as z.ZodObject<S>
  lenient.safeParseAsync = async (data: unknown) => ({ success: true, data }) as never
  return lenient
}

function toResult(value: unknown): CallToolResult {
  // structuredContent debe ser un objeto: los arreglos/escalares van envueltos
  const structured = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { result: value ?? null }
  return { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured }
}

export function registerAtletaTool<S extends z.ZodRawShape>(server: McpServer, ctx: McpToolContext, def: AtletaToolDef<S>): void {
  if (!isToolAvailable(ctx, def)) return

  const schema = z.object(def.input)
  const isWrite = def.write ?? def.scope === "atleta:write"
  const annotations: ToolAnnotations = {
    readOnlyHint: !isWrite,
    openWorldHint: false,
    ...def.annotations,
  }

  server.registerTool(
    def.name,
    { title: def.title, description: def.description, inputSchema: advertisedSchema(schema), annotations },
    async (raw: unknown) => {
      const started = Date.now()
      const p = ctx.principal
      let teamId: string | undefined
      let result: CallToolResult
      let code: string | undefined
      try {
        if (!p.scopes.has(def.scope)) throw new McpToolError("INSUFFICIENT_SCOPE", "El token no tiene el permiso necesario para esta herramienta.")
        const args = schema.parse(raw ?? {})
        teamId = typeof (args as { teamId?: unknown }).teamId === "string" ? (args as { teamId: string }).teamId : undefined
        if (isWrite) {
          const limit = ctx.limiters.write.hit(p.user.id)
          if (!limit.ok) {
            throw new McpToolError(
              "RATE_LIMITED",
              `Demasiadas modificaciones seguidas. Reintenta en ${limit.retryAfterSeconds} s.`,
              { retryAfterSeconds: limit.retryAfterSeconds },
            )
          }
        }
        result = toResult(await def.run(args, ctx))
      } catch (err) {
        code = describeToolError(err, { requestId: ctx.requestId }).code
        if (code === "INTERNAL") ctx.log.error({ err, mcp: { tool: def.name, userId: p.user.id } }, "[mcp] error interno en herramienta")
        result = toToolError(err, { requestId: ctx.requestId })
      }

      ctx.log.info(
        {
          mcp: {
            kind: p.kind,
            userId: p.user.id,
            ...(p.clientId ? { clientId: p.clientId } : { tokenId: p.tokenId }),
            rpcMethod: "tools/call",
            tool: def.name,
            ...(teamId && { teamId }),
            ms: Date.now() - started,
            ok: !result.isError,
            ...(code && { code }),
          },
        },
        "[mcp] tool",
      )
      return result
    },
  )
}
