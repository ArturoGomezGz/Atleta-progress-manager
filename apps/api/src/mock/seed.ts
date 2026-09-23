import { db } from "@atleta/db/client"
import {
  account,
  athleteExerciseRm,
  athleteSession,
  exercise,
  routine,
  sessionExercise,
  sessionSetTarget,
  setRecord,
  teamMember,
  trainingSession,
  user,
  type RoutineContent,
  type RoutineExerciseContent,
  type RoutineItemBlock,
  type RoutineItemExercise,
  type RoutineSet,
} from "@atleta/db/schema"
import { eq, inArray } from "drizzle-orm"
import { flattenContent, targetsForExercise } from "../services/routine-content"

// Datos de prueba del servidor mock. Se cargan sobre las cuentas y el catálogo de
// packages/db/sql (03_accounts + 04_exercises): equipo Neo, coach Arturo, atletas
// Tester y Rosa, 638 ejercicios. Aquí se agregan dos atletas más, rutinas que cubren
// cada combinación de zonas corporales y sesiones en todos los estados.

const TEAM_ID = "09ec5433-f03f-5a98-aad6-6d57e97e4d18"
const COACH_EMAIL = "arturogomezgz04@gmail.com"
// Hash scrypt de better-auth para "12345678" (el mismo de tester@gmail.com en 03_accounts.sql)
const PASSWORD_12345678 =
  "3c3f2ffdce52b5af0ab948bb853c4494:0cd1251b1c175ec7ba54c58429c9724cab33baea2b2aa6c6db72d514c83f3b655a52e7d9c512288e9f0574fc614169c56186d908ce81576c193fa45841c015e1"

const EXTRA_ATHLETES = [
  { id: "mock-athlete-diego", name: "Diego Ramírez", email: "diego@atleta.dev" },
  { id: "mock-athlete-sofia", name: "Sofía López", email: "sofia@atleta.dev" },
]

// ─── Constructores de contenido ───────────────────────────────────────────────

const reps = (n: number, r: number): RoutineSet[] =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, setType: "reps", targetReps: r }))
const secs = (n: number, s: number): RoutineSet[] =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, setType: "time", targetDurationSeconds: s }))
const percentRm = (steps: [number, number][]): RoutineSet[] =>
  steps.map(([r, p], i) => ({ setNumber: i + 1, setType: "reps", targetReps: r, loadType: "percent_rm", loadValue: p }))

type ExerciseSpec = { name: string; sets: RoutineSet[]; restSeconds?: number }
type ItemSpec = ExerciseSpec | { circuit: string; rounds: number; rest?: number; exercises: ExerciseSpec[] }

type RoutineSpec = { key: string; name: string; category: "training" | "evaluation"; items: ItemSpec[] }

const ROUTINES: RoutineSpec[] = [
  {
    key: "pierna", name: "pierna pesada", category: "training",
    items: [
      { name: "Barbell Back Squat", sets: reps(5, 5), restSeconds: 150 },
      { name: "Barbell Romanian Deadlift", sets: reps(4, 8), restSeconds: 120 },
      { name: "Walking Lunge", sets: reps(3, 12), restSeconds: 90 },
      { name: "Barbell Hip Thrust", sets: reps(3, 10), restSeconds: 90 },
      { name: "Calf Raises", sets: reps(3, 15), restSeconds: 60 },
    ],
  },
  {
    // El caso "mayormente pierna, con algo de full body": rojo dominante + morado
    key: "pierna-fb", name: "pierna + acondicionamiento", category: "training",
    items: [
      { name: "Barbell Back Squat", sets: reps(4, 6), restSeconds: 120 },
      { name: "Bulgarian Squats", sets: reps(3, 10), restSeconds: 90 },
      { name: "Lying Leg Curl", sets: reps(3, 12), restSeconds: 60 },
      { circuit: "Finisher", rounds: 3, rest: 90, exercises: [
        { name: "Burpee", sets: reps(1, 12), restSeconds: 15 },
        { name: "Dumbbell Thruster", sets: reps(1, 10) },
      ] },
    ],
  },
  {
    key: "torso", name: "torso empuje y jalón", category: "training",
    items: [
      { name: "Barbell Bench Press", sets: reps(4, 6), restSeconds: 120 },
      { name: "Barbell Bent-Over Row", sets: reps(4, 8), restSeconds: 90 },
      { name: "Barbell Overhead Press", sets: reps(3, 8), restSeconds: 90 },
      { name: "Chin Ups", sets: reps(3, 8), restSeconds: 90 },
      { name: "Dumbbell Side Lateral Raise", sets: reps(3, 15), restSeconds: 45 },
      { name: "Cable Face Pull", sets: reps(3, 15), restSeconds: 45 },
    ],
  },
  {
    key: "core", name: "core y estabilidad", category: "training",
    items: [
      { name: "Plank", sets: secs(3, 45), restSeconds: 30 },
      { name: "Dead Bug", sets: reps(3, 12), restSeconds: 30 },
      { name: "Cable Pallof Press", sets: reps(3, 10), restSeconds: 30 },
      { name: "Ab Wheel Rollout", sets: reps(3, 8), restSeconds: 45 },
      { name: "Hanging Leg raises", sets: reps(2, 10), restSeconds: 45 },
    ],
  },
  {
    key: "fullbody", name: "full body metabólico", category: "training",
    items: [
      { circuit: "Circuito principal", rounds: 4, rest: 120, exercises: [
        { name: "Hang Power Clean", sets: reps(1, 6), restSeconds: 20 },
        { name: "Burpee", sets: reps(1, 10), restSeconds: 20 },
        { name: "Mountain Climbers", sets: secs(1, 30), restSeconds: 20 },
        { name: "Kettlebell Swing", sets: reps(1, 15) },
      ] },
      { name: "Plank", sets: secs(2, 60), restSeconds: 30 },
    ],
  },
  {
    key: "mixta", name: "mixta tren superior e inferior", category: "training",
    items: [
      { name: "Goblet Squat", sets: reps(3, 10), restSeconds: 60 },
      { name: "Dumbbell Bench Press", sets: reps(4, 10), restSeconds: 60 },
      { name: "Dumbbell Romanian Deadlift", sets: reps(3, 10), restSeconds: 60 },
      { name: "Dumbbell Bent-Over Row", sets: reps(4, 10), restSeconds: 60 },
      { name: "Russian Twist", sets: reps(2, 20), restSeconds: 30 },
    ],
  },
  {
    key: "eval", name: "evaluación de fuerza", category: "evaluation",
    items: [
      { name: "Barbell Back Squat", sets: percentRm([[5, 80], [3, 90], [1, 100]]) },
      { name: "Barbell Bench Press", sets: percentRm([[5, 80], [3, 90], [1, 100]]) },
      { name: "Barbell Deadlift", sets: percentRm([[5, 80], [3, 90], [1, 100]]) },
    ],
  },
]

// ─── Sesiones ─────────────────────────────────────────────────────────────────

type SessionSpec = {
  routine: string
  athletes: string[]          // emails
  daysFromToday: number       // negativo = pasado
  status: "scheduled" | "active" | "completed" | "cancelled"
  /** Solo para "active": cuántos ejercicios (en orden) ya tienen sus series registradas. */
  progress?: number
}

const SESSIONS: SessionSpec[] = [
  { routine: "pierna-fb", athletes: ["tester@gmail.com"], daysFromToday: 0, status: "active", progress: 2 },
  { routine: "torso", athletes: ["tester@gmail.com", "diego@atleta.dev"], daysFromToday: 1, status: "scheduled" },
  { routine: "core", athletes: ["tester@gmail.com"], daysFromToday: 3, status: "scheduled" },
  { routine: "fullbody", athletes: ["tester@gmail.com", "sofia@atleta.dev"], daysFromToday: -2, status: "completed" },
  { routine: "pierna", athletes: ["tester@gmail.com"], daysFromToday: -5, status: "completed" },
  { routine: "mixta", athletes: ["tester@gmail.com"], daysFromToday: -7, status: "cancelled" },
  { routine: "mixta", athletes: ["abuela@gmail.com"], daysFromToday: 1, status: "scheduled" },
  { routine: "core", athletes: ["abuela@gmail.com"], daysFromToday: -3, status: "completed" },
  { routine: "torso", athletes: ["diego@atleta.dev"], daysFromToday: 0, status: "active", progress: 1 },
  { routine: "eval", athletes: ["diego@atleta.dev", "sofia@atleta.dev"], daysFromToday: -10, status: "completed" },
  { routine: "fullbody", athletes: ["sofia@atleta.dev"], daysFromToday: 2, status: "scheduled" },
  { routine: "pierna", athletes: ["sofia@atleta.dev"], daysFromToday: -4, status: "completed" },
]

// Peso "típico" en lbs por ejercicio para las series registradas (0 = peso corporal)
const WORKING_WEIGHT_LBS: Record<string, number> = {
  "Barbell Back Squat": 185, "Barbell Romanian Deadlift": 155, "Barbell Hip Thrust": 205, "Barbell Deadlift": 245,
  "Barbell Bench Press": 145, "Barbell Bent-Over Row": 125, "Barbell Overhead Press": 85, "Walking Lunge": 40,
  "Bulgarian Squats": 35, "Lying Leg Curl": 70, "Dumbbell Thruster": 30, "Hang Power Clean": 95, "Kettlebell Swing": 44,
  "Dumbbell Side Lateral Raise": 15, "Cable Face Pull": 40, "Goblet Squat": 45, "Dumbbell Bench Press": 50,
  "Dumbbell Romanian Deadlift": 45, "Dumbbell Bent-Over Row": 45, "Calf Raises": 90, "Cable Pallof Press": 25,
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

const uuid = () => crypto.randomUUID()

function dayOffset(days: number, hour = 7) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 30, 0, 0)
  return d
}

export async function seedMockData() {
  const [coach] = await db.select().from(user).where(eq(user.email, COACH_EMAIL)).limit(1)
  if (!coach) throw new Error(`Falta la cuenta ${COACH_EMAIL}: el seed mock necesita 03_accounts.sql`)

  // Atletas extra, con la misma contraseña que las cuentas de prueba (12345678)
  for (const a of EXTRA_ATHLETES) {
    await db.insert(user).values({ id: a.id, name: a.name, email: a.email, emailVerified: true, createdAt: new Date(), updatedAt: new Date() })
    await db.insert(account).values({
      id: uuid(), accountId: a.id, providerId: "credential", userId: a.id, password: PASSWORD_12345678,
      createdAt: new Date(), updatedAt: new Date(),
    })
    await db.insert(teamMember).values({ teamId: TEAM_ID, userId: a.id, role: "athlete" })
  }

  const allEmails = [...new Set(SESSIONS.flatMap((s) => s.athletes))]
  const users = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.email, allEmails))
  const userIdByEmail = new Map(users.map((u) => [u.email, u.id]))

  // Ejercicios por nombre (del catálogo público)
  const names = [...new Set(ROUTINES.flatMap((r) => r.items.flatMap((i) => ("circuit" in i ? i.exercises : [i]).map((e) => e.name))))]
  const found = await db.select({ id: exercise.id, name: exercise.name }).from(exercise).where(inArray(exercise.name, names))
  const exerciseIdByName = new Map(found.map((e) => [e.name, e.id]))
  const missing = names.filter((n) => !exerciseIdByName.has(n))
  if (missing.length > 0) throw new Error(`Ejercicios no encontrados en el catálogo: ${missing.join(", ")}`)
  const nameByExerciseId = new Map(found.map((e) => [e.id, e.name]))

  const toExercise = (e: ExerciseSpec, order: number): RoutineExerciseContent => ({
    id: uuid(), exerciseId: exerciseIdByName.get(e.name)!, order, sets: e.sets,
    ...(e.restSeconds ? { restSeconds: e.restSeconds } : {}),
  })

  // Rutinas (plantillas)
  const routines = new Map<string, { id: string; category: "training" | "evaluation"; content: RoutineContent }>()
  for (const spec of ROUTINES) {
    const content: RoutineContent = {
      v: 1,
      items: spec.items.map((item, order): RoutineItemExercise | RoutineItemBlock =>
        "circuit" in item
          ? {
              type: "block", id: uuid(), order, name: item.circuit, rounds: item.rounds,
              ...(item.rest ? { restBetweenRoundsSeconds: item.rest } : {}),
              exercises: item.exercises.map(toExercise),
            }
          : { type: "exercise", ...toExercise(item, order) },
      ),
    }
    const [r] = await db
      .insert(routine)
      .values({ name: spec.name, teamId: TEAM_ID, createdBy: coach.id, category: spec.category, content })
      .returning({ id: routine.id })
    routines.set(spec.key, { id: r.id, category: spec.category, content })
  }

  // Sesiones: mismo snapshot que sessions.create (content + session_exercise + targets)
  let sessionCount = 0
  for (const spec of SESSIONS) {
    const r = routines.get(spec.routine)!
    const startedAt = dayOffset(Math.min(spec.daysFromToday, 0))
    const scheduledDate = spec.status === "scheduled" ? dayOffset(spec.daysFromToday).toISOString().split("T")[0] : null

    const [session] = await db
      .insert(trainingSession)
      .values({ routineId: r.id, teamId: TEAM_ID, startedBy: coach.id, startedAt, scheduledDate, status: spec.status, content: r.content })
      .returning()

    const flat = flattenContent(r.content)
    const exercises: { id: string; exerciseId: string; targets: (typeof sessionSetTarget.$inferSelect)[] }[] = []
    for (const [position, ex] of flat.entries()) {
      const [se] = await db.insert(sessionExercise).values({ sessionId: session.id, exerciseId: ex.exerciseId, order: position }).returning()
      const targets = targetsForExercise(ex.sets).map((t) => ({ ...t, sessionExerciseId: se.id }))
      const inserted = targets.length > 0 ? await db.insert(sessionSetTarget).values(targets).returning() : []
      exercises.push({ id: se.id, exerciseId: ex.exerciseId, targets: inserted })
    }

    for (const email of spec.athletes) {
      const athleteId = userIdByEmail.get(email)
      if (!athleteId) throw new Error(`Atleta no encontrado: ${email}`)

      const status =
        spec.status === "completed" ? "completed" as const :
        spec.status === "cancelled" ? "cancelled" as const :
        spec.status === "active" ? "active" as const :
        r.category === "training" ? "scheduled" as const : "active" as const

      const [as] = await db
        .insert(athleteSession)
        .values({
          sessionId: session.id, athleteId, status,
          startedAt: status === "active" || status === "completed" ? startedAt : null,
          completedAt: status === "completed" ? new Date(startedAt.getTime() + 55 * 60_000) : null,
          rpe: status === "completed" ? 7 : null,
        })
        .returning()

      const recorded = spec.status === "completed" ? exercises : spec.status === "active" ? exercises.slice(0, spec.progress ?? 0) : []
      const sets = recorded.flatMap((ex) =>
        ex.targets.map((t) => {
          const base = WORKING_WEIGHT_LBS[nameByExerciseId.get(ex.exerciseId) ?? ""] ?? 0
          const weight = t.targetPercent != null ? Math.round((base * 1.15 * Number(t.targetPercent)) / 100) : base
          return {
            athleteSessionId: as.id, sessionExerciseId: ex.id, sessionSetTargetId: t.id, setNumber: t.setNumber,
            reps: t.targetReps ?? t.targetDurationSeconds ?? 10, weightLbs: String(weight), recordedBy: athleteId,
            recordedAt: startedAt,
          }
        }),
      )
      if (sets.length > 0) await db.insert(setRecord).values(sets)

      // La evaluación deja RMs, para que la vista de progreso y los %RM tengan con qué calcular
      if (r.category === "evaluation" && spec.status === "completed") {
        await db.insert(athleteExerciseRm).values(
          exercises.map((ex) => ({
            athleteId, exerciseId: ex.exerciseId, sessionId: session.id, source: "auto" as const, recordedAt: startedAt,
            rmLbs: String(Math.round((WORKING_WEIGHT_LBS[nameByExerciseId.get(ex.exerciseId) ?? ""] ?? 100) * 1.15)),
          })),
        )
      }
    }
    sessionCount++
  }

  return { routines: routines.size, sessions: sessionCount, athletes: EXTRA_ATHLETES.length }
}
