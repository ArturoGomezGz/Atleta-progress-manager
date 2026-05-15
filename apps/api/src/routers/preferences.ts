import { db } from "@atleta/db/client"
import { userPreferences } from "@atleta/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"

export const preferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1)

    return prefs ?? { userId, restTimerEnabled: false, restTimerSeconds: 90 }
  }),

  update: protectedProcedure
    .input(z.object({
      restTimerEnabled: z.boolean().optional(),
      restTimerSeconds: z.number().int().min(10).max(600).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [result] = await db
        .insert(userPreferences)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: input,
        })
        .returning()
      return result
    }),
})
