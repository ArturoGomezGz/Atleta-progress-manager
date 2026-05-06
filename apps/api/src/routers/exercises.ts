import { db } from "@atleta/db/client"
import { exercise } from "@atleta/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"

export const exercisesRouter = router({
  list: protectedProcedure.query(() => {
    return db.select().from(exercise).orderBy(exercise.name)
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [newExercise] = await db.insert(exercise).values(input).returning()
      return newExercise
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(exercise).where(eq(exercise.id, input.id))
    }),
})
