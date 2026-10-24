import { buildApp } from "./app"
import { runMigrations } from "./migrate"
import { notifyStartup, registerTelegramWebhook } from "./services/telegram"

async function main() {
  console.log("🚀 Iniciando API...")
  try {
    await runMigrations()
  } catch (err) {
    console.error("❌ Error en migraciones:", err)
    throw err
  }

  const app = await buildApp()

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: "0.0.0.0" })

  notifyStartup().catch((err) => app.log.error(err, "no se pudo enviar el aviso de arranque a Telegram"))

  // En desarrollo no hay URL pública: el webhook solo se registra en producción
  if (process.env.NODE_ENV === "production") {
    registerTelegramWebhook(process.env.BETTER_AUTH_URL).then((ok) => ok && app.log.info("webhook de Telegram registrado")).catch((err) =>
      app.log.error(err, "no se pudo registrar el webhook de Telegram"),
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

export type { AppRouter } from "./routers"
