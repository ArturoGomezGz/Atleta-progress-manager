import { config } from "dotenv"
import { runMigrations } from "./run-migrations"

// Carga packages/db/.env en local; en Railway las variables ya vienen inyectadas
config()

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
