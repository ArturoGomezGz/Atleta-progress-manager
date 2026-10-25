// Prompts del servidor MCP: plantillas de flujo que el cliente ofrece al usuario. Cada una describe
// los pasos con las herramientas reales y recuerda confirmar antes de escribir. El prompt
// planificar_mesociclo lo registra el módulo de planes (tools/plans.ts).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import type { McpToolContext } from "./types"

const userText = (text: string): GetPromptResult => ({ messages: [{ role: "user", content: { type: "text", text } }] })

const line = (label: string, value: string | undefined) => (value?.trim() ? `- ${label}: ${value.trim()}\n` : "")

export function registerPrompts(server: McpServer, ctx: McpToolContext): void {
  const canWrite = ctx.principal.scopes.has("atleta:write")
  const canRead = ctx.principal.scopes.has("atleta:read")

  if (canWrite && canRead) {
    server.registerPrompt(
      "crear_entrenamiento",
      {
        title: "Crear un entrenamiento",
        description: "Diseña una rutina con ejercicios del catálogo de Atleta y la guarda tras tu confirmación.",
        argsSchema: {
          objetivo: z.string().describe("Qué se busca: fuerza, hipertrofia, resistencia, movilidad…"),
          duracion_minutos: z.string().optional().describe("Duración aproximada en minutos"),
          nivel: z.string().optional().describe("principiante, intermedio o avanzado"),
          equipamiento: z.string().optional().describe("Equipo disponible (o \"peso corporal\")"),
        },
      },
      (args) =>
        userText(
          `Quiero crear un entrenamiento en Atleta.\n${line("Objetivo", args.objetivo)}${line("Duración (min)", args.duracion_minutos)}${line("Nivel", args.nivel)}${line("Equipamiento", args.equipamiento)}
Pasos:
1. Llama a whoami para conocer mi equipo, la fecha de hoy y los límites.
2. Lee el resource atleta://guia/contenido-rutina (formato) y atleta://guia/programacion (convenciones).
3. Elige ejercicios con search_exercises (usa avoid para el equipo que no tengo); usa solo ids devueltos.
4. Propón la rutina en texto (ejercicios, series, cargas en RPE salvo que te dé pesos, descansos) y espera mi confirmación.
5. Con mi visto bueno, guárdala con create_routine y dime su nombre. No la asignes a nadie salvo que te lo pida.`,
        ),
    )

    server.registerPrompt(
      "ajustar_entrenamiento",
      {
        title: "Ajustar un entrenamiento",
        description: "Modifica una rutina existente con cambios acotados y guardados con control de versión.",
        argsSchema: {
          routine_id: z.string().describe("Id de la rutina (list_routines)"),
          cambio: z.string().describe("Qué cambiar, p. ej. \"más difícil\", \"sin barra\", \"descansos de 90 s\""),
        },
      },
      (args) =>
        userText(
          `Quiero ajustar la rutina ${args.routine_id} de Atleta: ${args.cambio}
Pasos:
1. Léela con get_routine (anota su updatedAt y los ids de cada elemento).
2. Elige la herramienta más acotada: adjust_difficulty o adjust_rest para dificultad/descansos; replace_exercise (con search_exercises) para sustituir; update_sets, update_item_fields, update_block, move_item, remove_item o add_exercise para cambios puntuales; edit_routine para varios cambios juntos.
3. Explícame el cambio antes de guardarlo y espera mi confirmación.
4. Envía expectedUpdatedAt con el updatedAt que leíste. Si responde CONFLICT, vuelve a leerla y repite.
5. Resume lo que cambió según la respuesta (changes).`,
        ),
    )
  }

  if (canRead) {
    server.registerPrompt(
      "revisar_adherencia",
      {
        title: "Revisar adherencia",
        description: "Resume qué sesiones asignadas se completaron, están pendientes o se cancelaron.",
        argsSchema: {
          athlete_id: z.string().optional().describe("Atleta (list_athletes); omítelo para todo el equipo"),
          desde: z.string().optional().describe("Fecha inicial YYYY-MM-DD"),
        },
      },
      (args) =>
        userText(
          `Revisa la adherencia en Atleta${args.athlete_id ? ` del atleta ${args.athlete_id}` : " de mi equipo"}${args.desde ? ` desde ${args.desde}` : " en las últimas 4 semanas"}.
Pasos:
1. Llama a whoami (fecha de hoy y equipo) y, si hace falta, a list_athletes para los nombres.
2. Usa list_assignments con athleteId y from${args.desde ? "" : " (hoy menos 28 días)"}.
3. Resume por atleta: sesiones completadas, activas o pendientes, programadas a futuro y canceladas, y señala atrasos.
No modifiques nada: es solo una revisión.`,
        ),
    )
  }
}
