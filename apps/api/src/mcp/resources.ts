// Resources del servidor MCP:
//   - atleta://guia/contenido-rutina: formato de contenido de rutina (markdown + JSON Schema de RoutineContentInput)
//   - atleta://guia/programacion: convenciones de programación (cargas, tempo, circuitos, límites seguros)
//   - atleta://rutinas/{routineId}: una rutina, con el mismo JSON que get_routine (format "outline")
// La plantilla atleta://planes/{planId} la registra el módulo de planes (tools/plans.ts).

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { zodToJsonSchema } from "zod-to-json-schema"
import { EXERCISE_GOALS } from "../services/ai-routine-edits"
import {
  MAX_RPE_AT_OR_ABOVE_9,
  PERCENT_RM_MAX_UP,
  PERCENT_RM_MIN,
  REST_MAX,
  REST_MIN,
  ROUNDS_MAX_UP,
  RPE_MAX_UP,
  RPE_MIN,
  SETS_MAX_UP,
} from "../services/ai-routine-editor/difficulty"
import {
  MAX_BLOCK_EXERCISES,
  MAX_BLOCK_ROUNDS,
  MAX_CONTENT_JSON_CHARS,
  MAX_ITEMS,
  MAX_SETS_PER_EXERCISE,
  routineContentInputSchema,
} from "../services/routine-content-input"
import { describeToolError } from "./errors"
import { toRoutineView } from "./format"
import type { McpToolContext } from "./types"

export const ROUTINE_CONTENT_GUIDE_URI = "atleta://guia/contenido-rutina"
export const PROGRAMMING_GUIDE_URI = "atleta://guia/programacion"

export function routineContentGuide(): string {
  const schema = zodToJsonSchema(routineContentInputSchema, { name: "RoutineContentInput", $refStrategy: "none" })
  return `# Contenido de una rutina (RoutineContentInput)

Lo aceptan \`create_routine\` y \`update_routine\` (campo \`content\`). \`get_routine\` con \`format: "detail"\` lo devuelve en este mismo formato.

- \`items\`: hasta ${MAX_ITEMS} elementos, en orden. Cada uno es:
  - **Ejercicio** \`{ "type": "exercise", "exerciseId", "sets", "restSeconds"?, "tempo"?, "goal"?, "notes"?, "perSide"? }\`
  - **Circuito / superserie** \`{ "type": "block", "name"?, "rounds" (2–${MAX_BLOCK_ROUNDS}), "restBetweenRoundsSeconds"?, "exercises": [1..${MAX_BLOCK_EXERCISES}] }\`; los ejercicios del bloque no llevan \`type\`.
- \`exerciseId\`: id devuelto por \`search_exercises\` (o \`create_exercise\`).
- \`id\` (opcional) en ejercicios y bloques: consérvalo al reescribir una rutina (sale de \`get_routine\`) para no perder el historial del atleta; si falta se genera.
- \`sets\`: lista de 1 a ${MAX_SETS_PER_EXERCISE} series, o el atajo \`{ "count": 3, "setType": "reps", "targetReps": 10 }\`.
  - \`setType\`: \`reps\` (\`targetReps\`), \`time\` (\`targetDurationSeconds\`), \`distance\` (\`targetDistanceMeters\`) o \`amrap\`; los objetivos son enteros ≥ 1.
  - Carga opcional: \`loadType\` \`rpe\` (1–10), \`percent_rm\` (1–120) o \`fixed_kg\` (≤ 1000) con \`loadValue\`. \`loadValue\` exige \`loadType\`; sin carga = peso corporal.
- \`restSeconds\` (entero ≥ 1, en segundos) · \`tempo\` recomendado "E-P-C-P" (excéntrica-pausa-concéntrica-pausa, \`X\` = explosivo, p. ej. "3-1-1-0"; en ese formato se guarda en mayúsculas, cualquier otro texto se guarda tal cual) · \`goal\` ${EXERCISE_GOALS.map((g) => `\`${g}\``).join(", ")} · \`notes\` (indicación breve para el atleta) · \`perSide: true\` en unilaterales (reps/tiempo por cada lado).
- Los valores aceptan lo mismo que el editor de la web, así que el \`content\` de \`get_routine\` (\`format: "detail"\`) siempre se puede reenviar a \`update_routine\` (salvo que la rutina exceda los límites de tamaño de arriba).
- No se aceptan campos desconocidos. El JSON completo no puede pasar de ${MAX_CONTENT_JSON_CHARS} caracteres.

## Ejemplo

\`\`\`json
{
  "items": [
    { "type": "exercise", "exerciseId": "<uuid>", "sets": { "count": 3, "setType": "reps", "targetReps": 8, "loadType": "rpe", "loadValue": 7 }, "restSeconds": 120, "tempo": "3-1-1-0", "goal": "strength" },
    { "type": "block", "name": "Core", "rounds": 3, "restBetweenRoundsSeconds": 60, "exercises": [
      { "exerciseId": "<uuid>", "sets": [{ "setType": "time", "targetDurationSeconds": 40 }] },
      { "exerciseId": "<uuid>", "sets": [{ "setType": "reps", "targetReps": 12 }], "perSide": true }
    ] }
  ]
}
\`\`\`

## JSON Schema

\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`
`
}

export function programmingGuide(): string {
  return `# Convenciones de programación en Atleta

## Cargas
- **RPE** (1–10) es la carga por defecto cuando no hay pesos: 6–7 técnica y volumen, 8 trabajo exigente, 9+ muy pocas series.
- **% RM** (\`percent_rm\`) solo si el atleta tiene RM registrados o el coach lo pide.
- **kg** (\`fixed_kg\`) solo con los pesos que dio el coach; no inventes pesos.

## Estructura
- **Tempo** E-P-C-P: excéntrica, pausa abajo, concéntrica, pausa arriba, en segundos; \`X\` = explosivo.
- **perSide**: en ejercicios unilaterales las reps o el tiempo son por cada lado.
- **goal** describe la intención del ejercicio: ${EXERCISE_GOALS.join(", ")}.
- **Circuitos** (\`block\`): los ejercicios se hacen seguidos y se repiten \`rounds\` veces; \`restBetweenRoundsSeconds\` es el descanso al terminar cada vuelta. Una superserie es un bloque de 2 ejercicios.
- Una rutina admite ${MAX_ITEMS} elementos, ${MAX_BLOCK_EXERCISES} ejercicios por circuito y ${MAX_SETS_PER_EXERCISE} series por ejercicio.

## Límites seguros al ajustar la dificultad (adjust_difficulty)
Un solo cambio pequeño por vez: RPE ${RPE_MIN}–${RPE_MAX_UP} (máx. ${MAX_RPE_AT_OR_ABOVE_9} ejercicios en RPE ≥ 9), % RM ${PERCENT_RM_MIN}–${PERCENT_RM_MAX_UP}, hasta ${SETS_MAX_UP} series, hasta ${ROUNDS_MAX_UP} rondas, descanso ${REST_MIN}–${REST_MAX} s.

## Calendario y asignación
- "Hoy" es UTC (\`whoami.today\`). Asignar sin fecha deja la sesión disponible ya; una fecha futura la programa.
- En planes, la semana va de lunes (1) a domingo (7); la semana 1 es la que contiene la fecha de inicio.
- Lo asignado es una copia: editar la rutina después no cambia las sesiones ya asignadas.

## Antes de escribir
Confirma con el usuario antes de guardar, asignar o archivar. Resume qué vas a cambiar, a quién y en qué fechas.
`
}

export function toResourceError(err: unknown, ctx: McpToolContext): McpError {
  const e = describeToolError(err, { requestId: ctx.requestId })
  return new McpError(ErrorCode.InvalidParams, `${e.code}: ${e.message}`, { code: e.code, ...(e.details && { details: e.details }) })
}

export function registerResources(server: McpServer, ctx: McpToolContext): void {
  if (!ctx.principal.scopes.has("atleta:read")) return

  server.registerResource(
    "contenido-rutina",
    ROUTINE_CONTENT_GUIDE_URI,
    { title: "Formato de contenido de rutina", description: "Cómo escribir `content` para create_routine/update_routine, con ejemplo y JSON Schema.", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: routineContentGuide() }] }),
  )

  server.registerResource(
    "programacion",
    PROGRAMMING_GUIDE_URI,
    { title: "Convenciones de programación", description: "RPE / % RM / kg, tempo, perSide, objetivos, circuitos, límites seguros y calendario.", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: programmingGuide() }] }),
  )

  server.registerResource(
    "rutina",
    new ResourceTemplate("atleta://rutinas/{routineId}", { list: undefined }),
    { title: "Rutina", description: "Una rutina por id, con el mismo JSON que get_routine.", mimeType: "application/json" },
    async (uri, variables) => {
      const routineId = String(Array.isArray(variables.routineId) ? variables.routineId[0] : variables.routineId)
      try {
        const r = await ctx.caller.routines.get({ id: routineId })
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(toRoutineView(r)) }] }
      } catch (err) {
        throw toResourceError(err, ctx)
      }
    },
  )
}
