import { randomUUID } from "node:crypto"
import { db } from "@atleta/db/client"
import { exercise, routine, team, teamMember, user } from "@atleta/db/schema"
import type { MockUser } from "./caller"

// ── Usuarios ──────────────────────────────────────────────────────────────────

export async function seedUser(overrides: Partial<{ name: string; email: string }> = {}): Promise<MockUser> {
  const id = randomUUID()
  const [u] = await db
    .insert(user)
    .values({
      id,
      name: overrides.name ?? `User ${id.slice(0, 8)}`,
      email: overrides.email ?? `${id}@test.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  return { id: u.id, name: u.name, email: u.email }
}

// ── Equipos ───────────────────────────────────────────────────────────────────

export async function seedTeam(coachId: string, name?: string) {
  const [t] = await db
    .insert(team)
    .values({ name: name ?? `Team ${randomUUID().slice(0, 8)}` })
    .returning()
  await db.insert(teamMember).values({ teamId: t.id, userId: coachId, role: "coach" })
  return t
}

export async function addAthlete(teamId: string, athleteId: string) {
  await db.insert(teamMember).values({ teamId, userId: athleteId, role: "athlete" })
}

// ── Ejercicios ────────────────────────────────────────────────────────────────

/** Crea un ejercicio de sistema (sin dueño). Nombre único para evitar conflictos. */
export async function seedExercise(overrides: Partial<{ name: string; isPublic: boolean }> = {}) {
  const [e] = await db
    .insert(exercise)
    .values({
      name: overrides.name ?? `Exercise-${randomUUID().slice(0, 8)}`,
      isPublic: overrides.isPublic ?? false,
    })
    .returning()
  return e
}

// ── Rutinas ───────────────────────────────────────────────────────────────────

type SeedRoutineOpts = {
  name?: string
  category?: "evaluation" | "training"
  exerciseId?: string
}

/**
 * Crea una rutina para el equipo. Si se pasa `exerciseId`, el content incluye
 * ese ejercicio con 1 serie (3 reps al 80% RM) listo para crear sesiones.
 */
export async function seedRoutine(teamId: string, createdBy: string, opts: SeedRoutineOpts = {}) {
  const hasExercise = !!opts.exerciseId
  const content = hasExercise
    ? {
        v: 1 as const,
        items: [
          {
            type: "exercise" as const,
            id: randomUUID(),
            exerciseId: opts.exerciseId!,
            order: 0,
            sets: [
              {
                setNumber: 1,
                setType: "reps" as const,
                targetReps: 3,
                loadType: "percent_rm" as const,
                loadValue: 80,
              },
            ],
          },
        ],
      }
    : { v: 1 as const, items: [] }

  const [r] = await db
    .insert(routine)
    .values({
      teamId,
      createdBy,
      name: opts.name ?? `Routine-${randomUUID().slice(0, 8)}`,
      category: opts.category ?? "evaluation",
      content,
    })
    .returning()
  return r
}
