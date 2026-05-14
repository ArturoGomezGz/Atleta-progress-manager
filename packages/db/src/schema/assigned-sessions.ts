import { date, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { routine } from "./routines"
import { team } from "./teams"

export const assignedSessionStatusEnum = pgEnum("assigned_session_status", ["pending", "in_progress", "completed", "skipped"])
export const athleteSessionExecutionStatusEnum = pgEnum("athlete_session_execution_status", ["in_progress", "completed", "skipped"])

export const teamGroup = pgTable("team_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const teamGroupMember = pgTable(
  "team_group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => teamGroup.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.athleteId] })],
)

export const assignedSession = pgTable("assigned_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  routineId: uuid("routine_id").references(() => routine.id, { onDelete: "set null" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  assignedBy: text("assigned_by")
    .notNull()
    .references(() => user.id),
  assignedToAthleteId: text("assigned_to_athlete_id").references(() => user.id, { onDelete: "cascade" }),
  assignedToGroupId: uuid("assigned_to_group_id").references(() => teamGroup.id, { onDelete: "cascade" }),
  scheduledDate: date("scheduled_date").notNull(),
  status: assignedSessionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const athleteSessionExecution = pgTable("athlete_session_execution", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignedSessionId: uuid("assigned_session_id")
    .notNull()
    .references(() => assignedSession.id, { onDelete: "cascade" }),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: athleteSessionExecutionStatusEnum("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
})

export const athleteSetCompletion = pgTable("athlete_set_completion", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .notNull()
    .references(() => athleteSessionExecution.id, { onDelete: "cascade" }),
  routineExerciseId: uuid("routine_exercise_id"),  // referencia lógica al id del ejercicio en routine.content — sin FK
  setNumber: integer("set_number").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
})
