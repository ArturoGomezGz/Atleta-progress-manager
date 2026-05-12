import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const teamRoleEnum = pgEnum("team_role", ["coach", "athlete"])

export type BrandColor = { color: string }

export const team = pgTable("team", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  maxAthletes: integer("max_athletes").notNull().default(1),
  maxCoaches: integer("max_coaches").notNull().default(1),
  logoDataUrl: text("logo_data_url"),
  brandPalette: jsonb("brand_palette").$type<BrandColor>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const teamMember = pgTable("team_member", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: teamRoleEnum("role").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
})

export const teamInvite = pgTable("team_invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
