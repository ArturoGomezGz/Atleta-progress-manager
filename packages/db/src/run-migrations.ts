import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"

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

  // Safety net: ensure routine_exercise FK uses CASCADE (migration 0015 may have
  // run without statement-breakpoints and silently failed)
  await client`
    ALTER TABLE "routine_exercise"
      DROP CONSTRAINT IF EXISTS "routine_exercise_exercise_id_exercise_id_fk"
  `
  await client`
    ALTER TABLE "routine_exercise"
      ADD CONSTRAINT "routine_exercise_exercise_id_exercise_id_fk"
      FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE CASCADE
  `
  // Safety net: add deleted_at column if migration 0016 hasn't applied yet
  await client`
    ALTER TABLE "exercise" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
  `

  console.log("✅ Tablas verificadas")

  await client.end()
}
