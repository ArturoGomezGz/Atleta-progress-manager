import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { routine } from "./routines"
import { team } from "./teams"

export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "cancelled"])
export const athleteSessionStatusEnum = pgEnum("athlete_session_status", ["active", "cancelled"])
export const setStatusEnum = pgEnum("set_status", ["valid", "invalid"])

// Snapshot + live execution of a routine
export const trainingSession = pgTable("training_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Reference only — routine may change after session starts
  routineId: uuid("routine_id").references(() => routine.id, { onDelete: "set null" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  startedBy: text("started_by")
    .notNull()
    .references(() => user.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  status: sessionStatusEnum("status").notNull().default("active"),
})

// Snapshot of routine exercises at session start — modifiable per session
export const sessionExercise = pgTable("session_exercise", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => trainingSession.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercise.id),
  targetSets: integer("target_sets").notNull(),
  targetReps: integer("target_reps").notNull(),
  targetWeight: numeric("target_weight", { precision: 6, scale: 2 }),
  order: integer("order").notNull(),
})

// Each athlete participating in the session
export const athleteSession = pgTable("athlete_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => trainingSession.id, { onDelete: "cascade" }),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => user.id),
  status: athleteSessionStatusEnum("status").notNull().default("active"),
})

// Actual recorded sets during session
export const setRecord = pgTable("set_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  athleteSessionId: uuid("athlete_session_id")
    .notNull()
    .references(() => athleteSession.id, { onDelete: "cascade" }),
  sessionExerciseId: uuid("session_exercise_id")
    .notNull()
    .references(() => sessionExercise.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }),
  status: setStatusEnum("status").notNull().default("valid"),
  recordedBy: text("recorded_by")
    .notNull()
    .references(() => user.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
})
