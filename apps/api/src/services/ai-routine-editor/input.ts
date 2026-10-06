// Contrato del tweak: UNA tarea sin conversación. El servidor no guarda estado: no hay `history`.
// A lo sumo una pregunta de aclaración; el cliente responde y reenvía el mensaje original + {question, answer}.

import type { RoutineContent } from "@atleta/db/schema"
import { z } from "zod"
import type { RoutineChange } from "../ai-routine-edits"
import { routineContentSchema } from "../routine-content-schema"
import { EXEC_INTENTS } from "./intents"

export const TWEAK_MAX_MESSAGE_CHARS = 1000
export const TWEAK_MAX_ITEMS = 30
const TWEAK_MAX_CONTENT_JSON_CHARS = 60_000

const uuid = z.string().uuid()

export const tweakInputSchema = z.object({
  teamId: uuid,
  /** Estado actual del borrador (con los ids estables de ítems y ejercicios). */
  routineContent: routineContentSchema
    .refine((c) => c.items.length >= 1, "La rutina está vacía")
    .refine((c) => c.items.length <= TWEAK_MAX_ITEMS, `Máximo ${TWEAK_MAX_ITEMS} ítems`)
    .refine((c) => JSON.stringify(c).length <= TWEAK_MAX_CONTENT_JSON_CHARS, "La rutina es demasiado grande"),
  message: z.string().trim().min(1).max(TWEAK_MAX_MESSAGE_CHARS),
  /** Respuesta a la pregunta de aclaración de este mismo tweak. Con esto el modelo ya no puede volver a preguntar. */
  clarification: z.object({
    question: z.string().trim().min(1).max(300),
    answer:   z.string().trim().min(1).max(300),
  }).optional(),
  /** Acciones rápidas de la UI: saltan el clasificador con una intención explícita. */
  intentHint: z.object({
    intent:        z.enum(EXEC_INTENTS),
    targetItemIds: z.array(uuid).max(10).optional(),
    direction:     z.enum(["up", "down"]).optional(),
    knob:          z.enum(["volume", "intensity", "rest"]).optional(),
    seconds:       z.number().int().min(15).max(600).optional(),
  }).optional(),
})

/** Mensaje corto en español para un BAD_REQUEST de la entrada del tweak (el detalle técnico va a los logs). */
export function friendlyTweakInputMessage(issues: readonly { path: (string | number)[]; message: string; code: string }[]): string {
  for (const i of issues) {
    if (i.path[0] === "message") {
      return i.code === "too_big" ? `El mensaje es demasiado largo (máximo ${TWEAK_MAX_MESSAGE_CHARS} caracteres).` : "Escribe qué quieres cambiar de la rutina."
    }
    if (i.path[0] === "routineContent") {
      if (i.message === "La rutina está vacía") return "Agrega al menos un ejercicio antes de pedir un ajuste con IA."
      if (i.message.startsWith("Máximo")) return `La rutina tiene demasiados ítems para ajustarla con IA (máximo ${TWEAK_MAX_ITEMS}).`
      if (i.message === "La rutina es demasiado grande") return "La rutina es demasiado grande para ajustarla con IA. Simplifícala e inténtalo de nuevo."
      return "No pude leer la rutina para ajustarla. Revisa que no tenga ejercicios o circuitos vacíos."
    }
  }
  return "No pude entender la solicitud. Revisa el mensaje y la rutina e inténtalo de nuevo."
}

export type TweakInput = z.infer<typeof tweakInputSchema>

export type TweakResult =
  | { status: "needs_info"; question: string; options?: string[] }
  | {
      status: "done"
      message: string
      proposedContent: RoutineContent
      changes: RoutineChange[]
    }
