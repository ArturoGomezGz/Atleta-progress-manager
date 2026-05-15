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

  // ALTER TYPE ADD VALUE no puede ejecutarse dentro de una transacción (restricción de PostgreSQL).
  // El migrador de Drizzle envuelve todo en una transacción, así que estos se corren antes.
  await client`ALTER TYPE "public"."athlete_session_status" ADD VALUE IF NOT EXISTS 'scheduled'`

  const db = drizzle(client)

  console.log("⏳ Aplicando migraciones...")
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") })
  console.log("✅ Migraciones aplicadas")

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
