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

  await client.end()
}
