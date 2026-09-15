import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { routine, type RoutineContent } from "./routines"
import { trainingSession } from "./sessions"
import { team } from "./teams"

// ─── Rutinas compartidas por enlace ────────────────────────────────────────────
//
// Un coach genera un código para una de sus rutinas y lo comparte. Cualquiera
// puede ejecutarla sin cuenta; al terminar se le invita a registrarse y su
// entrenamiento se convierte en una sesión real (ver `guest_workout.claimed_by`).

export const routineShare = pgTable(
  "routine_share",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routine.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    // Código corto que viaja en la URL (/r/<code>) y puede dictarse en voz alta
    code: text("code").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routine_share_routine_idx").on(t.routineId)],
)

export const guestWorkoutStatusEnum = pgEnum("guest_workout_status", ["active", "completed", "claimed"])

/**
 * Ejecución anónima de una rutina compartida. El navegador del invitado guarda
 * `token` (localStorage) — es la única credencial mientras no hay cuenta.
 *
 * `content` es un snapshot de la rutina al momento de empezar: el invitado
 * termina lo que empezó aunque el coach edite la plantilla mientras tanto.
 */
export const guestWorkout = pgTable(
  "guest_workout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => routineShare.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id").references(() => routine.id, { onDelete: "set null" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    routineName: text("routine_name").notNull(),
    content: jsonb("content").$type<RoutineContent>().notNull(),
    status: guestWorkoutStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Cuenta creada (o existente) que reclamó el entrenamiento al terminar
    claimedBy: text("claimed_by").references(() => user.id, { onDelete: "set null" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    // Sesión real generada al reclamar — el historial del invitado deja de ser anónimo
    claimedSessionId: uuid("claimed_session_id").references(() => trainingSession.id, { onDelete: "set null" }),
  },
  (t) => [index("guest_workout_share_idx").on(t.shareId)],
)

/**
 * Serie registrada por un invitado. No referencia `session_exercise` porque la
 * sesión real no existe todavía: la posición dentro del snapshot aplanado
 * (`exercise_order`) y el número de serie bastan para reconstruirla al reclamar.
 */
export const guestSetRecord = pgTable(
  "guest_set_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guestWorkoutId: uuid("guest_workout_id")
      .notNull()
      .references(() => guestWorkout.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    exerciseOrder: integer("exercise_order").notNull(),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps").notNull(),
    weightLbs: numeric("weight_lbs", { precision: 6, scale: 2 }).notNull().default("0"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("guest_set_record_workout_idx").on(t.guestWorkoutId)],
)
