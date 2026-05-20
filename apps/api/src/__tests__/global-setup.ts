import path from "node:path"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

export async function setup() {
  const url =
    process.env.DATABASE_URL_TEST ??
    "postgresql://postgres:postgres@localhost:5432/atleta_test"

  const client = postgres(url, { max: 1, connect_timeout: 5 })

  try {
    const db = drizzle(client)

    const migrationsPath = path.resolve(
      process.cwd(),
      "../../packages/db/src/migrations",
    )

    try {
      await migrate(db, { migrationsFolder: migrationsPath })
    } catch {
      // Algunas migraciones (ALTER TYPE ADD VALUE) no pueden correr dentro de
      // una transacción. Los safety nets de abajo compensan los fallos parciales.
    }

    // Safety nets: valores de enum y columnas que ciertas migraciones no pudieron
    // aplicar dentro de una transacción en instancias pre-existentes.
    await client`ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'scheduled'`
    await client`ALTER TYPE "public"."athlete_session_status" ADD VALUE IF NOT EXISTS 'completed'`
    await client`ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "scheduled_date" date`
    await client`ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "content" jsonb`
    await client`ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "content" jsonb DEFAULT '{"v":1,"items":[]}'::jsonb NOT NULL`
    await client`ALTER TABLE "exercise" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`
    await client`
      CREATE TABLE IF NOT EXISTS "user_preferences" (
        "user_id"            text    PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "rest_timer_enabled" boolean NOT NULL DEFAULT false,
        "rest_timer_seconds" integer NOT NULL DEFAULT 90
      )
    `
    await client`
      CREATE TABLE IF NOT EXISTS "exercise_save" (
        "user_id"     text NOT NULL REFERENCES "user"("id")     ON DELETE CASCADE,
        "exercise_id" uuid NOT NULL REFERENCES "exercise"("id") ON DELETE CASCADE,
        "saved_at"    timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "exercise_id")
      )
    `

    console.log("✅ Base de datos de test lista")
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { code?: string })?.code
    if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
      // Sin DB disponible — los tests unitarios no la necesitan.
      // Los tests de integración fallarán individualmente si la DB no está.
      console.warn("⚠️  Sin DB de test — solo tests unitarios disponibles")
      return
    }
    throw err
  } finally {
    await client.end()
  }
}
