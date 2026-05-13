import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { team } from "./teams"

export const routineTypeEnum = pgEnum("routine_type", ["sequential", "circuit"])
export const exerciseObjectiveEnum = pgEnum("exercise_objective", [
  "strength",
  "hypertrophy",
  "endurance",
  "power",
  "cardio",
  "recovery",
])

export const routine = pgTable("routine", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: routineTypeEnum("type").notNull().default("sequential"),
  rounds: integer("rounds"),
  durationSeconds: integer("duration_seconds"),
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
  order: integer("order").notNull(),
  targetSets: integer("target_sets"),
  objective: exerciseObjectiveEnum("objective"),
  tempo: text("tempo"),
  restBetweenSetsSeconds: integer("rest_between_sets_seconds"),
})

export const routineSetTarget = pgTable("routine_set_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  routineExerciseId: uuid("routine_exercise_id")
    .notNull()
    .references(() => routineExercise.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  targetReps: integer("target_reps"),
  targetPercent: numeric("target_percent", { precision: 5, scale: 2 }),
})
