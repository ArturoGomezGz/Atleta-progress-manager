import { db } from "@atleta/db/client"
import * as schema from "@atleta/db/schema"
import { and, eq } from "drizzle-orm"
import type { AccountActions } from "./telegram"

// Aprobar una cuenta = marcar `email_verified`: requireEmailVerification ya bloquea el login hasta entonces.
// Solo actúan sobre cuentas pendientes, así un botón viejo no toca cuentas ya aprobadas.
const pending = (userId: string) => and(eq(schema.user.id, userId), eq(schema.user.emailVerified, false))

export const accountActions: AccountActions = {
  async approve(userId) {
    const [row] = await db
      .update(schema.user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(pending(userId))
      .returning({ name: schema.user.name, email: schema.user.email })
    return row ?? null
  },
  async reject(userId) {
    const [row] = await db
      .delete(schema.user)
      .where(pending(userId))
      .returning({ name: schema.user.name, email: schema.user.email })
    return row ?? null
  },
}
