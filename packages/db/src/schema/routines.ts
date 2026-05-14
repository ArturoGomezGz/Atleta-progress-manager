import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { team } from "./teams"

// ─── Content types ─────────────────────────────────────────────────────────────

export type SetType     = "reps" | "time" | "distance" | "amrap"
export type LoadType    = "fixed_kg" | "percent_rm" | "rpe"
export type ExerciseGoal = "strength" | "hypertrophy" | "endurance" | "power" | "cardio" | "recovery"

export type RoutineSet = {
  setNumber: number
  setType: SetType
  targetReps?: number
  targetDurationSeconds?: number
  targetDistanceMeters?: number
  loadType?: LoadType
  loadValue?: number
}

export type RoutineExerciseContent = {
  id: string              // UUID estable — referenciado por athleteSetCompletion.routineExerciseId
  exerciseId: string
  order: number
  tempo?: string          // "3-1-2-0"
  restSeconds?: number
  goal?: ExerciseGoal
  notes?: string
  sets: RoutineSet[]
}

export type RoutineItemExercise = { type: "exercise" } & RoutineExerciseContent

export type RoutineItemBlock = {
  type: "block"
  id: string
  order: number
  name?: string
  rounds: number
  exercises: RoutineExerciseContent[]
}

export type RoutineContent = {
  v: 1
  items: Array<RoutineItemExercise | RoutineItemBlock>
}

// ─── Schema ────────────────────────────────────────────────────────────────────

export const routineCategoryEnum = pgEnum("routine_category", ["evaluation", "training"])

export const routine = pgTable("routine", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  teamId:    uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => user.id),
  category:  routineCategoryEnum("category").notNull().default("training"),
  content:   jsonb("content").$type<RoutineContent>().notNull().default({ v: 1, items: [] } as RoutineContent),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
