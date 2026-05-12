import { pgEnum, pgTable, primaryKey, text, boolean, uuid, unique } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"

// ── Body zone enum (derived in queries, stored in muscle_group for reference) ──

export const bodyZoneEnum = pgEnum("body_zone", ["upper", "lower", "core"])

export const muscleRoleEnum = pgEnum("muscle_role", ["primary", "secondary"])

// ── Catalogs ──

export const muscleGroup = pgTable("muscle_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  bodyZone: bodyZoneEnum("body_zone").notNull(),
})

export const muscle = pgTable("muscle", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  muscleGroupId: uuid("muscle_group_id").notNull().references(() => muscleGroup.id, { onDelete: "cascade" }),
}, (t) => [
  unique("muscle_name_group_unique").on(t.name, t.muscleGroupId),
])

export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isGlobal: boolean("is_global").notNull().default(false),
  // null = platform-owned equipment; set = private to that user
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
})

// ── Junction tables ──

export const exerciseMuscle = pgTable("exercise_muscle", {
  exerciseId: uuid("exercise_id").notNull().references(() => exercise.id, { onDelete: "cascade" }),
  muscleId: uuid("muscle_id").notNull().references(() => muscle.id, { onDelete: "cascade" }),
  role: muscleRoleEnum("role").notNull(),
}, (t) => [
  primaryKey({ columns: [t.exerciseId, t.muscleId] }),
])

export const exerciseEquipment = pgTable("exercise_equipment", {
  exerciseId: uuid("exercise_id").notNull().references(() => exercise.id, { onDelete: "cascade" }),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.exerciseId, t.equipmentId] }),
])
