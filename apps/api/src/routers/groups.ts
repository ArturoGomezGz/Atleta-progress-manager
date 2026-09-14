import { db } from "@atleta/db/client"
import { teamGroup, teamGroupMember, user, teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach, assertMember } from "./teams"

export const groupsRouter = router({
  create: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [g] = await db
        .insert(teamGroup)
        .values({ teamId: input.teamId, name: input.name, createdBy: ctx.session.user.id })
        .returning()
      return g
    }),

  list: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const groups = await db.select().from(teamGroup).where(eq(teamGroup.teamId, input.teamId))
      const groupsWithMembers = await Promise.all(
        groups.map(async (g) => {
          const members = await db
            .select({ athleteId: teamGroupMember.athleteId, name: user.name, email: user.email })
            .from(teamGroupMember)
            .innerJoin(user, eq(teamGroupMember.athleteId, user.id))
            .where(eq(teamGroupMember.groupId, g.id))
          return { ...g, members }
        }),
      )
      return groupsWithMembers
    }),

  addMember: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [g] = await db.select().from(teamGroup).where(eq(teamGroup.id, input.groupId)).limit(1)
      if (!g) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, g.teamId)

      const [member] = await db
        .select()
        .from(teamMember)
        .where(and(eq(teamMember.teamId, g.teamId), eq(teamMember.userId, input.athleteId), eq(teamMember.role, "athlete")))
        .limit(1)
      if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario no es atleta del equipo" })

      await db
        .insert(teamGroupMember)
        .values({ groupId: input.groupId, athleteId: input.athleteId })
        .onConflictDoNothing()
    }),

  removeMember: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), athleteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [g] = await db.select().from(teamGroup).where(eq(teamGroup.id, input.groupId)).limit(1)
      if (!g) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, g.teamId)
      await db
        .delete(teamGroupMember)
        .where(and(eq(teamGroupMember.groupId, input.groupId), eq(teamGroupMember.athleteId, input.athleteId)))
    }),

  delete: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [g] = await db.select().from(teamGroup).where(eq(teamGroup.id, input.groupId)).limit(1)
      if (!g) throw new TRPCError({ code: "NOT_FOUND" })
      await assertCoach(ctx.session.user.id, g.teamId)
      await db.delete(teamGroup).where(eq(teamGroup.id, input.groupId))
    }),
})
