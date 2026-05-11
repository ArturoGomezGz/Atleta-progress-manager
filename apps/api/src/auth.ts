import { db } from "@atleta/db/client"
import * as schema from "@atleta/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.FROM_EMAIL ?? "onboarding@resend.dev"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: "Restablece tu contraseña",
        html: `<p>Haz clic <a href="${url}">aquí</a> para restablecer tu contraseña.</p><p>El enlace expira en 1 hora.</p>`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Ensure the post-verification redirect goes to the web app, not the API
      const verifyUrl = new URL(url)
      const callback = verifyUrl.searchParams.get("callbackURL") ?? "/dashboard"
      const absoluteCallback = callback.startsWith("http")
        ? callback
        : `${process.env.WEB_URL ?? "http://localhost:3000"}${callback}`
      verifyUrl.searchParams.set("callbackURL", absoluteCallback)

      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: "Verifica tu cuenta",
        html: `<p>Haz clic <a href="${verifyUrl.toString()}">aquí</a> para verificar tu cuenta de Atleta CMW.</p>`,
      })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [process.env.WEB_URL ?? "http://localhost:3000"],
  secret: process.env.BETTER_AUTH_SECRET!,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
