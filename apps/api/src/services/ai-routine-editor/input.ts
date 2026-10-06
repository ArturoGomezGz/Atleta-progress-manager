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

export type TweakInput = z.infer<typeof tweakInputSchema>

export type TweakResult =
  | { status: "needs_info"; question: string; options?: string[] }
  | {
      status: "done"
      message: string
      proposedContent: RoutineContent
      changes: RoutineChange[]
      /** Ejercicios creados con propose_new_exercise (privados del equipo; quedan en el catálogo aunque se rechace). */
      createdExercises: { id: string; name: string }[]
    }
