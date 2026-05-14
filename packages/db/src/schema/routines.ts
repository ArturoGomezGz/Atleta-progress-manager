import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { team } from "./teams"

export const routineTypeEnum = pgEnum("routine_type", ["sequential", "circuit"])
export const exerciseGoalEnum = pgEnum("exercise_goal", ["strength", "hypertrophy", "endurance", "power", "cardio", "recovery"])
export const setTypeEnum = pgEnum("set_type", ["reps", "time"])
export const loadTypeEnum = pgEnum("load_type", ["fixed_kg", "percent_rm", "rpe"])

export const routine = pgTable("routine", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  type: routineTypeEnum("type").notNull().default("sequential"),
  circuitRounds: integer("circuit_rounds"),
  circuitDurationSeconds: integer("circuit_duration_seconds"),
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
    .references(() => exercise.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  tempo: text("tempo"),
  restSeconds: integer("rest_seconds"),
  goal: exerciseGoalEnum("goal"),
  notes: text("notes"),
})

export const routineSetTarget = pgTable("routine_set_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  routineExerciseId: uuid("routine_exercise_id")
    .notNull()
    .references(() => routineExercise.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  targetReps: integer("target_reps"),
  targetPercent: numeric("target_percent", { precision: 5, scale: 2 }),
  // v2
  setType: setTypeEnum("set_type").notNull().default("reps"),
  targetDurationSeconds: integer("target_duration_seconds"),
  loadType: loadTypeEnum("load_type"),
  loadValue: numeric("load_value", { precision: 7, scale: 2 }),
})
