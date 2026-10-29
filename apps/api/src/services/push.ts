// Notificaciones push por Firebase Cloud Messaging (HTTP v1), sin SDK: se firma un JWT con la
// cuenta de servicio, se cambia por un token OAuth y se llama a la API de FCM con fetch.
// Sin FIREBASE_SERVICE_ACCOUNT no hace nada (desarrollo, tests). Ver docs/notificaciones.md.

import { createSign } from "node:crypto"
import { db } from "@atleta/db/client"
import { pushDevice, routine, user } from "@atleta/db/schema"
import { eq, inArray } from "drizzle-orm"

type ServiceAccount = { project_id: string; client_email: string; private_key: string }

/** Canal Android de estos avisos (lo crea la app, ver apps/mobile/src/lib/notifications.ts). */
export const ASSIGNMENTS_CHANNEL = "assigned-workouts"

let cachedAccount: ServiceAccount | null | undefined

/** Lee FIREBASE_SERVICE_ACCOUNT: el JSON de la cuenta de servicio, tal cual o en base64. */
function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  cachedAccount = null
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) as Partial<ServiceAccount>
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      cachedAccount = { project_id: parsed.project_id, client_email: parsed.client_email, private_key: parsed.private_key }
    } else {
      console.error("FIREBASE_SERVICE_ACCOUNT no trae project_id, client_email y private_key; push desactivado")
    }
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido (ni base64 de uno); push desactivado")
  }
  return cachedAccount
}

export const pushEnabled = () => serviceAccount() !== null

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url")

let cachedToken: { value: string; expiresAt: number } | null = null

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value
  const now = Math.floor(Date.now() / 1000)
  const unsigned = [
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    b64url(JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })),
  ].join(".")
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key)
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  })
  if (!res.ok) throw new Error(`Google OAuth respondió ${res.status}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return json.access_token
}

export type PushMessage = {
  title: string
  body: string
  /** Datos para la app (todos los valores son texto). */
  data?: Record<string, string>
}

type SendResult = "ok" | "invalid-token" | "error"

async function sendToToken(account: ServiceAccount, bearer: string, token: string, msg: PushMessage): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: msg.data,
        android: { priority: "HIGH", notification: { channel_id: ASSIGNMENTS_CHANNEL } },
      },
    }),
  })
  if (res.ok) return "ok"
  // UNREGISTERED / INVALID_ARGUMENT del token: la app se desinstaló o el token caducó
  const text = await res.text().catch(() => "")
  if (res.status === 404 || (res.status === 400 && text.includes("registration token"))) return "invalid-token"
  console.error(`FCM respondió ${res.status}: ${text.slice(0, 300)}`)
  return "error"
}

/** Envía un aviso a todos los dispositivos de los usuarios y borra los tokens que FCM ya no acepta. */
export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<void> {
  const account = serviceAccount()
  if (!account || userIds.length === 0) return
  const devices = await db.select({ id: pushDevice.id, token: pushDevice.token }).from(pushDevice).where(inArray(pushDevice.userId, userIds))
  if (devices.length === 0) return
  const bearer = await accessToken(account)
  const dead: string[] = []
  await Promise.all(devices.map(async (d) => {
    if ((await sendToToken(account, bearer, d.token, msg)) === "invalid-token") dead.push(d.id)
  }))
  if (dead.length > 0) await db.delete(pushDevice).where(inArray(pushDevice.id, dead))
}

export type AssignmentNotice = {
  coachId: string
  athleteIds: string[]
  routineId: string
  /** Sesiones creadas (una por fecha), en el orden de `dates`. */
  sessionIds: string[]
  dates: (string | null)[]
  /** "Hoy" (YYYY-MM-DD) para distinguir lo de ahora de lo programado. */
  today: string
  /** Si viene de un plan, se manda un solo aviso del plan en vez de uno por sesión. */
  planName?: string
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
}

/**
 * Avisa a los atletas que su entrenador les puso un entrenamiento. No avisa al propio coach
 * (auto-entrenamiento). Nunca lanza: un fallo de FCM no debe romper la asignación.
 */
export async function notifyWorkoutAssigned(n: AssignmentNotice): Promise<void> {
  try {
    if (!pushEnabled()) return
    const recipients = n.athleteIds.filter((id) => id !== n.coachId)
    if (recipients.length === 0 || n.sessionIds.length === 0) return

    const [[coach], [r]] = await Promise.all([
      db.select({ name: user.name }).from(user).where(eq(user.id, n.coachId)).limit(1),
      db.select({ name: routine.name }).from(routine).where(eq(routine.id, n.routineId)).limit(1),
    ])
    const coachName = coach?.name ?? "Tu entrenador"
    const routineName = r?.name ?? "un entrenamiento"

    let title: string
    let body: string
    if (n.planName) {
      title = "Nuevo plan de entrenamiento"
      body = `${coachName} te asignó el plan «${n.planName}».`
    } else if (n.sessionIds.length > 1) {
      title = "Nuevos entrenamientos"
      body = `${coachName} te asignó ${n.sessionIds.length} entrenamientos: «${routineName}».`
    } else {
      const date = n.dates[0]
      const later = date != null && date > n.today
      title = "Nuevo entrenamiento"
      body = later
        ? `${coachName} te programó «${routineName}» para el ${dayLabel(date)}.`
        : `${coachName} te asignó «${routineName}». ¡A entrenar!`
    }
    // Con una sola sesión la notificación abre su vista previa; si no, la lista
    const data: Record<string, string> = { type: "workout_assigned" }
    if (n.sessionIds.length === 1 && !n.planName) data.sessionId = n.sessionIds[0]!
    await sendPushToUsers(recipients, { title, body, data })
  } catch (err) {
    console.error("No se pudo enviar la notificación de entrenamiento asignado:", err)
  }
}
