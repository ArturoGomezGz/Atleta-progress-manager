import { db } from "./client"
import { exercise } from "./schema"

const EXERCISES = [
  {
    name: "Back Squat",
    description: "Sentadilla trasera con barra apoyada en la parte alta del trapecio. Patrón de sentadilla fundamental para desarrollar fuerza en cuádriceps, glúteos e isquiotibiales.",
  },
  {
    name: "Bench Press",
    description: "Press de banca plano con barra. Empuje horizontal que trabaja pecho, hombro anterior y tríceps. La barra desciende hasta rozar el pecho en cada repetición.",
  },
  {
    name: "Overhead Press",
    description: "Press militar de pie con barra. Empuje vertical estricto que trabaja hombros, tríceps y core. La barra parte desde los hombros y sube hasta extensión completa de codos.",
  },
  {
    name: "Deadlift",
    description: "Peso muerto convencional con barra desde el suelo. Bisagra de cadera que recluta erector espinal, glúteos, isquiotibiales y toda la cadena posterior.",
  },
  {
    name: "Barbell Row",
    description: "Remo inclinado con barra. Tirón horizontal que trabaja dorsales, romboides y bíceps. El torso permanece a unos 45° y la barra sube hacia el abdomen.",
  },
  {
    name: "Pull-ups",
    description: "Dominadas en barra fija. Tirón vertical con peso corporal o cargado mediante cinturón con discos. Trabaja dorsales, bíceps y core. Agarre en pronación.",
  },
  {
    name: "Dips",
    description: "Fondos en paralelas. Empuje vertical descendente con peso corporal o cargado mediante cinturón con discos. Trabaja pecho inferior, hombro anterior y tríceps.",
  },
]

export async function seedExercises() {
  await db.insert(exercise).values(EXERCISES).onConflictDoNothing()
  console.log(`✓ Catálogo base: ${EXERCISES.length} ejercicios cargados`)
}

if (require.main === module) {
  seedExercises().catch(console.error).finally(() => process.exit())
}
