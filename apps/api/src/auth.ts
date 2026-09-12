import { db } from "@atleta/db/client"
import * as schema from "@atleta/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.FROM_EMAIL ?? "onboarding@resend.dev"

// Sin RESEND_API_KEY (desarrollo local) el correo no se envía: el enlace se imprime en consola
async function sendEmail(to: string, subject: string, html: string, link: string) {
  if (!resend) {
    console.warn(`[email deshabilitado] ${subject} → ${to}: ${link}`)
    return
  }
  await resend.emails.send({ from: FROM, to, subject, html })
}

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
      await sendEmail(
        user.email,
        "Restablece tu contraseña",
        `<p>Haz clic <a href="${url}">aquí</a> para restablecer tu contraseña.</p><p>El enlace expira en 1 hora.</p>`,
        url,
      )
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

      await sendEmail(
        user.email,
        "Verifica tu cuenta",
        `<p>Haz clic <a href="${verifyUrl.toString()}">aquí</a> para verificar tu cuenta de Atleta CMW.</p>`,
        verifyUrl.toString(),
      )
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  trustedOrigins: [process.env.WEB_URL ?? "http://localhost:3000"],
  secret: process.env.BETTER_AUTH_SECRET!,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
