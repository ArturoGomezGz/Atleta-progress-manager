import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  restTimerEnabled: boolean("rest_timer_enabled").notNull().default(false),
  restTimerSeconds: integer("rest_timer_seconds").notNull().default(90),
})
