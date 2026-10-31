import { date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, time, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { trainingPlanAssignment, trainingPlanWorkout } from "./plans"
import { routine, routineKindEnum, type RoutineContent } from "./routines"
import { team } from "./teams"

export const rmSourceEnum = pgEnum("rm_source", ["auto", "manual"])

export const sessionStatusEnum = pgEnum("session_status", ["scheduled", "active", "completed", "cancelled"])
export const athleteSessionStatusEnum = pgEnum("athlete_session_status", ["scheduled", "active", "cancelled", "completed"])
export const setStatusEnum = pgEnum("set_status", ["valid", "invalid"])

export const trainingSession = pgTable(
  "training_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id").references(() => routine.id, { onDelete: "set null" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    startedBy: text("started_by")
      .notNull()
      .references(() => user.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    scheduledDate: date("scheduled_date"),
    // Tipo copiado de la rutina al asignar (null en evaluaciones)
    kind: routineKindEnum("kind"),
    // Orden dentro del día para un mismo atleta (warmup=0, main=1, recovery=2 por defecto)
    position: integer("position").notNull().default(0),
    // Hora sugerida, solo informativa
    scheduledTime: time("scheduled_time"),
    status: sessionStatusEnum("status").notNull().default("active"),
    content: jsonb("content").$type<RoutineContent>(),
    // Origen: sesión creada al programar un plan de entrenamiento (null = asignado suelto)
    planAssignmentId: uuid("plan_assignment_id").references(() => trainingPlanAssignment.id, { onDelete: "set null" }),
    planWorkoutId: uuid("plan_workout_id").references(() => trainingPlanWorkout.id, { onDelete: "set null" }),
  },
  (t) => [
    index("training_session_plan_assignment_idx").on(t.planAssignmentId),
    index("training_session_team_date_position_idx").on(t.teamId, t.scheduledDate, t.position),
  ],
)

export const sessionExercise = pgTable("session_exercise", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => trainingSession.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercise.id),
  order: integer("order").notNull(),
})

export const sessionSetTarget = pgTable("session_set_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionExerciseId: uuid("session_exercise_id")
    .notNull()
    .references(() => sessionExercise.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  setType: text("set_type").notNull().default("reps"),
  targetReps: integer("target_reps"),
  targetDurationSeconds: integer("target_duration_seconds"),
  targetPercent: numeric("target_percent", { precision: 5, scale: 2 }),
})

export const athleteSession = pgTable("athlete_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => trainingSession.id, { onDelete: "cascade" }),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => user.id),
  status: athleteSessionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  rpe: integer("rpe"),
})

export const athleteExerciseRm = pgTable("athlete_exercise_rm", {
  id: uuid("id").primaryKey().defaultRandom(),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercise.id, { onDelete: "cascade" }),
  rmLbs: numeric("rm_lbs", { precision: 6, scale: 2 }).notNull(),
  source: rmSourceEnum("source").notNull(),
  sessionId: uuid("session_id").references(() => trainingSession.id, { onDelete: "set null" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
})

export const athleteSessionExerciseCancelled = pgTable(
  "athlete_session_exercise_cancelled",
  {
    athleteSessionId: uuid("athlete_session_id")
      .notNull()
      .references(() => athleteSession.id, { onDelete: "cascade" }),
    sessionExerciseId: uuid("session_exercise_id")
      .notNull()
      .references(() => sessionExercise.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.athleteSessionId, t.sessionExerciseId] })],
)

export const setRecord = pgTable("set_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  athleteSessionId: uuid("athlete_session_id")
    .notNull()
    .references(() => athleteSession.id, { onDelete: "cascade" }),
  sessionExerciseId: uuid("session_exercise_id")
    .notNull()
    .references(() => sessionExercise.id, { onDelete: "cascade" }),
  sessionSetTargetId: uuid("session_set_target_id")
    .references(() => sessionSetTarget.id, { onDelete: "set null" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weightLbs: numeric("weight_lbs", { precision: 6, scale: 2 }).notNull().default("0"),
  status: setStatusEnum("status").notNull().default("valid"),
  recordedBy: text("recorded_by")
    .notNull()
    .references(() => user.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
})
