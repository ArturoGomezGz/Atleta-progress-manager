import { sql } from "drizzle-orm"
import { boolean, index, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { team } from "./teams"

export const exerciseSuitableForEnum = pgEnum("exercise_suitable_for", ["warmup", "evaluation"])

export const exerciseDifficultyEnum = pgEnum("exercise_difficulty", ["beginner", "intermediate", "advanced"])

export const exerciseMovementPatternEnum = pgEnum("exercise_movement_pattern", [
  "push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility", "core",
])

export const videoOrientationEnum = pgEnum("video_orientation", ["horizontal", "vertical"])

export const exercise = pgTable(
  "exercise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    difficulty: exerciseDifficultyEnum("difficulty"),
    movementPatterns: exerciseMovementPatternEnum("movement_patterns").array().notNull().default(sql`'{}'::exercise_movement_pattern[]`),
    suitableFor: exerciseSuitableForEnum("suitable_for"),
    contraindications: text("contraindications"),
    // Video de YouTube: solo se guarda el ID; miniatura y embed se derivan de él
    youtubeVideoId: text("youtube_video_id"),
    youtubeTitle: text("youtube_title"),
    videoOrientation: videoOrientationEnum("video_orientation").notNull().default("horizontal"),
    isPublic: boolean("is_public").notNull().default(false),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    ownerTeamId: uuid("owner_team_id").references(() => team.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    // System exercises (no owner): unique by name
    uniqueIndex("exercise_name_system_unique")
      .on(t.name)
      .where(sql`"owner_user_id" IS NULL AND "owner_team_id" IS NULL`),
    // User-owned exercises: unique by name per user
    uniqueIndex("exercise_name_user_unique")
      .on(t.name, t.ownerUserId)
      .where(sql`"owner_user_id" IS NOT NULL`),
    // Team-owned exercises: unique by name per team
    uniqueIndex("exercise_name_team_unique")
      .on(t.name, t.ownerTeamId)
      .where(sql`"owner_team_id" IS NOT NULL`),
  ],
)

export const exerciseSave = pgTable(
  "exercise_save",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercise.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.exerciseId] })],
)

// ── Retroalimentación explícita ───────────────────────────────────────────────

export const exerciseReactionValueEnum = pgEnum("exercise_reaction_value", ["positive", "negative"])

// El motivo separa "el ejercicio no me sirve" de "el video está roto": lo primero es opinión
// y pesa en el score, lo segundo es un defecto que va a la cola de revisión del catálogo.
export const exerciseReactionReasonEnum = pgEnum("exercise_reaction_reason", [
  "video_roto",
  "video_no_corresponde",
  "datos_incorrectos",
  "duplicado",
  "no_me_sirve",
  "otro",
])

export const exerciseReaction = pgTable(
  "exercise_reaction",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercise.id, { onDelete: "cascade" }),
    value: exerciseReactionValueEnum("value").notNull(),
    reason: exerciseReactionReasonEnum("reason"),
    // Marca el reporte como atendido por el dueño del ejercicio; null = abierto
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Una fila por usuario/ejercicio: la tabla queda acotada y cada persona pesa una vez
    primaryKey({ columns: [t.userId, t.exerciseId] }),
    index("exercise_reaction_exercise_idx").on(t.exerciseId),
  ],
)
