import { sql } from "drizzle-orm"
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { team } from "./teams"

export const exercise = pgTable(
  "exercise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    ownerTeamId: uuid("owner_team_id").references(() => team.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // System exercises (no owner): unique by name
    uniqueIndex("exercise_name_system_unique")
      .on(t.name)
      .where(sql`"owner_user_id" IS NULL AND "owner_team_id" IS NULL`),
    // User-owned exercises: unique by name per user
    uniqueIndex("exercise_name_user_unique")
      .on(t.name, t.ownerUserId)
      .where(sql`"owner_user_id" IS NOT NULL`),
    // Team-owned exercises: unique by name per team
    uniqueIndex("exercise_name_team_unique")
      .on(t.name, t.ownerTeamId)
      .where(sql`"owner_team_id" IS NOT NULL`),
  ],
)
