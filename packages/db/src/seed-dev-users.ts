import crypto from "node:crypto"
import { db } from "./client"
import { account, team, teamMember, user } from "./schema"
import { and, eq } from "drizzle-orm"

// Replica exacta del formato de @better-auth/utils/password (Node variant)
// salt_hex:key_hex — scrypt N=16384 r=16 p=1 dkLen=64
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex")
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)),
    )
  })
  return `${salt}:${key.toString("hex")}`
}

const DEV_USERS = [
  { email: "arturogomezgz04@gmail.com", name: "Arturo Gómez", password: "12345678", role: "coach"   as const },
  { email: "chinita@gmail.com",         name: "Chinita",       password: "12345678", role: "athlete" as const },
]

const TEAM_NAME = "Neo"

export async function seedDevUsers() {
  if (!process.env.SEED_DEV_USERS || process.env.SEED_DEV_USERS === "false") return

  console.log("🌱 Sembrando usuarios de desarrollo...")

  const now = new Date()

  // Crear o recuperar el equipo Neo
  let [neoTeam] = await db.select().from(team).where(eq(team.name, TEAM_NAME)).limit(1)
  if (!neoTeam) {
    ;[neoTeam] = await db
      .insert(team)
      .values({ name: TEAM_NAME, maxAthletes: 20, maxCoaches: 5 })
      .returning()
    console.log(`  ✓ Equipo "${TEAM_NAME}" creado`)
  } else {
    console.log(`  · Equipo "${TEAM_NAME}" ya existe`)
  }

  for (const dev of DEV_USERS) {
    // Verificar si el usuario ya existe
    const [existing] = await db.select().from(user).where(eq(user.email, dev.email)).limit(1)

    let userId: string

    if (existing) {
      userId = existing.id
      console.log(`  · Usuario ${dev.email} ya existe`)
    } else {
      userId = crypto.randomUUID()
      const passwordHash = await hashPassword(dev.password)

      await db.insert(user).values({
        id:            userId,
        name:          dev.name,
        email:         dev.email,
        emailVerified: true,
        createdAt:     now,
        updatedAt:     now,
      })

      await db.insert(account).values({
        id:         crypto.randomUUID(),
        accountId:  userId,
        providerId: "credential",
        userId,
        password:   passwordHash,
        createdAt:  now,
        updatedAt:  now,
      })

      console.log(`  ✓ Usuario ${dev.email} creado`)
    }

    // Agregar al equipo si no es miembro ya
    const [membership] = await db
      .select()
      .from(teamMember)
      .where(and(eq(teamMember.teamId, neoTeam.id), eq(teamMember.userId, userId)))
      .limit(1)

    if (!membership) {
      await db.insert(teamMember).values({ teamId: neoTeam.id, userId, role: dev.role })
      console.log(`  ✓ ${dev.email} agregado al equipo como ${dev.role}`)
    } else {
      console.log(`  · ${dev.email} ya es miembro del equipo`)
    }
  }

  console.log("✅ Seed de usuarios completado")
}
