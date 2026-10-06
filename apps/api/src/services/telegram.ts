import { timingSafeEqual } from "node:crypto"

// Bot de administración: avisa por Telegram de registros nuevos y recuperaciones de contraseña,
// y deja aprobar/rechazar cuentas con un botón. Sin TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID no hace nada.
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID
const WEBHOOK_SECRET = () => process.env.TELEGRAM_WEBHOOK_SECRET

export const telegramEnabled = Boolean(TOKEN() && CHAT_ID())

export type InlineButton = { text: string; callback_data: string }

export const APPROVE = "approve"
export const REJECT = "reject"

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Telegram ${method} respondió ${res.status}`)
  return res.json()
}

export async function sendTelegram(text: string, buttons?: InlineButton[]) {
  await call("sendMessage", {
    chat_id: CHAT_ID(),
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
  })
}

export function notifyNewSignup(user: { id: string; name: string; email: string }) {
  return sendTelegram(
    `🆕 <b>Nueva cuenta por revisar</b>\n${escapeHtml(user.name)}\n${escapeHtml(user.email)}`,
    [
      { text: "✅ Aprobar", callback_data: `${APPROVE}:${user.id}` },
      { text: "❌ Rechazar", callback_data: `${REJECT}:${user.id}` },
    ],
  )
}

export function notifyPasswordReset(user: { name: string; email: string }, url: string) {
  return sendTelegram(
    `🔑 <b>${escapeHtml(user.name)}</b> (${escapeHtml(user.email)}) pidió restablecer su contraseña.\n` +
      `Reenvíale este enlace (expira en 1 hora):\n${escapeHtml(url)}`,
  )
}

// Aviso de arranque: confirma que el bot está bien configurado cada vez que la API inicia.
export function notifyStartup() {
  if (!telegramEnabled) return Promise.resolve()
  return sendTelegram("🚀 Aplicación iniciada")
}

// Registra el webhook en Telegram al arrancar; solo con secreto y URL pública configurados.
export async function registerTelegramWebhook(publicUrl: string | undefined) {
  if (!telegramEnabled || !WEBHOOK_SECRET() || !publicUrl) return
  await call("setWebhook", {
    url: `${publicUrl}/api/telegram/webhook`,
    secret_token: WEBHOOK_SECRET(),
    allowed_updates: ["callback_query"],
  })
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function isValidWebhookSecret(header: string | undefined) {
  const secret = WEBHOOK_SECRET()
  return Boolean(secret && header && safeEqual(header, secret))
}

type Update = {
  callback_query?: {
    id: string
    data?: string
    from?: { id: number }
    message?: { message_id: number; chat: { id: number }; text?: string }
  }
}

export type AccountActions = {
  approve(userId: string): Promise<{ name: string; email: string } | null>
  reject(userId: string): Promise<{ name: string; email: string } | null>
}

// Procesa un botón pulsado. Solo obedece al chat del administrador.
export async function handleTelegramUpdate(
  update: Update,
  actions: AccountActions,
  reply: (queryId: string, chatId: number, messageId: number, text: string) => Promise<void> = defaultReply,
) {
  const q = update.callback_query
  const chatId = CHAT_ID()
  if (!q?.data || !q.message || !chatId) return
  if (String(q.from?.id) !== chatId || String(q.message.chat.id) !== chatId) return

  const [action, userId] = q.data.split(":")
  if (!userId || (action !== APPROVE && action !== REJECT)) return

  const result = action === APPROVE ? await actions.approve(userId) : await actions.reject(userId)
  const text = result
    ? `${action === APPROVE ? "✅ Aprobada" : "❌ Rechazada"}: ${escapeHtml(result.name)} (${escapeHtml(result.email)})`
    : "Esa cuenta ya fue procesada o no existe."
  await reply(q.id, q.message.chat.id, q.message.message_id, text)
}

async function defaultReply(queryId: string, chatId: number, messageId: number, text: string) {
  await call("answerCallbackQuery", { callback_query_id: queryId })
  // Reemplaza el mensaje y quita los botones para que no se pulsen dos veces
  await call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" })
}
