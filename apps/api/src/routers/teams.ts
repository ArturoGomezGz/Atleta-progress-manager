import { db } from "@atleta/db/client"
import { team, teamInvite, teamMember, user } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, count, eq, gt } from "drizzle-orm"
import { randomBytes } from "node:crypto"
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

  getInviteLink: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      const [invite] = await db
        .select({ token: teamInvite.token, expiresAt: teamInvite.expiresAt })
        .from(teamInvite)
        .where(and(eq(teamInvite.teamId, input.teamId), gt(teamInvite.expiresAt, new Date())))
        .limit(1)
      return invite ?? null
    }),

  generateInviteLink: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)

      const [teamData] = await db.select().from(team).where(eq(team.id, input.teamId)).limit(1)
      const [{ athleteCount }] = await db
        .select({ athleteCount: count() })
        .from(teamMember)
        .where(and(eq(teamMember.teamId, input.teamId), eq(teamMember.role, "athlete")))

      if (athleteCount >= teamData.maxAthletes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El equipo ha alcanzado el límite de atletas" })
      }

      await db.delete(teamInvite).where(eq(teamInvite.teamId, input.teamId))
      const token = randomBytes(24).toString("hex")
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await db.insert(teamInvite).values({ teamId: input.teamId, token, createdBy: ctx.session.user.id, expiresAt })
      return { token, expiresAt }
    }),

  joinViaInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [invite] = await db.select().from(teamInvite).where(eq(teamInvite.token, input.token)).limit(1)
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no válida o expirada" })
      if (invite.expiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "La invitación ha expirado" })

      const [existing] = await db
        .select()
        .from(teamMember)
        .where(and(eq(teamMember.teamId, invite.teamId), eq(teamMember.userId, ctx.session.user.id)))
        .limit(1)

      if (!existing) {
        const [teamData] = await db.select().from(team).where(eq(team.id, invite.teamId)).limit(1)
        const [{ athleteCount }] = await db
          .select({ athleteCount: count() })
          .from(teamMember)
          .where(and(eq(teamMember.teamId, invite.teamId), eq(teamMember.role, "athlete")))

        if (athleteCount >= teamData.maxAthletes) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El equipo ya está lleno" })
        }

        await db.insert(teamMember).values({ teamId: invite.teamId, userId: ctx.session.user.id, role: "athlete" })
      }

      // Single-use: delete the invite regardless of whether user was already a member
      await db.delete(teamInvite).where(eq(teamInvite.id, invite.id))

      const [teamData] = await db.select().from(team).where(eq(team.id, invite.teamId)).limit(1)
      return { teamId: invite.teamId, teamName: teamData.name, logoDataUrl: teamData.logoDataUrl ?? null, alreadyMember: !!existing }
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

  getBranding: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.session.user.id, input.teamId)
      const [data] = await db
        .select({ logoDataUrl: team.logoDataUrl, brandPalette: team.brandPalette })
        .from(team)
        .where(eq(team.id, input.teamId))
        .limit(1)
      return data ?? null
    }),

  updateBranding: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      logoDataUrl: z.string().optional(),
      brandColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCoach(ctx.session.user.id, input.teamId)
      await db.update(team).set({
        ...(input.logoDataUrl !== undefined && { logoDataUrl: input.logoDataUrl }),
        ...(input.brandColor !== undefined && { brandPalette: { color: input.brandColor } }),
      }).where(eq(team.id, input.teamId))
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
