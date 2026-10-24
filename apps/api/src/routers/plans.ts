import { z } from "zod"
import { todayUtc } from "../services/session-assign"
import {
  cancelPlanAssignment,
  createPlan,
  duplicatePlan,
  getPlan,
  listPlans,
  planCancelAssignmentInputSchema,
  planCreateInputSchema,
  planDuplicateInputSchema,
  planScheduleInputSchema,
  planUpdateInputSchema,
  schedulePlan,
  updatePlan,
} from "../services/training-plans"
import { featureProcedure, router } from "../trpc"

// Planes de entrenamiento multi-semana (flag `training_plans`, que requiere
// `scheduled_sessions`). La lógica vive en services/training-plans.ts: lectura para
// miembros del equipo (las asignaciones solo las ve el coach) y escritura para coaches.
// Ver docs/mcp.md ("Planes de entrenamiento").
const planProcedure = featureProcedure("training_plans")

export const plansRouter = router({
  list: planProcedure
    .input(z.object({ teamId: z.string().uuid(), includeArchived: z.boolean().default(false) }))
    .query(({ ctx, input }) => listPlans(ctx.session.user, input)),

  get: planProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(({ ctx, input }) => getPlan(ctx.session.user, input)),

  create: planProcedure
    .input(planCreateInputSchema)
    .mutation(({ ctx, input }) => createPlan(ctx.session.user, input)),

  // Concurrencia optimista: expectedUpdatedAt distinto del actual → CONFLICT
  update: planProcedure
    .input(planUpdateInputSchema)
    .mutation(({ ctx, input }) => updatePlan(ctx.session.user, input)),

  duplicate: planProcedure
    .input(planDuplicateInputSchema)
    .mutation(({ ctx, input }) => duplicatePlan(ctx.session.user, input)),

  // "Hoy" en UTC, igual que sessions.create; dryRun no escribe nada
  schedule: planProcedure
    .input(planScheduleInputSchema)
    .mutation(({ ctx, input }) => schedulePlan(ctx.session.user, input, { today: todayUtc() })),

  cancelAssignment: planProcedure
    .input(planCancelAssignmentInputSchema)
    .mutation(({ ctx, input }) => cancelPlanAssignment(ctx.session.user, input)),
})
