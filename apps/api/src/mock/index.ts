import { MOCK_PG_PORT } from "./env"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { runMigrations } from "@atleta/db/migrate"
import { seedMockData } from "./seed"

// ─── Servidor mock ─────────────────────────────────────────────────────────────
//
// Levanta la API real sin PostgreSQL: una base PGlite (Postgres compilado a WASM)
// vive en memoria dentro de este proceso y se expone por el protocolo de Postgres,
// así que Drizzle, better-auth y los routers funcionan sin cambios. Al arrancar se
// aplican las migraciones, los catálogos, las cuentas de prueba, los 638 ejercicios
// y los datos mock (rutinas y sesiones). Cada reinicio parte de cero.
//
//   pnpm dev:mock          → API mock + web en http://localhost:3000
//   pnpm --filter api mock → solo la API mock en :3001
//
// Ver docs/mock-server.md.

async function main() {
  const t0 = Date.now()

  const pg = await PGlite.create()
  // PGlite es de una sola conexión; el servidor multiplexa las que abran la API y las
  // migraciones (la API usa una sola, ver env.ts)
  const pgServer = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: MOCK_PG_PORT, maxConnections: 20 })
  await pgServer.start()

  process.env.SEED_DEMO_DATA = "true"
  await runMigrations()

  const seeded = await seedMockData()
  console.log(`🧪 Datos mock: ${seeded.routines} plantillas, ${seeded.sessions} sesiones, ${seeded.athletes} atletas extra (${Date.now() - t0} ms)`)

  // La API arranca al importarse, por eso se carga hasta aquí. Vuelve a correr las
  // migraciones (ya no hay nada pendiente) y los catálogos; las cuentas y los
  // ejercicios ya se sembraron arriba
  process.env.SEED_DEMO_DATA = "false"
  require("../index")

  console.log(`
🧪 API mock arrancando en :${process.env.PORT ?? 3001}  (base en memoria, se reinicia en cada arranque)
   Coach:   arturogomezgz04@gmail.com / admin
   Atletas: tester@gmail.com, abuela@gmail.com, diego@atleta.dev, sofia@atleta.dev / 12345678
`)

  const shutdown = async () => {
    await pgServer.stop().catch(() => {})
    await pg.close().catch(() => {})
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((err) => {
  console.error("❌ Servidor mock:", err)
  process.exit(1)
})
