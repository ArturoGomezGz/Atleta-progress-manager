import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"
import { seedDevUsers } from "./seed-dev-users"

export async function runMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client)

  console.log("⏳ Aplicando migraciones...")
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") })
    console.log("✅ Migraciones aplicadas")
  } catch (err) {
    console.error("⚠️ Drizzle migrate falló (los safety nets compensarán):", err)
  }

  // Safety net: create tables that may have been recorded in __drizzle_migrations
  // but never actually created (e.g. due to a failed transaction on a previous deploy).
  await client`
    CREATE TABLE IF NOT EXISTS "exercise_save" (
      "user_id"    text      NOT NULL REFERENCES "user"("id")     ON DELETE CASCADE,
      "exercise_id" uuid     NOT NULL REFERENCES "exercise"("id") ON DELETE CASCADE,
      "saved_at"   timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY ("user_id", "exercise_id")
    )
  `

  // Safety net: deduplicate global equipment and ensure unique index exists
  // (the migration may have failed on DBs where seed ran multiple times)
  await client`
    DELETE FROM "equipment"
    WHERE id NOT IN (
      SELECT DISTINCT ON (name) id
      FROM "equipment"
      WHERE is_global = true AND created_by IS NULL
      ORDER BY name, id
    )
    AND is_global = true AND created_by IS NULL
  `
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS "equipment_global_name_unique"
    ON "equipment" (name)
    WHERE is_global = true AND created_by IS NULL
  `

  // Safety net: add deleted_at column if migration 0016 hasn't applied yet
  await client`
    ALTER TABLE "exercise" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
  `

  // Safety net: migración 0003 — schema híbrido de routine.content
  await client`
    ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "content" jsonb DEFAULT '{"v":1,"items":[]}'::jsonb NOT NULL
  `

  // Safety net: migración 0005 — agregar estado scheduled y scheduled_date
  // ALTER TYPE ADD VALUE no puede correr dentro de una transacción, por eso Drizzle migrate falla.
  // Lo ejecutamos aquí fuera de cualquier transacción para garantizar que el valor exista.
  await client`ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'scheduled'`
  await client`ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "scheduled_date" date`

  // Safety net: migración 0006 — snapshot JSON de rutina en sesión y preferencias de usuario
  await client`ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "content" jsonb`
  await client`
    CREATE TABLE IF NOT EXISTS "user_preferences" (
      "user_id"              text     PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "rest_timer_enabled"   boolean  NOT NULL DEFAULT false,
      "rest_timer_seconds"   integer  NOT NULL DEFAULT 90
    )
  `

  // Safety net: migración 0004 — eliminar sistema antiguo de sesiones asignadas
  await client`DROP TABLE IF EXISTS "athlete_set_completion"`
  await client`DROP TABLE IF EXISTS "athlete_session_execution"`
  await client`DROP TABLE IF EXISTS "assigned_session"`
  await client`DROP TYPE IF EXISTS "public"."assigned_session_status"`
  await client`DROP TYPE IF EXISTS "public"."athlete_session_execution_status"`

  console.log("✅ Tablas verificadas")

  await client.end()

  await seedDevUsers()
}
