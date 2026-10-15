// Lógica pura del autocompletado con IA de ejercicios: sin DB ni red, para poder probarla aislada

type MuscleRole = "primary" | "secondary"

// Deja solo los músculos/equipo que existen en el catálogo que se le dio al modelo,
// sin duplicados. Si un músculo aparece con roles distintos, gana "primary".
export function sanitizeAutofillResult<T extends { muscles: { muscleId: string; role: MuscleRole }[]; equipment: string[] }>(
  raw: T,
  validMuscleIds: ReadonlySet<string>,
  validEquipmentIds: ReadonlySet<string>,
): T {
  const roles = new Map<string, MuscleRole>()
  for (const m of raw.muscles) {
    if (!validMuscleIds.has(m.muscleId)) continue
    if (roles.get(m.muscleId) !== "primary") roles.set(m.muscleId, m.role)
  }

  const equipment = [...new Set(raw.equipment.filter((id) => validEquipmentIds.has(id)))]

  return {
    ...raw,
    muscles: [...roles].map(([muscleId, role]) => ({ muscleId, role })),
    equipment,
  }
}
