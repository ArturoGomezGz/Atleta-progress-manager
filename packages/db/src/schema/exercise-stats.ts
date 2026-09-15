import { boolean, doublePrecision, index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { exercise } from "./exercises"

/**
 * Agregado derivado: una fila por ejercicio, reescrita por `refreshExerciseStats()`.
 * Nada escribe aquí desde el camino de un request — es caché de consulta, no fuente de verdad.
 */
export const exerciseStats = pgTable(
  "exercise_stats",
  {
    exerciseId: uuid("exercise_id")
      .primaryKey()
      .references(() => exercise.id, { onDelete: "cascade" }),

    // Curación: solo los coaches arman rutinas, así que esto ya es señal exclusiva de coach
    uniqueCoaches: integer("unique_coaches").notNull().default(0),
    uniqueRoutines: integer("unique_routines").notNull().default(0),

    // Comportamiento en sesiones reales, dentro de la ventana
    sessionUses: integer("session_uses").notNull().default(0),
    completedUses: integer("completed_uses").notNull().default(0),
    cancelledUses: integer("cancelled_uses").notNull().default(0),

    saves: integer("saves").notNull().default(0),

    positiveReactions: integer("positive_reactions").notNull().default(0),
    negativeReactions: integer("negative_reactions").notNull().default(0),
    // Reportes de defecto sin resolver (video roto, datos incorrectos…)
    openReports: integer("open_reports").notNull().default(0),

    score: doublePrecision("score").notNull().default(0),
    isRecommended: boolean("is_recommended").notNull().default(false),

    windowDays: integer("window_days").notNull().default(180),
    lastComputedAt: timestamp("last_computed_at").notNull().defaultNow(),
  },
  (t) => [index("exercise_stats_score_idx").on(t.score)],
)
