import { db } from "@atleta/db/client"
import { team, teamMember, user } from "@atleta/db/schema"
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

  addMemberByEmail: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["coach", "athlete"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)

      const [found] = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1)

      if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "No existe un usuario con ese correo" })

      const [existing] = await db
        .select()
        .from(teamMember)
        .where(and(eq(teamMember.teamId, input.teamId), eq(teamMember.userId, found.id)))
        .limit(1)

      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario ya es miembro del equipo" })

      const [member] = await db.insert(teamMember).values({ teamId: input.teamId, userId: found.id, role: input.role }).returning()
      return { ...member, userName: found.name, userEmail: found.email }
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), userId: z.string(), role: z.enum(["coach", "athlete"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      if (input.userId === ctx.session.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes cambiar tu propio rol" })
      await db
        .update(teamMember)
        .set({ role: input.role })
        .where(and(eq(teamMember.teamId, input.teamId), eq(teamMember.userId, input.userId)))
    }),

  deleteTeam: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      await db.delete(team).where(eq(team.id, input.teamId))
    }),

  removeMember: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      if (input.userId === ctx.session.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes eliminarte del equipo" })
      await db
        .delete(teamMember)
        .where(and(eq(teamMember.teamId, input.teamId), eq(teamMember.userId, input.userId)))
    }),

  members: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      return db
        .select({
          id: teamMember.id,
          userId: teamMember.userId,
          role: teamMember.role,
          userName: user.name,
          userEmail: user.email,
        })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
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
