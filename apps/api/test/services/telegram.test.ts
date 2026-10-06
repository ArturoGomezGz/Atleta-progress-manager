import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { escapeHtml, handleTelegramUpdate, isValidWebhookSecret } from "../../src/services/telegram"

process.env.TELEGRAM_BOT_TOKEN = "t"
process.env.TELEGRAM_CHAT_ID = "42"
process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret"


const query = (data: string, fromId = 42, chatId = 42) => ({
  callback_query: { id: "q1", data, from: { id: fromId }, message: { message_id: 7, chat: { id: chatId } } },
})

function setup() {
  const calls: string[] = []
  const actions = {
    approve: async (id: string) => (calls.push(`approve:${id}`), { name: "Ana", email: "a@x.com" }),
    reject: async (id: string) => (calls.push(`reject:${id}`), null),
  }
  const replies: string[] = []
  const reply = async (_q: string, _c: number, _m: number, text: string) => void replies.push(text)
  return { calls, actions, replies, reply }
}

describe("telegram webhook", () => {
  it("valida el secreto de la cabecera", () => {
    assert.equal(isValidWebhookSecret("s3cret"), true)
    assert.equal(isValidWebhookSecret("otro"), false)
    assert.equal(isValidWebhookSecret(undefined), false)
  })

  it("aprueba cuando el botón viene del chat del administrador", async () => {
    const t = setup()
    await handleTelegramUpdate(query("approve:u1"), t.actions, t.reply)
    assert.deepEqual(t.calls, ["approve:u1"])
    assert.match(t.replies[0]!, /Aprobada/)
  })

  it("ignora a cualquier otro usuario o chat", async () => {
    const t = setup()
    await handleTelegramUpdate(query("approve:u1", 99), t.actions, t.reply)
    await handleTelegramUpdate(query("approve:u1", 42, 99), t.actions, t.reply)
    assert.deepEqual(t.calls, [])
    assert.deepEqual(t.replies, [])
  })

  it("ignora acciones desconocidas y avisa si la cuenta ya no está pendiente", async () => {
    const t = setup()
    await handleTelegramUpdate(query("drop:u1"), t.actions, t.reply)
    assert.deepEqual(t.calls, [])
    await handleTelegramUpdate(query("reject:u1"), t.actions, t.reply)
    assert.match(t.replies[0]!, /ya fue procesada/)
  })

  it("escapa HTML", () => {
    assert.equal(escapeHtml("<b>&"), "&lt;b&gt;&amp;")
  })
})
