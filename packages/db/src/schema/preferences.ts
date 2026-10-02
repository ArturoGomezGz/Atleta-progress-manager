import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"
import { user } from "./auth"

// Onboarding de la web (docs/onboarding.md). null = el usuario no tiene onboarding.
// "active" = en curso, "dismissed" = cerrado con "Ahora no" (reabrible), "completed" = terminado.
export type OnboardingState = {
  status: "active" | "dismissed" | "completed"
  /** Equipo por defecto al que pertenece el onboarding. */
  teamId: string
}

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  restTimerEnabled: boolean("rest_timer_enabled").notNull().default(false),
  restTimerSeconds: integer("rest_timer_seconds").notNull().default(90),
  restAutoContinue: boolean("rest_auto_continue").notNull().default(true),
  onboarding: jsonb("onboarding").$type<OnboardingState>(),
})
