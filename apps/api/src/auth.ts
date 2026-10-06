import { db } from "@atleta/db/client"
import * as schema from "@atleta/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { Resend } from "resend"
import { createRateLimiter } from "./lib/rate-limit"
import { mobileOrigin } from "./services/mobile-origin"
import { notifyNewSignup, notifyPasswordReset, telegramEnabled } from "./services/telegram"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.FROM_EMAIL ?? "onboarding@resend.dev"

// Enmascara el email para logs: "arturo@dominio.com" → "a***@dominio.com"
function maskEmail(email: string) {
  const at = email.indexOf("@")
  if (at <= 0) return "***"
  return `${email[0]}***${email.slice(at)}`
}

// Sin RESEND_API_KEY (desarrollo local) el correo no se envía: el enlace se imprime en consola.
// En producción nunca se loguea el enlace (contiene el token) ni el email completo.
async function sendEmail(to: string, subject: string, html: string, link: string) {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[ALERTA] RESEND_API_KEY no configurada en producción — "${subject}" no se envió a ${maskEmail(to)}`)
    } else {
      console.warn(`[email deshabilitado] ${subject} → ${to}: ${link}`)
    }
    return
  }
  await resend.emails.send({ from: FROM, to, subject, html })
}

// Solo para el entorno de testing: las cuentas nuevas nacen verificadas y con sesión iniciada, sin correo.
const AUTO_VERIFY_EMAIL = process.env.AUTO_VERIFY_EMAIL === "true"

// Con Telegram, el registro avisa al administrador en vez de mandar un correo. Better Auth vuelve
// a llamar al hook en cada intento de login de una cuenta pendiente: un aviso por cuenta cada 10 min.
const signupNotice = createRateLimiter({ max: 1, windowMs: 10 * 60_000 })

// El enlace de Better Auth lleva un callbackURL relativo; se vuelve absoluto hacia el web
function withAbsoluteCallback(url: string, fallback: string) {
  const u = new URL(url)
  const callback = u.searchParams.get("callbackURL") ?? fallback
  const absolute = callback.startsWith("http") ? callback : `${process.env.WEB_URL ?? "http://localhost:3000"}${callback}`
  u.searchParams.set("callbackURL", absolute)
  return u.toString()
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
    requireEmailVerification: !AUTO_VERIFY_EMAIL,
    sendResetPassword: async ({ user, url }) => {
      if (telegramEnabled) {
        await notifyPasswordReset(user, withAbsoluteCallback(url, "/reset-password"))
        return
      }
      await sendEmail(
        user.email,
        "Restablece tu contraseña",
        `<p>Haz clic <a href="${url}">aquí</a> para restablecer tu contraseña.</p><p>El enlace expira en 1 hora.</p>`,
        url,
      )
    },
  },
  emailVerification: {
    sendOnSignUp: !AUTO_VERIFY_EMAIL,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (telegramEnabled) {
        if (signupNotice.hit(user.id).ok) await notifyNewSignup(user)
        return
      }

      // Ensure the post-verification redirect goes to the web app, not the API
      const verifyUrl = withAbsoluteCallback(url, "/dashboard")
      await sendEmail(
        user.email,
        "Verifica tu cuenta",
        `<p>Haz clic <a href="${verifyUrl}">aquí</a> para verificar tu cuenta de Atleta CMW.</p>`,
        verifyUrl,
      )
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: AUTO_VERIFY_EMAIL ? { ...user, emailVerified: true } : user }),
      },
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
  plugins: [mobileOrigin()],
  trustedOrigins: [
    process.env.WEB_URL ?? "http://localhost:3000",
    "atleta://",
    // Expo Go / dev client en desarrollo
    ...(process.env.NODE_ENV === "production" ? [] : ["exp://"]),
  ],
  secret: process.env.BETTER_AUTH_SECRET!,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
