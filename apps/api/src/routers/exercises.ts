import { db } from "@atleta/db/client"
import { exercise, team, teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { protectedProcedure, router } from "../trpc"
import { assertCoach } from "./teams"

export const exercisesRouter = router({
  list: protectedProcedure
    .input(z.object({ teamId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const userTeams = await db
        .select({ teamId: teamMember.teamId })
        .from(teamMember)
        .where(eq(teamMember.userId, userId))

      const teamIds = userTeams.map((t) => t.teamId)

      const visibilityConditions = [
        and(isNull(exercise.ownerUserId), isNull(exercise.ownerTeamId)),
        eq(exercise.isPublic, true),
        eq(exercise.ownerUserId, userId),
        ...(teamIds.length > 0 ? [inArray(exercise.ownerTeamId, teamIds)] : []),
      ]

      const exercises = await db
        .select()
        .from(exercise)
        .where(or(...visibilityConditions))
        .orderBy(asc(exercise.name))

      const targetTeamId = input?.teamId

      return exercises.map((ex) => {
        let category: "team" | "system" | "mine" | "public"
        if (targetTeamId && ex.ownerTeamId === targetTeamId) {
          category = "team"
        } else if (!ex.ownerUserId && !ex.ownerTeamId) {
          category = "system"
        } else if (ex.ownerUserId === userId) {
          category = "mine"
        } else {
          category = "public"
        }
        return { ...ex, category }
      })
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        isPublic: z.boolean().default(false),
        ownerType: z.enum(["user", "team"]),
        teamId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      if (input.ownerType === "team") {
        if (!input.teamId) throw new TRPCError({ code: "BAD_REQUEST", message: "teamId requerido" })
        await assertCoach(userId, input.teamId)
      }

      const [newExercise] = await db
        .insert(exercise)
        .values({
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
          ownerUserId: input.ownerType === "user" ? userId : null,
          ownerTeamId: input.ownerType === "team" ? input.teamId : null,
          createdBy: userId,
        })
        .returning()

      return newExercise
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [ex] = await db.select().from(exercise).where(eq(exercise.id, input.id)).limit(1)
      if (!ex) throw new TRPCError({ code: "NOT_FOUND" })

      if (ex.ownerUserId !== null) {
        if (ex.ownerUserId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
      } else if (ex.ownerTeamId !== null) {
        await assertCoach(userId, ex.ownerTeamId)
      } else {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const patch: Partial<typeof ex> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.description !== undefined) patch.description = input.description
      if (input.isPublic !== undefined) patch.isPublic = input.isPublic

      const [updated] = await db.update(exercise).set(patch).where(eq(exercise.id, input.id)).returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [ex] = await db.select().from(exercise).where(eq(exercise.id, input.id)).limit(1)
      if (!ex) throw new TRPCError({ code: "NOT_FOUND" })

      if (ex.ownerUserId !== null) {
        if (ex.ownerUserId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
      } else if (ex.ownerTeamId !== null) {
        await assertCoach(userId, ex.ownerTeamId)
      } else {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await db.delete(exercise).where(eq(exercise.id, input.id))
    }),

  listOwned: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const coachedTeams = await db
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .innerJoin(team, eq(teamMember.teamId, team.id))
      .where(and(eq(teamMember.userId, userId), eq(teamMember.role, "coach")))

    const coachedTeamIds = coachedTeams.map((t) => t.teamId)

    return db
      .select()
      .from(exercise)
      .where(
        or(
          eq(exercise.ownerUserId, userId),
          ...(coachedTeamIds.length > 0 ? [inArray(exercise.ownerTeamId, coachedTeamIds)] : []),
        ),
      )
      .orderBy(asc(exercise.name))
  }),

  listAllOwned: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const allTeams = await db
      .select({ teamId: teamMember.teamId, role: teamMember.role })
      .from(teamMember)
      .where(eq(teamMember.userId, userId))

    const allTeamIds = allTeams.map((t) => t.teamId)
    const coachTeamIds = new Set(
      allTeams.filter((t) => t.role === "coach").map((t) => t.teamId),
    )

    const exercises = await db
      .select()
      .from(exercise)
      .where(
        or(
          eq(exercise.ownerUserId, userId),
          ...(allTeamIds.length > 0 ? [inArray(exercise.ownerTeamId, allTeamIds)] : []),
        ),
      )
      .orderBy(asc(exercise.name))

    return exercises.map((ex) => ({
      ...ex,
      editable:
        ex.ownerUserId === userId ||
        (ex.ownerTeamId !== null && coachTeamIds.has(ex.ownerTeamId)),
    }))
  }),
})
