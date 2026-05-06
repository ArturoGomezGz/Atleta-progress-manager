import { db } from "@atleta/db/client"
import { team, teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"

export const teamsRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [newTeam] = await db.insert(team).values({ name: input.name }).returning()
      await db.insert(teamMember).values({
        teamId: newTeam.id,
        userId: ctx.session.user.id,
        role: "coach",
      })
      return newTeam
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({ team, role: teamMember.role })
      .from(teamMember)
      .innerJoin(team, eq(teamMember.teamId, team.id))
      .where(eq(teamMember.userId, ctx.session.user.id))
  }),

  addMember: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string(),
        role: z.enum(["coach", "athlete"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [member] = await db.insert(teamMember).values(input).returning()
      return member
    }),

  removeMember: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      await db
        .delete(teamMember)
        .where(
          and(
            eq(teamMember.teamId, input.teamId),
            eq(teamMember.userId, input.userId),
          ),
        )
    }),

  members: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      return db
        .select()
        .from(teamMember)
        .where(eq(teamMember.teamId, input.teamId))
    }),
})

// Helpers — shared with other routers via re-export
export async function assertMember(userId: string, teamId: string) {
  const [member] = await db
    .select()
    .from(teamMember)
    .where(and(eq(teamMember.userId, userId), eq(teamMember.teamId, teamId)))
    .limit(1)
  if (!member) throw new TRPCError({ code: "FORBIDDEN" })
  return member
}

export async function assertCoach(userId: string, teamId: string) {
  const member = await assertMember(userId, teamId)
  if (member.role !== "coach") throw new TRPCError({ code: "FORBIDDEN" })
  return member
}
