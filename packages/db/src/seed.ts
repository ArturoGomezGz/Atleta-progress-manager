import { db } from "./client"
import { exercise, routine, routineExercise, team, teamMember } from "./schema"
import { seedExercises } from "./seed-exercises"

const API_URL = process.env.API_URL ?? "http://localhost:3001"

async function createUser(name: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Error creando usuario ${email}: ${JSON.stringify(data)}`)
  return data.user as { id: string; email: string }
}

async function seed() {
  console.log("🌱 Iniciando seed...\n")

  // Users via better-auth
  const coach = await createUser("Coach Demo", "coach@atleta.dev", "atleta123")
  const athlete1 = await createUser("Atleta Uno", "atleta1@atleta.dev", "atleta123")
  const athlete2 = await createUser("Atleta Dos", "atleta2@atleta.dev", "atleta123")
  console.log("✓ Usuarios creados")

  // Team
  const [newTeam] = await db.insert(team).values({ name: "Equipo Demo" }).returning()
  await db.insert(teamMember).values([
    { teamId: newTeam.id, userId: coach.id, role: "coach" },
    { teamId: newTeam.id, userId: athlete1.id, role: "athlete" },
    { teamId: newTeam.id, userId: athlete2.id, role: "athlete" },
  ])
  console.log("✓ Equipo y miembros creados")

  // Global exercise catalog
  await seedExercises()
  const exercises = await db.select().from(exercise)

  // Sample routine
  const [newRoutine] = await db
    .insert(routine)
    .values({ name: "Rutina A — Fuerza", teamId: newTeam.id, createdBy: coach.id })
    .returning()

  await db.insert(routineExercise).values([
    { routineId: newRoutine.id, exerciseId: exercises[0].id, targetSets: 3, targetReps: 5, targetWeight: "100", order: 0 },
    { routineId: newRoutine.id, exerciseId: exercises[1].id, targetSets: 3, targetReps: 5, targetWeight: "80", order: 1 },
    { routineId: newRoutine.id, exerciseId: exercises[2].id, targetSets: 1, targetReps: 5, targetWeight: "120", order: 2 },
  ])
  console.log("✓ Rutina de ejemplo creada\n")

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  coach@atleta.dev    / atleta123  (entrenador)")
  console.log("  atleta1@atleta.dev  / atleta123  (atleta)")
  console.log("  atleta2@atleta.dev  / atleta123  (atleta)")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

seed().catch(console.error).finally(() => process.exit())
