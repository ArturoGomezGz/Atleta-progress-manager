import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const exercise = pgTable("exercise", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
