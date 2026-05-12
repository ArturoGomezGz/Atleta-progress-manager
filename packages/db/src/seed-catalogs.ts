import "dotenv/config"
import { db } from "./client"
import { equipment, muscle, muscleGroup } from "./schema"

// ── Muscle groups + muscles ──────────────────────────────────────────────────

const MUSCLE_GROUPS: {
  name: string
  bodyZone: "upper" | "lower" | "core"
  muscles: string[]
}[] = [
  {
    name: "Pecho",
    bodyZone: "upper",
    muscles: ["Pectoral mayor", "Pectoral menor"],
  },
  {
    name: "Espalda",
    bodyZone: "upper",
    muscles: ["Dorsal ancho", "Trapecio", "Romboides", "Erector espinal", "Redondo mayor"],
  },
  {
    name: "Hombro",
    bodyZone: "upper",
    muscles: ["Deltoides anterior", "Deltoides lateral", "Deltoides posterior", "Manguito rotador"],
  },
  {
    name: "Brazo",
    bodyZone: "upper",
    muscles: ["Bíceps", "Tríceps", "Braquial", "Braquiorradial"],
  },
  {
    name: "Antebrazo",
    bodyZone: "upper",
    muscles: ["Flexores del antebrazo", "Extensores del antebrazo"],
  },
  {
    name: "Abdomen",
    bodyZone: "core",
    muscles: ["Recto abdominal", "Oblicuo externo", "Oblicuo interno", "Transverso abdominal"],
  },
  {
    name: "Pierna",
    bodyZone: "lower",
    muscles: ["Cuádriceps", "Isquiotibiales", "Pantorrillas", "Sóleo", "Aductores", "Tibial anterior"],
  },
  {
    name: "Glúteo",
    bodyZone: "lower",
    muscles: ["Glúteo mayor", "Glúteo medio", "Glúteo menor"],
  },
]

// ── Equipment ────────────────────────────────────────────────────────────────

const EQUIPMENT: string[] = [
  "Mancuernas",
  "Barra olímpica",
  "Barra EZ",
  "Kettlebell",
  "Banda elástica",
  "Máquina / Cable",
  "Polea alta",
  "Polea baja",
  "TRX / Suspensión",
  "Balón medicinal",
  "Caja / Step",
  "Banco",
  "Barra de dominadas",
  "Anillas",
  "Rueda abdominal",
  "Pelota de estabilidad",
  "Bosu",
  "Sled",
  "Cuerda de batalla",
  "Trap bar",
]

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("⏳ Seeding catalogs...")

  // Muscle groups + muscles (upsert by name to make it idempotent)
  for (const group of MUSCLE_GROUPS) {
    const [inserted] = await db
      .insert(muscleGroup)
      .values({ name: group.name, bodyZone: group.bodyZone })
      .onConflictDoUpdate({ target: muscleGroup.name, set: { bodyZone: group.bodyZone } })
      .returning({ id: muscleGroup.id })

    for (const muscleName of group.muscles) {
      await db
        .insert(muscle)
        .values({ name: muscleName, muscleGroupId: inserted.id })
        .onConflictDoNothing()
    }
  }

  // Equipment (upsert by name + is_global)
  for (const name of EQUIPMENT) {
    await db
      .insert(equipment)
      .values({ name, isGlobal: true, createdBy: null })
      .onConflictDoNothing()
  }

  console.log("✓ Catalogs seeded")
  console.log(`  • ${MUSCLE_GROUPS.length} muscle groups`)
  console.log(`  • ${MUSCLE_GROUPS.reduce((acc, g) => acc + g.muscles.length, 0)} muscles`)
  console.log(`  • ${EQUIPMENT.length} equipment items`)
}

seed()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => process.exit(0))
