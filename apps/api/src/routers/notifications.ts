import { db } from "@atleta/db/client"
import { pushDevice } from "@atleta/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"

// Registro de teléfonos para notificaciones push (docs/notificaciones.md).
export const notificationsRouter = router({
  /** Guarda (o reasigna a este usuario) el token FCM del teléfono. Idempotente. */
  registerDevice: protectedProcedure
    .input(z.object({ token: z.string().min(20).max(4096), platform: z.enum(["android"]).default("android") }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(pushDevice)
        .values({ userId: ctx.session.user.id, token: input.token, platform: input.platform })
        .onConflictDoUpdate({
          target: pushDevice.token,
          set: { userId: ctx.session.user.id, platform: input.platform, updatedAt: new Date() },
        })
      return { ok: true as const }
    }),

  /** Al cerrar sesión: este teléfono deja de recibir avisos de esta cuenta. */
  unregisterDevice: protectedProcedure
    .input(z.object({ token: z.string().min(20).max(4096) }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(pushDevice).where(and(eq(pushDevice.token, input.token), eq(pushDevice.userId, ctx.session.user.id)))
      return { ok: true as const }
    }),
})
