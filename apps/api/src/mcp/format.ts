// Vistas compactas (con ids) de lo que devuelven las herramientas MCP. Puro: recibe las filas que ya
// devolvieron los procedimientos tRPC. Nunca incluye datos de más (emails, contenido de sesiones…).

import type { RoutineContent, RoutineExerciseContent, RoutineSet } from "@atleta/db/schema"
import { toContentInput, type RoutineContentInput } from "../services/routine-content-input"

export type RoutineFormat = "outline" | "detail"

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString()

// ─── Series ───────────────────────────────────────────────────────────────────

function describeSet(s: RoutineSet): string {
  const volume =
    s.setType === "time" ? `${s.targetDurationSeconds ?? "?"} s`
    : s.setType === "distance" ? `${s.targetDistanceMeters ?? "?"} m`
    : s.setType === "amrap" ? "AMRAP"
    : `${s.targetReps ?? "?"} reps`
  const load = s.loadType && s.loadValue != null
    ? ` @ ${s.loadType === "rpe" ? `RPE ${s.loadValue}` : s.loadType === "percent_rm" ? `${s.loadValue}% RM` : `${s.loadValue} kg`}`
    : ""
  return volume + load
}

/** "3 × 10 reps @ RPE 7" o, si las series difieren, "10 reps · 8 reps · 6 reps". */
export function summarizeSets(sets: readonly RoutineSet[]): string {
  if (sets.length === 0) return "sin series"
  const parts = [...sets].sort((a, b) => a.setNumber - b.setNumber).map(describeSet)
  return parts.every((p) => p === parts[0]) ? `${parts.length} × ${parts[0]}` : parts.join(" · ")
}

// ─── Rutinas ──────────────────────────────────────────────────────────────────

type RoutineRow = {
  id: string
  name: string
  category: "evaluation" | "training"
  updatedAt: Date | string
  archivedAt: Date | string | null
  content: RoutineContent
}

export function countExercises(content: RoutineContent): number {
  return content.items.reduce((n, it) => n + (it.type === "exercise" ? 1 : it.exercises.length), 0)
}

export function toRoutineSummary(r: RoutineRow) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    updatedAt: iso(r.updatedAt),
    archived: r.archivedAt != null,
    itemCount: r.content.items.length,
    exerciseCount: countExercises(r.content),
  }
}

function exerciseOutline(e: RoutineExerciseContent, position: number, names: Readonly<Record<string, string>>) {
  return {
    position,
    id: e.id,
    exerciseId: e.exerciseId,
    exercise: names[e.exerciseId] ?? "Ejercicio no disponible",
    sets: summarizeSets(e.sets),
    ...(e.restSeconds !== undefined && { restSeconds: e.restSeconds }),
    ...(e.tempo !== undefined && { tempo: e.tempo }),
    ...(e.goal !== undefined && { goal: e.goal }),
    ...(e.notes !== undefined && { notes: e.notes }),
    ...(e.perSide && { perSide: true }),
  }
}

/** Ítems legibles: posición (0 = primero), ids para editar, nombre del ejercicio y series resumidas. */
export function routineOutline(content: RoutineContent, names: Readonly<Record<string, string>>) {
  return [...content.items]
    .sort((a, b) => a.order - b.order)
    .map((it, position) =>
      it.type === "exercise"
        ? { type: "exercise" as const, ...exerciseOutline(it, position, names) }
        : {
            position,
            type: "block" as const,
            id: it.id,
            ...(it.name !== undefined && { name: it.name }),
            rounds: it.rounds,
            ...(it.restBetweenRoundsSeconds !== undefined && { restBetweenRoundsSeconds: it.restBetweenRoundsSeconds }),
            exercises: [...it.exercises].sort((a, b) => a.order - b.order).map((e, i) => exerciseOutline(e, i, names)),
          },
    )
}

export type RoutineView = ReturnType<typeof toRoutineSummary> & {
  teamId: string
  items?: ReturnType<typeof routineOutline>
  content?: RoutineContentInput
  exerciseNames?: Record<string, string>
}

/**
 * Rutina para el cliente MCP.
 * - "outline": `items` legibles (series resumidas) con los ids que piden las herramientas de edición.
 * - "detail": `content` en el formato exacto que aceptan update_routine y create_routine (ids conservados)
 *   más `exerciseNames` (exerciseId → nombre).
 */
export function toRoutineView(
  r: RoutineRow & { teamId: string; exerciseNames: Readonly<Record<string, string>> },
  format: RoutineFormat = "outline",
): RoutineView {
  const base = { ...toRoutineSummary(r), teamId: r.teamId }
  if (format === "detail") return { ...base, content: toContentInput(r.content), exerciseNames: { ...r.exerciseNames } }
  return { ...base, items: routineOutline(r.content, r.exerciseNames) }
}

// ─── Asignados (sesiones) ─────────────────────────────────────────────────────

type SessionRow = {
  id: string
  status: "scheduled" | "active" | "completed" | "cancelled"
  startedAt: Date | string
  scheduledDate: string | null
  routineId: string | null
  routineName: string | null
  planAssignmentId?: string | null
  athletes: { userId: string; name: string | null; status: string }[]
}

/** Sesión asignada. `athletes` solo si quien consulta es coach (la API no los da a los atletas). */
export function toAssignmentView(s: SessionRow, opts: { includeAthletes: boolean }) {
  return {
    sessionId: s.id,
    routineId: s.routineId,
    routineName: s.routineName,
    scheduledDate: s.scheduledDate,
    startedAt: iso(s.startedAt),
    status: s.status,
    planAssignmentId: s.planAssignmentId ?? null,
    ...(opts.includeAthletes && {
      athletes: s.athletes.map((a) => ({ athleteId: a.userId, name: a.name, status: a.status })),
    }),
  }
}
