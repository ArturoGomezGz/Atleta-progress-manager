import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"
import { seedCatalogs } from "./seed-catalogs"
import { seedDevUsers } from "./seed-dev-users"

// Loads packages/db/.env locally; silently no-ops in Railway where vars are injected
config()

export async function runMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client)

  // 1. Drizzle migrator — crea el schema base (tablas, tipos) en transacción
  console.log("⏳ Aplicando migraciones...")
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") })
  console.log("✅ Migraciones aplicadas")

  // 2. ALTER TYPE ADD VALUE — deben correr FUERA de transacción (restricción PostgreSQL)
  //    Se corren después del migrador para garantizar que los tipos ya existen
  await client`ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'scheduled'`
  await client`ALTER TYPE "public"."athlete_session_status" ADD VALUE IF NOT EXISTS 'completed'`
  await client`ALTER TYPE "public"."athlete_session_status" ADD VALUE IF NOT EXISTS 'scheduled'`

  // 3. Cambios de schema de migraciones 0004-0008 aplicadas manualmente (no están en el journal).
  //    Todos usan IF NOT EXISTS — seguros de re-ejecutar en instancias existentes.

  // 0004: limpiar tablas del sistema de sesiones antiguo
  await client`DROP TABLE IF EXISTS "athlete_set_completion"`
  await client`DROP TABLE IF EXISTS "athlete_session_execution"`
  await client`DROP TABLE IF EXISTS "assigned_session"`
  await client`DROP TYPE IF EXISTS "public"."assigned_session_status"`
  await client`DROP TYPE IF EXISTS "public"."athlete_session_execution_status"`

  // 0005: scheduled_date en training_session
  await client`ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "scheduled_date" date`

  // 0006: content en training_session + tabla user_preferences
  await client`ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "content" jsonb`
  await client`
    CREATE TABLE IF NOT EXISTS "user_preferences" (
      "user_id" text PRIMARY KEY NOT NULL,
      "rest_timer_enabled" boolean NOT NULL DEFAULT false,
      "rest_timer_seconds" integer NOT NULL DEFAULT 90,
      CONSTRAINT "user_preferences_user_id_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
    )
  `

  // 0008: campos de seguimiento por atleta en athlete_session
  await client`ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone`
  await client`ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone`
  await client`ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "rpe" integer`

  await client.end()
}

async function main() {
  await runMigrations()
  await seedCatalogs()
  await seedDevUsers()
}

if (require.main === module) {
  main().catch(console.error).finally(() => process.exit())
}
