import cors from "@fastify/cors"
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify"
import { fromNodeHeaders } from "better-auth/node"
import Fastify from "fastify"
import { runMigrations } from "./migrate"
import { auth } from "./auth"
import { accountActions } from "./services/account-approval"
import { handleTelegramUpdate, isValidWebhookSecret, notifyStartup, registerTelegramWebhook } from "./services/telegram"
import { appRouter } from "./routers"
import { createContext } from "./trpc"

async function main() {
  console.log("🚀 Iniciando API...")
  try {
    await runMigrations()
  } catch (err) {
    console.error("❌ Error en migraciones:", err)
    throw err
  }

  // maxParamLength: tRPC agrupa varios procedimientos en la ruta (/trpc/a,b,c…); con el
  // límite por defecto de Fastify (100) las páginas con muchas consultas reciben 404
  const app = Fastify({ logger: true, maxParamLength: 5000 })

  await app.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  })

  // Auth routes — better-auth handles all /api/auth/* internally
  app.all("/api/auth/*", async (req, reply) => {
    try {
      const response = await auth.handler(
        new Request(`${process.env.BETTER_AUTH_URL ?? "http://localhost:3001"}${req.url}`, {
          method: req.method,
          headers: fromNodeHeaders(req.headers),
          body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
        }),
      )
      reply.status(response.status)
      response.headers.forEach((value, key) => reply.header(key, value))
      const text = await response.text()
      if (response.status >= 500) {
        req.log.error({ status: response.status, body: text }, "better-auth 5xx")
      }
      reply.send(text || null)
    } catch (err) {
      req.log.error(err, "better-auth handler error")
      reply.status(500).send({ error: "Internal Server Error", requestId: req.id })
    }
  })

  // Botones del bot de Telegram (aprobar/rechazar cuentas). Telegram firma con un secreto en la cabecera.
  app.post("/api/telegram/webhook", async (req, reply) => {
    if (!isValidWebhookSecret(req.headers["x-telegram-bot-api-secret-token"] as string | undefined)) {
      return reply.status(401).send()
    }
    try {
      await handleTelegramUpdate(req.body as Parameters<typeof handleTelegramUpdate>[0], accountActions)
    } catch (err) {
      req.log.error(err, "telegram webhook error")
    }
    return reply.status(200).send()
  })

  // tRPC routes
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: "0.0.0.0" })

  notifyStartup().catch((err) => app.log.error(err, "no se pudo enviar el aviso de arranque a Telegram"))

  // En desarrollo no hay URL pública: el webhook solo se registra en producción
  if (process.env.NODE_ENV === "production") {
    registerTelegramWebhook(process.env.BETTER_AUTH_URL).then((ok) => ok && app.log.info("webhook de Telegram registrado")).catch((err) =>
      app.log.error(err, "no se pudo registrar el webhook de Telegram"),
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

export type { AppRouter } from "./routers"
