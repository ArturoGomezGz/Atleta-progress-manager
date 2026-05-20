/** Fórmula de Epley para estimar 1RM: weight × (1 + reps / 30) */
export function epley(weightLbs: number, reps: number): number {
  return weightLbs * (1 + reps / 30)
}
