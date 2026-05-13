import { sql } from "drizzle-orm"
import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

export const exerciseSuitableForEnum = pgEnum("exercise_suitable_for", ["warmup", "evaluation"])
import { user } from "./auth"
import { team } from "./teams"

export const exerciseDifficultyEnum = pgEnum("exercise_difficulty", ["beginner", "intermediate", "advanced"])

export const exerciseMovementPatternEnum = pgEnum("exercise_movement_pattern", [
  "push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility",
])

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
    videoUrl: text("video_url"),
    isPublic: boolean("is_public").notNull().default(false),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    ownerTeamId: uuid("owner_team_id").references(() => team.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
