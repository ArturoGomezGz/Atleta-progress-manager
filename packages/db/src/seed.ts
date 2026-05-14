import { db } from "./client"
import { team, teamMember } from "./schema"

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

  const coach = await createUser("Coach Demo", "coach@atleta.dev", "atleta123")
  const athlete1 = await createUser("Atleta Uno", "atleta1@atleta.dev", "atleta123")
  const athlete2 = await createUser("Atleta Dos", "atleta2@atleta.dev", "atleta123")
  console.log("✓ Usuarios creados")

  const [newTeam] = await db.insert(team).values({ name: "Equipo Demo" }).returning()
  await db.insert(teamMember).values([
    { teamId: newTeam.id, userId: coach.id, role: "coach" },
    { teamId: newTeam.id, userId: athlete1.id, role: "athlete" },
    { teamId: newTeam.id, userId: athlete2.id, role: "athlete" },
  ])
  console.log("✓ Equipo y miembros creados\n")

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("  coach@atleta.dev    / atleta123  (entrenador)")
  console.log("  atleta1@atleta.dev  / atleta123  (atleta)")
  console.log("  atleta2@atleta.dev  / atleta123  (atleta)")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

seed().catch(console.error).finally(() => process.exit())
