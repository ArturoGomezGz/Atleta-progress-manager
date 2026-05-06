import cors from "@fastify/cors"
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify"
import { fromNodeHeaders } from "better-auth/node"
import Fastify from "fastify"
import { auth } from "./auth"
import { appRouter } from "./routers"
import { createContext } from "./trpc"

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  })

  // Auth routes — better-auth handles all /api/auth/* internally
  app.all("/api/auth/*", async (req, reply) => {
    const response = await auth.handler(
      new Request(`${process.env.BETTER_AUTH_URL ?? "http://localhost:3001"}${req.url}`, {
        method: req.method,
        headers: fromNodeHeaders(req.headers),
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
      }),
    )
    reply.status(response.status)
    response.headers.forEach((value, key) => reply.header(key, value))
    reply.send(response.body ? await response.text() : null)
  })

  // tRPC routes
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: "0.0.0.0" })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

export type { AppRouter } from "./routers"
