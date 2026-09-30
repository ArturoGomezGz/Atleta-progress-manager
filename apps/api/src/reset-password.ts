// Uso (solo administrador): pnpm --filter api reset-password <email> [nuevaContraseña]
// Sin contraseña explícita se usa la genérica; el usuario debe cambiarla en /settings.
import { db } from "@atleta/db/client"
import * as schema from "@atleta/db/schema"
import { hashPassword } from "better-auth/crypto"
import { and, eq } from "drizzle-orm"

const DEFAULT_PASSWORD = "changeMe123"

async function main() {
  const [email, password = DEFAULT_PASSWORD] = process.argv.slice(2)
  if (!email) {
    console.error("Uso: pnpm --filter api reset-password <email> [nuevaContraseña]")
    process.exit(1)
  }

  const [user] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email.toLowerCase()))
  if (!user) {
    console.error(`No existe un usuario con el correo ${email}`)
    process.exit(1)
  }

  const updated = await db
    .update(schema.account)
    .set({ password: await hashPassword(password), updatedAt: new Date() })
    .where(and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential")))
    .returning({ id: schema.account.id })
  if (updated.length === 0) {
    console.error("El usuario no tiene contraseña (¿inicia sesión solo con Google?)")
    process.exit(1)
  }

  // Cierra las sesiones abiertas: quien tuviera la cuenta abierta debe volver a entrar
  await db.delete(schema.session).where(eq(schema.session.userId, user.id))

  console.log(`Contraseña de ${email} restablecida a "${password}". Debe cambiarla en Configuración.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
