import "dotenv/config"
import { db } from "./client"
import { equipment, muscle, muscleGroup } from "./schema"

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

export async function seedCatalogs() {
  console.log("⏳ Seeding catalogs...")

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

  for (const name of EQUIPMENT) {
    await db
      .insert(equipment)
      .values({ name, isGlobal: true, createdBy: null })
      .onConflictDoNothing()
  }

  console.log("✓ Catalogs seeded")
}
