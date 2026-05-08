import { pgEnum, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { exercise } from "./exercises"
import { team } from "./teams"
import { athleteExerciseRm } from "./sessions"

export const reportSourceEnum = pgEnum("report_source", ["ai", "coach"])

export const exerciseProgressReport = pgTable(
  "exercise_progress_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    athleteId: text("athlete_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercise.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    reportSource: reportSourceEnum("report_source").notNull().default("ai"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    triggerRmId: uuid("trigger_rm_id").references(() => athleteExerciseRm.id, { onDelete: "set null" }),
  },
  (t) => [unique("uq_report_athlete_exercise").on(t.athleteId, t.exerciseId)],
)
