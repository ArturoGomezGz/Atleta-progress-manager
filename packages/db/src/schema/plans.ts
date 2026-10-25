import { sql } from "drizzle-orm"
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { routine } from "./routines"
import { team } from "./teams"

// ─── Planes de entrenamiento multi-semana (flag `training_plans`) ──────────────
//
// Un plan es una plantilla de N semanas (1..16); cada semana tiene huecos por día
// (weekday ISO: 1 = lunes … 7 = domingo) que apuntan a una rutina del equipo.
// Aplicar un plan a atletas crea un `training_plan_assignment` y, por cada hueco y
// fecha, un `training_session` normal (con `plan_assignment_id`/`plan_workout_id`),
// así que el atleta lo ve igual que cualquier asignado. Los atletas de una
// asignación se derivan de `athlete_session`; no se guardan aparte. Ver docs/mcp.md.

export const trainingPlanStatusEnum = pgEnum("training_plan_status", ["draft", "active", "archived"])
export const trainingPlanAssignmentStatusEnum = pgEnum("training_plan_assignment_status", ["active", "cancelled"])

export const trainingPlan = pgTable(
  "training_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    description: text("description"),
    goal: text("goal"),
    weeksCount: integer("weeks_count").notNull(),
    status: trainingPlanStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("training_plan_team_idx").on(t.teamId),
    check("training_plan_weeks_check", sql`${t.weeksCount} between 1 and 16`),
  ],
)

// Una fila por semana 1..weeksCount (nombre, enfoque y notas opcionales)
export const trainingPlanWeek = pgTable(
  "training_plan_week",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => trainingPlan.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    name: text("name"),
    focus: text("focus"),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.planId, t.weekNumber] })],
)

// Hueco de entrenamiento: semana + día + posición dentro del día. Si se borra la
// rutina el hueco queda sin rutina (se reporta como `no_routine` al programar).
export const trainingPlanWorkout = pgTable(
  "training_plan_workout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull(),
    weekNumber: integer("week_number").notNull(),
    weekday: integer("weekday").notNull(),
    position: integer("position").notNull().default(0),
    routineId: uuid("routine_id").references(() => routine.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "training_plan_workout_week_fk",
      columns: [t.planId, t.weekNumber],
      foreignColumns: [trainingPlanWeek.planId, trainingPlanWeek.weekNumber],
    }).onDelete("cascade"),
    uniqueIndex("training_plan_workout_slot_unique").on(t.planId, t.weekNumber, t.weekday, t.position),
    index("training_plan_workout_routine_idx").on(t.routineId),
    check("training_plan_workout_weekday_check", sql`${t.weekday} between 1 and 7`),
  ],
)

// Aplicación de un plan a atletas a partir de `startDate`. Sobrevive al borrado del
// plan (plan_id → null) para no perder el vínculo de las sesiones ya creadas.
export const trainingPlanAssignment = pgTable("training_plan_assignment", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => trainingPlan.id, { onDelete: "set null" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  assignedBy: text("assigned_by")
    .notNull()
    .references(() => user.id),
  startDate: date("start_date").notNull(),
  status: trainingPlanAssignmentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
})
