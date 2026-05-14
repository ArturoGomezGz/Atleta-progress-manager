import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"
import { seedCatalogs } from "./seed-catalogs"

// Loads packages/db/.env locally; silently no-ops in Railway where vars are injected
config()

export async function runMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client)

  console.log("⏳ Aplicando migraciones...")
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") })
  console.log("✅ Migraciones aplicadas")

  await client.end()
}

async function main() {
  await runMigrations()
  await seedCatalogs()
}

if (require.main === module) {
  main().catch(console.error).finally(() => process.exit())
}
