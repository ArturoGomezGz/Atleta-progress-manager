// Tipos de bloque del día (calentamiento, principal, recuperación) y motivos de bloqueo, en español.
export type BlockKind = "warmup" | "main" | "recovery" | null
export type LockReason = "FUTURE" | "PREVIOUS_STEP_PENDING" | "ANOTHER_ACTIVE" | null

export function kindLabel(kind: BlockKind, category: "evaluation" | "training" | null) {
  if (category === "evaluation") return "Evaluación"
  if (kind === "warmup") return "Calentamiento"
  if (kind === "recovery") return "Recuperación"
  if (kind === "main") return "Entrenamiento principal"
  return "Entrenamiento"
}

/** Para "Empezar <calentamiento|entrenamiento|recuperación>" y "Se desbloquea al terminar ...". */
export function kindNoun(kind: BlockKind) {
  if (kind === "warmup") return "calentamiento"
  if (kind === "recovery") return "recuperación"
  return "entrenamiento"
}

/** Motivo de bloqueo para el atleta; `date` es el texto "sábado 31 de octubre" cuando se conoce. */
export function lockMessage(reason: LockReason, date?: string) {
  if (reason === "FUTURE") return date ? `Podrás empezarlo el ${date}.` : "Aún no es su fecha."
  if (reason === "PREVIOUS_STEP_PENDING") return "Primero termina el bloque anterior."
  if (reason === "ANOTHER_ACTIVE") return "Termina o abandona el entrenamiento en curso."
  return ""
}
