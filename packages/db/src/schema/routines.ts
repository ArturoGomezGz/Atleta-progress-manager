import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { team } from "./teams"

export const routine = pgTable("routine", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const routineExercise = pgTable("routine_exercise", {
  id: uuid("id").primaryKey().defaultRandom(),
  routineId: uuid("routine_id")
    .notNull()
    .references(() => routine.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercise.id),
  targetSets: integer("target_sets").notNull(),
  targetReps: integer("target_reps").notNull(),
  targetWeight: numeric("target_weight", { precision: 6, scale: 2 }),
  order: integer("order").notNull(),
})
