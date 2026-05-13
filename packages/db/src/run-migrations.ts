import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"

export async function runMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client)

  console.log("⏳ Aplicando migraciones...")
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") })
  console.log("✅ Migraciones aplicadas")

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
  console.log("✅ Tablas verificadas")

  await client.end()
}
