import cors from "@fastify/cors"
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify"
import { fromNodeHeaders } from "better-auth/node"
import Fastify, { type FastifyBaseLogger } from "fastify"
import { runMigrations } from "./migrate"
import { auth } from "./auth"
import { appRouter } from "./routers"
import { refreshExerciseStats } from "./services/exercise-stats"
import { createContext } from "./trpc"

// Recalcular dentro del proceso evita un servicio cron aparte en Railway, que costaría
// más que la funcionalidad completa. El agregado es idempotente: si un arranque se lo
// salta, el siguiente ciclo lo corrige.
const STATS_REFRESH_MINUTES = Number(process.env.EXERCISE_STATS_REFRESH_MINUTES ?? 60)

function scheduleExerciseStats(log: FastifyBaseLogger) {
  const run = async () => {
    try {
      const { rows, durationMs } = await refreshExerciseStats()
      log.info({ rows, durationMs }, "exercise_stats recalculado")
    } catch (err) {
      // Es una caché de ranking: que falle degrada el orden, no el producto
      log.error(err, "Falló el recálculo de exercise_stats")
    }
  }
  void run()
  setInterval(run, STATS_REFRESH_MINUTES * 60_000)
}

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
      reply.status(500).send({ error: String(err) })
    }
  })

  // tRPC routes
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: "0.0.0.0" })

  scheduleExerciseStats(app.log)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

export type { AppRouter } from "./routers"
