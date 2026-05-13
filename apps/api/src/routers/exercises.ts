import { db } from "@atleta/db/client"
import {
  equipment,
  exercise,
  exerciseEquipment,
  exerciseMuscle,
  muscle,
  muscleGroup,
  team,
  teamMember,
} from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"
import { protectedProcedure, router } from "../trpc"
import { assertCoach } from "./teams"
import { createDirectUploadUrl, deleteVideo } from "../services/cloudflare-stream"

const anthropic = new Anthropic()

// ── Zod schemas ───────────────────────────────────────────────────────────────

const difficultySchema = z.enum(["beginner", "intermediate", "advanced"])
const suitableForSchema = z.enum(["warmup", "evaluation"])

const movementPatternSchema = z.enum([
  "push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility",
])

const muscleInputSchema = z.object({
  muscleId: z.string().uuid(),
  role: z.enum(["primary", "secondary"]),
})

// ── Helper: attach muscles + equipment to a list of exercises ─────────────────

async function attachDetails(exercises: (typeof exercise.$inferSelect)[]) {
  if (exercises.length === 0) return []

  const ids = exercises.map((e) => e.id)

  const [muscles, equipments] = await Promise.all([
    db
      .select({
        exerciseId: exerciseMuscle.exerciseId,
        role: exerciseMuscle.role,
        muscleId: muscle.id,
        muscleName: muscle.name,
        muscleGroupId: muscleGroup.id,
        muscleGroupName: muscleGroup.name,
        bodyZone: muscleGroup.bodyZone,
      })
      .from(exerciseMuscle)
      .innerJoin(muscle, eq(exerciseMuscle.muscleId, muscle.id))
      .innerJoin(muscleGroup, eq(muscle.muscleGroupId, muscleGroup.id))
      .where(inArray(exerciseMuscle.exerciseId, ids)),
    db
      .select({
        exerciseId: exerciseEquipment.exerciseId,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
      })
      .from(exerciseEquipment)
      .innerJoin(equipment, eq(exerciseEquipment.equipmentId, equipment.id))
      .where(inArray(exerciseEquipment.exerciseId, ids)),
  ])

  const musclesByExercise = new Map<string, typeof muscles>()
  for (const m of muscles) {
    const list = musclesByExercise.get(m.exerciseId) ?? []
    list.push(m)
    musclesByExercise.set(m.exerciseId, list)
  }

  const equipmentByExercise = new Map<string, typeof equipments>()
  for (const eq of equipments) {
    const list = equipmentByExercise.get(eq.exerciseId) ?? []
    list.push(eq)
    equipmentByExercise.set(eq.exerciseId, list)
  }

  return exercises.map((ex) => ({
    ...ex,
    muscles: (musclesByExercise.get(ex.id) ?? []).map((m) => ({
      muscleId: m.muscleId,
      muscleName: m.muscleName,
      role: m.role,
      muscleGroupId: m.muscleGroupId,
      muscleGroupName: m.muscleGroupName,
      bodyZone: m.bodyZone,
    })),
    equipment: (equipmentByExercise.get(ex.id) ?? []).map((e) => ({
      equipmentId: e.equipmentId,
      equipmentName: e.equipmentName,
    })),
  }))
}

// Helper: replace junction rows for an exercise (delete + insert)
async function replaceJunctions(
  exerciseId: string,
  muscles: { muscleId: string; role: "primary" | "secondary" }[],
  equipmentIds: string[],
) {
  await db.delete(exerciseMuscle).where(eq(exerciseMuscle.exerciseId, exerciseId))
  await db.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, exerciseId))

  if (muscles.length > 0) {
    await db.insert(exerciseMuscle).values(
      muscles.map((m) => ({ exerciseId, muscleId: m.muscleId, role: m.role })),
    )
  }
  if (equipmentIds.length > 0) {
    await db.insert(exerciseEquipment).values(
      equipmentIds.map((equipmentId) => ({ exerciseId, equipmentId })),
    )
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const exercisesRouter = router({

  // Catalog endpoints — used by create/edit forms
  listMuscleGroups: protectedProcedure.query(async () => {
    const groups = await db.select().from(muscleGroup).orderBy(asc(muscleGroup.name))
    const muscles = await db.select().from(muscle).orderBy(asc(muscle.name))

    return groups.map((g) => ({
      ...g,
      muscles: muscles.filter((m) => m.muscleGroupId === g.id),
    }))
  }),

  listEquipment: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return db
      .select()
      .from(equipment)
      .where(or(eq(equipment.isGlobal, true), eq(equipment.createdBy, userId)))
      .orderBy(asc(equipment.name))
  }),

  // Get single exercise with full detail
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const [ex] = await db.select().from(exercise).where(eq(exercise.id, input.id)).limit(1)
      if (!ex) throw new TRPCError({ code: "NOT_FOUND" })

      // Visibility check
      const canView =
        ex.isPublic ||
        ex.ownerUserId === null ||
        ex.ownerUserId === userId ||
        ex.ownerTeamId !== null

      if (!canView) throw new TRPCError({ code: "FORBIDDEN" })

      const [enriched] = await attachDetails([ex])
      return enriched
    }),

  // List exercises visible to the user from a specific team context
  list: protectedProcedure
    .input(z.object({ teamId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const userTeams = await db
        .select({ teamId: teamMember.teamId })
        .from(teamMember)
        .where(eq(teamMember.userId, userId))

      const teamIds = userTeams.map((t) => t.teamId)

      const exercises = await db
        .select()
        .from(exercise)
        .where(
          or(
            and(isNull(exercise.ownerUserId), isNull(exercise.ownerTeamId)),
            eq(exercise.isPublic, true),
            eq(exercise.ownerUserId, userId),
            ...(teamIds.length > 0 ? [inArray(exercise.ownerTeamId, teamIds)] : []),
          ),
        )
        .orderBy(asc(exercise.name))

      const targetTeamId = input?.teamId
      const enriched = await attachDetails(exercises)

      return enriched.map((ex) => {
        let category: "team" | "system" | "mine" | "public"
        if (targetTeamId && ex.ownerTeamId === targetTeamId) category = "team"
        else if (!ex.ownerUserId && !ex.ownerTeamId) category = "system"
        else if (ex.ownerUserId === userId) category = "mine"
        else category = "public"
        return { ...ex, category }
      })
    }),

  // List exercises owned by the user or their coached teams
  listOwned: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const coachedTeams = await db
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .innerJoin(team, eq(teamMember.teamId, team.id))
      .where(and(eq(teamMember.userId, userId), eq(teamMember.role, "coach")))

    const coachedTeamIds = coachedTeams.map((t) => t.teamId)

    const exercises = await db
      .select()
      .from(exercise)
      .where(
        or(
          eq(exercise.ownerUserId, userId),
          ...(coachedTeamIds.length > 0 ? [inArray(exercise.ownerTeamId, coachedTeamIds)] : []),
        ),
      )
      .orderBy(asc(exercise.name))

    return attachDetails(exercises)
  }),

  // List all exercises the user can see (personal + all their teams)
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

    const enriched = await attachDetails(exercises)

    return enriched.map((ex) => ({
      ...ex,
      editable:
        ex.ownerUserId === userId ||
        (ex.ownerTeamId !== null && coachTeamIds.has(ex.ownerTeamId)),
    }))
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        difficulty: difficultySchema.optional(),
        movementPatterns: z.array(movementPatternSchema).default([]),
        suitableFor: suitableForSchema.nullable().optional(),
        contraindications: z.string().optional(),
        videoUrl: z.string().optional(),
        isPublic: z.boolean().default(false),
        ownerType: z.enum(["user", "team"]),
        teamId: z.string().uuid().optional(),
        muscles: z.array(muscleInputSchema).default([]),
        equipment: z.array(z.string().uuid()).default([]),
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
          difficulty: input.difficulty,
          movementPatterns: input.movementPatterns,
          suitableFor: input.suitableFor ?? null,
          contraindications: input.contraindications,
          videoUrl: input.videoUrl,
          isPublic: input.isPublic,
          ownerUserId: input.ownerType === "user" ? userId : null,
          ownerTeamId: input.ownerType === "team" ? input.teamId : null,
          createdBy: userId,
        })
        .returning()

      await replaceJunctions(newExercise.id, input.muscles, input.equipment)

      const [enriched] = await attachDetails([newExercise])
      return enriched
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        difficulty: difficultySchema.nullable().optional(),
        movementPatterns: z.array(movementPatternSchema).optional(),
        suitableFor: suitableForSchema.nullable().optional(),
        contraindications: z.string().nullable().optional(),
        videoUrl: z.string().nullable().optional(),
        isPublic: z.boolean().optional(),
        muscles: z.array(muscleInputSchema).optional(),
        equipment: z.array(z.string().uuid()).optional(),
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

      const [updated] = await db
        .update(exercise)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
          ...(input.movementPatterns !== undefined && { movementPatterns: input.movementPatterns }),
          ...(input.suitableFor !== undefined && { suitableFor: input.suitableFor }),
          ...(input.contraindications !== undefined && { contraindications: input.contraindications }),
          ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
          ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
          updatedAt: new Date(),
        })
        .where(eq(exercise.id, input.id))
        .returning()

      if (input.muscles !== undefined || input.equipment !== undefined) {
        await replaceJunctions(
          updated.id,
          input.muscles ?? [],
          input.equipment ?? [],
        )
      }

      const [enriched] = await attachDetails([updated])
      return enriched
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

      if (ex.videoUrl) {
        await deleteVideo(ex.videoUrl).catch(() => {}) // best-effort
      }
      await db.delete(exercise).where(eq(exercise.id, input.id))
    }),

  // Returns a one-time Cloudflare direct upload URL + the video UID to store
  getVideoUploadUrl: protectedProcedure.mutation(async () => {
    const { uploadUrl, uid } = await createDirectUploadUrl()
    return { uploadUrl, uid }
  }),

  // Deletes a video from Cloudflare Stream (e.g. when replacing a video)
  deleteVideo: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async () => {
      // Note: caller must own the exercise — lightweight endpoint, auth via session is enough
    }),

  autofill: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [muscleGroups, muscles, equipmentCatalog] = await Promise.all([
        db.select().from(muscleGroup).orderBy(asc(muscleGroup.name)),
        db.select().from(muscle).orderBy(asc(muscle.name)),
        db.select({ id: equipment.id, name: equipment.name })
          .from(equipment)
          .where(eq(equipment.isGlobal, true))
          .orderBy(asc(equipment.name)),
      ])

      const musclesCatalogText = muscleGroups.map((g) => {
        const ms = muscles.filter((m) => m.muscleGroupId === g.id)
        return `${g.name}: ${ms.map((m) => `${m.name} (${m.id})`).join(", ")}`
      }).join("\n")

      const equipmentCatalogText = equipmentCatalog
        .map((e) => `${e.name} (${e.id})`).join(", ")

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        tools: [{
          name: "fill_exercise",
          description: "Fill in the exercise metadata based on its name and description",
          input_schema: {
            type: "object" as const,
            properties: {
              difficulty: {
                type: "string",
                enum: ["beginner", "intermediate", "advanced"],
                description: "Exercise difficulty level",
              },
              movementPatterns: {
                type: "array",
                items: { type: "string", enum: ["push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility"] },
                description: "Movement patterns this exercise belongs to",
              },
              suitableFor: {
                type: ["string", "null"],
                enum: ["warmup", "evaluation", null],
                description: "Special context: warmup, evaluation, or null for general",
              },
              muscles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    muscleId: { type: "string", description: "UUID from the catalog" },
                    role: { type: "string", enum: ["primary", "secondary"] },
                  },
                  required: ["muscleId", "role"],
                },
                description: "Muscles worked, using IDs from the catalog",
              },
              equipment: {
                type: "array",
                items: { type: "string", description: "Equipment UUID from the catalog" },
                description: "Equipment needed, using IDs from the catalog. Empty array if bodyweight.",
              },
            },
            required: ["difficulty", "movementPatterns", "suitableFor", "muscles", "equipment"],
          },
        }],
        tool_choice: { type: "tool", name: "fill_exercise" },
        messages: [{
          role: "user",
          content: `You are a certified strength & conditioning coach. Fill in the metadata for this exercise.

Exercise name: ${input.name}${input.description ? `\nDescription: ${input.description}` : ""}

MUSCLE CATALOG (use exact IDs):
${musclesCatalogText}

EQUIPMENT CATALOG (use exact IDs):
${equipmentCatalogText}

Rules:
- Only use IDs from the catalogs above
- For muscles, identify primary movers and secondary/stabilizers
- If bodyweight exercise, return empty equipment array
- Only use IDs from the catalogs above`,
        }],
      })

      const toolUse = response.content.find((b) => b.type === "tool_use")
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No response from AI" })
      }

      return toolUse.input as {
        difficulty: "beginner" | "intermediate" | "advanced"
        movementPatterns: string[]
        suitableFor: "warmup" | "evaluation" | null
        muscles: { muscleId: string; role: "primary" | "secondary" }[]
        equipment: string[]
      }
    }),
})
