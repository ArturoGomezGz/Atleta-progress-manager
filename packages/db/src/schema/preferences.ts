import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  restTimerEnabled: boolean("rest_timer_enabled").notNull().default(false),
  restTimerSeconds: integer("rest_timer_seconds").notNull().default(90),
  restAutoContinue: boolean("rest_auto_continue").notNull().default(true),
  // Fecha en que se le mostró la bienvenida por primera vez. NULL = todavía no la ha visto.
  // Vive aquí y no en `user` porque better-auth es dueño de esa tabla.
  onboardingSeenAt: timestamp("onboarding_seen_at"),
})
