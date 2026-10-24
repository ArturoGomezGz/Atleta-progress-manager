// Infraestructura de pruebas de integración: API real (buildApp) contra un Postgres de
// pruebas. Cada archivo *.itest.ts corre en su propio proceso (node --test) y llama a
// startTestServer(), que:
//   1. elige un puerto libre y fija el entorno ANTES de importar src/ (db, auth y flags
//      leen process.env al importarse);
//   2. reinicia los schemas `public` y `drizzle` y corre runMigrations() (migraciones +
//      catálogos + seeds de demo);
//   3. levanta la app en 127.0.0.1:<puerto>.
// Sin TEST_DATABASE_URL las suites se omiten (ver `integrationSkip`). La BD se BORRA:
// su nombre debe contener "test" (o TEST_DATABASE_ALLOW_RESET=true). Ver docs/mcp.md.

import { createServer } from "node:net"
import type { FastifyInstance } from "fastify"
import postgres from "postgres"
import { FIXTURE_EMAILS } from "./fixtures"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

/** Valor para `describe(..., { skip })`: false si hay BD de pruebas, o el motivo. */
export const integrationSkip: string | false = TEST_DATABASE_URL
  ? false
  : "TEST_DATABASE_URL no definida: se omiten las pruebas de integración (ver scripts/test-db.sh)"

if (integrationSkip) console.warn(`⚠️  ${integrationSkip}`)

export type TestServer = {
  app: FastifyInstance
  /** Origen de la API, p. ej. http://127.0.0.1:54321 (también es WEB_URL y BETTER_AUTH_URL). */
  baseUrl: string
  close(): Promise<void>
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address()
      const port = typeof address === "object" && address ? address.port : 0
      srv.close(() => resolve(port))
    })
  })
}

function assertSafeToReset(url: string) {
  const dbName = new URL(url).pathname.replace(/^\//, "")
  if (!/test/i.test(dbName) && process.env.TEST_DATABASE_ALLOW_RESET !== "true") {
    throw new Error(`La BD "${dbName}" no parece de pruebas (el nombre debe contener "test"); define TEST_DATABASE_ALLOW_RESET=true si es correcto`)
  }
}

/** Borra todo (schemas public y drizzle) para que las migraciones corran en limpio. */
export async function resetDatabase(url: string) {
  assertSafeToReset(url)
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `)
  } finally {
    await sql.end()
  }
}

export async function startTestServer(opts: { env?: Record<string, string>; seedDemoData?: boolean } = {}): Promise<TestServer> {
  if (!TEST_DATABASE_URL) throw new Error(integrationSkip || "TEST_DATABASE_URL no definida")

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_SECRET: "integration-test-secret-integration-test-secret",
    WEB_URL: baseUrl,
    API_PUBLIC_URL: baseUrl,
    AUTO_VERIFY_EMAIL: "true",
    SEED_DEMO_DATA: opts.seedDemoData === false ? "false" : "true",
    // Coach A, coach B y el atleta de A con todos los flags; el usuario "sin mcp" sin ninguno
    FEATURE_ALL_USERS: [FIXTURE_EMAILS.coachA, FIXTURE_EMAILS.coachB, FIXTURE_EMAILS.athleteA].join(","),
    // Sin avisos externos durante las pruebas
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_CHAT_ID: "",
    RESEND_API_KEY: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    ...opts.env,
  })

  await resetDatabase(TEST_DATABASE_URL)
  const { runMigrations } = await import("../../src/migrate")
  await runMigrations()

  const { buildApp } = await import("../../src/app")
  const app = await buildApp({ logger: process.env.TEST_LOG === "true" ? { level: "info" } : false })
  await app.listen({ port, host: "127.0.0.1" })

  return {
    app,
    baseUrl,
    async close() {
      await app.close()
      // El cliente postgres-js de @atleta/db/client mantiene el proceso vivo si no se cierra
      const { db } = await import("@atleta/db/client")
      await (db.$client as postgres.Sql).end({ timeout: 5 })
    },
  }
}
