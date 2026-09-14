import fs from "node:fs"
import path from "node:path"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

// Los mismos scripts que se ejecutan a mano en Railway (packages/db/sql) son la única fuente de los seeds.
const SQL_DIR = path.join(__dirname, "..", "sql")

async function runSqlFile(client: postgres.Sql, file: string) {
  await client.unsafe(fs.readFileSync(path.join(SQL_DIR, file), "utf8"))
  console.log(`✅ ${file}`)
}

export async function runMigrations() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
  const db = drizzle(client)

  try {
    console.log("⏳ Aplicando migraciones...")
    await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") })
    console.log("✅ Migraciones aplicadas")

    // Catálogos: siempre (idempotente)
    await runSqlFile(client, "02_catalogs.sql")

    // Cuentas de prueba + catálogo de ejercicios: solo si se pide explícitamente
    if (process.env.SEED_DEMO_DATA === "true") {
      await runSqlFile(client, "03_accounts.sql")
      await runSqlFile(client, "04_exercises.sql")
    }
  } finally {
    await client.end()
  }
}
