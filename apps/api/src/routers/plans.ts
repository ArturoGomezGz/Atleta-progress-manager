import { router } from "../trpc"

// Planes de entrenamiento multi-semana (flag `training_plans`). Stub del Paquete A;
// lo llena el Paquete D (list, get, create, update, duplicate, schedule, cancelAssignment)
// con featureProcedure("training_plans") + assertCoach / assertMember. Ver docs/mcp.md.
export const plansRouter = router({})
