import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"

// Teléfonos que reciben notificaciones push (FCM). Un usuario puede tener varios
// dispositivos; el token es único y, si cambia de dueño (otra cuenta en el mismo
// teléfono), se reasigna. Ver docs/notificaciones.md.
export const pushDevice = pgTable(
  "push_device",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Token de registro de FCM. */
    token: text("token").notNull().unique(),
    platform: text("platform").notNull().default("android"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_device_user_idx").on(t.userId)],
)
