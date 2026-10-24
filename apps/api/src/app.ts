// Construcción de la app Fastify (sin migraciones ni listen): la usan index.ts y los
// tests de integración (listen en un puerto libre). Registra CORS, el proxy de
// better-auth (/api/auth/*), el webhook de Telegram y tRPC.

import cors from "@fastify/cors"
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify"
import { fromNodeHeaders } from "better-auth/node"
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify"
import { auth } from "./auth"
import { appRouter } from "./routers"
import { accountActions } from "./services/account-approval"
import { handleTelegramUpdate, isValidWebhookSecret } from "./services/telegram"
import { createContext } from "./trpc"

// Rutas de better-auth que nunca se exponen por HTTP (defensa en profundidad): la
// administración de clientes OAuth y el plugin admin solo se usan desde el servidor.
const AUTH_DENYLIST = [
  /^\/api\/auth\/admin(\/|$)/,
  /^\/api\/auth\/oauth2\/(create-client|update-client|delete-client|get-clients)(\/|$)/,
  /^\/api\/auth\/oauth2\/client\/rotate-secret(\/|$)/,
]

export function isDeniedAuthPath(url: string): boolean {
  let path = url.split("?")[0]!
  try {
    path = decodeURIComponent(path)
  } catch {
    return true // codificación inválida: mejor no reenviarla
  }
  // Normaliza "//" y la barra final para que no se pueda esquivar la lista
  path = path.replace(/\/{2,}/g, "/").replace(/\/+$/, "")
  return AUTH_DENYLIST.some((re) => re.test(path))
}

export async function buildApp(opts: { logger?: FastifyServerOptions["logger"] } = {}): Promise<FastifyInstance> {
  // maxParamLength: tRPC agrupa varios procedimientos en la ruta (/trpc/a,b,c…); con el
  // límite por defecto de Fastify (100) las páginas con muchas consultas reciben 404
  const app = Fastify({ logger: opts.logger ?? true, maxParamLength: 5000 })

  await app.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  })

  // OAuth (p. ej. /oauth2/token) usa application/x-www-form-urlencoded: se guarda el
  // cuerpo crudo y se reenvía tal cual a better-auth (sin esto Fastify responde 415)
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => done(null, body))

  // Auth routes — better-auth handles all /api/auth/* internally
  app.all("/api/auth/*", async (req, reply) => {
    if (isDeniedAuthPath(req.url)) return reply.status(404).send({ error: "Not Found" })
    try {
      const hasBody = req.method !== "GET" && req.method !== "HEAD"
      const response = await auth.handler(
        new Request(`${process.env.BETTER_AUTH_URL ?? "http://localhost:3001"}${req.url}`, {
          method: req.method,
          headers: fromNodeHeaders(req.headers),
          body: hasBody ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : undefined,
        }),
      )
      reply.status(response.status)
      response.headers.forEach((value, key) => reply.header(key, value))
      const text = await response.text()
      if (response.status >= 500) {
        req.log.error({ status: response.status, body: text }, "better-auth 5xx")
      }
      return reply.send(text || null)
    } catch (err) {
      req.log.error(err, "better-auth handler error")
      return reply.status(500).send({ error: "Internal Server Error", requestId: req.id })
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

  return app
}
