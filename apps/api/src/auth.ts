import { db } from "@atleta/db/client"
import * as schema from "@atleta/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.WEB_URL ?? "http://localhost:3000"],
  secret: process.env.BETTER_AUTH_SECRET!,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
