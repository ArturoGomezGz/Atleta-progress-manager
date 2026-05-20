import { beforeEach, describe, expect, it } from "vitest"
import { makeCaller } from "../helpers/caller"
import { truncateAll } from "../helpers/db"
import { addAthlete, seedExercise, seedRoutine, seedTeam, seedUser } from "../helpers/seed"

beforeEach(async () => {
  await truncateAll()
})

// ── Helpers de setup ──────────────────────────────────────────────────────────

async function buildEvaluationSession() {
  const coach = await seedUser()
  const athlete = await seedUser()
  const team = await seedTeam(coach.id)
  await addAthlete(team.id, athlete.id)
  const ex = await seedExercise()
  const routine = await seedRoutine(team.id, coach.id, { category: "evaluation", exerciseId: ex.id })

  const session = await makeCaller(coach).sessions.create({
    routineId: routine.id,
    teamId: team.id,
    athleteIds: [athlete.id],
  })

  return {
    coach,
    athlete,
    team,
    ex,
    routine,
    session,
    coachCaller: makeCaller(coach),
    athleteCaller: makeCaller(athlete),
  }
}

async function buildTrainingSession() {
  const coach = await seedUser()
  const athlete = await seedUser()
  const team = await seedTeam(coach.id)
  await addAthlete(team.id, athlete.id)
  const ex = await seedExercise()
  const routine = await seedRoutine(team.id, coach.id, { category: "training", exerciseId: ex.id })

  const session = await makeCaller(coach).sessions.create({
    routineId: routine.id,
    teamId: team.id,
    athleteIds: [athlete.id],
  })

  return {
    coach,
    athlete,
    team,
    ex,
    routine,
    session,
    coachCaller: makeCaller(coach),
    athleteCaller: makeCaller(athlete),
  }
}

// ── sessions.create ───────────────────────────────────────────────────────────

describe("sessions.create", () => {
  it("sesión de evaluación queda activa de inmediato", async () => {
    const { session } = await buildEvaluationSession()
    expect(session.status).toBe("active")
  })

  it("trainingSession padre queda active al crear sesión de entrenamiento", async () => {
    const { session } = await buildTrainingSession()
    // El trainingSession padre queda "active"; el athleteSession individual queda "scheduled"
    expect(session.status).toBe("active")
  })

  it("sesión con fecha futura queda en estado scheduled", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()
    const routine = await seedRoutine(team.id, coach.id, { category: "evaluation", exerciseId: ex.id })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const session = await makeCaller(coach).sessions.create({
      routineId: routine.id,
      teamId: team.id,
      athleteIds: [athlete.id],
      scheduledDate: tomorrow.toISOString().split("T")[0],
    })

    expect(session.status).toBe("scheduled")
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()
    const routine = await seedRoutine(team.id, coach.id, { exerciseId: ex.id })

    await expect(
      makeCaller(athlete).sessions.create({ routineId: routine.id, teamId: team.id, athleteIds: [athlete.id] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("hace snapshot del content de la rutina: ejercicios y targets", async () => {
    const { session, coachCaller } = await buildEvaluationSession()
    const detail = await coachCaller.sessions.get({ id: session.id })
    expect(detail.exercises).toHaveLength(1)
    expect(detail.exercises[0].targets).toHaveLength(1)
  })
})

// ── sessions.activate ─────────────────────────────────────────────────────────

describe("sessions.activate", () => {
  it("en entrenamiento: el atleta activa su propia sesión", async () => {
    const { session, athleteCaller } = await buildTrainingSession()

    await athleteCaller.sessions.activate({ id: session.id })

    const progress = await athleteCaller.sessions.myProgress({ sessionId: session.id })
    expect(progress.status).toBe("active")
  })

  it("en evaluación: el coach activa una sesión programada", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()
    const routine = await seedRoutine(team.id, coach.id, { category: "evaluation", exerciseId: ex.id })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const session = await makeCaller(coach).sessions.create({
      routineId: routine.id,
      teamId: team.id,
      athleteIds: [athlete.id],
      scheduledDate: tomorrow.toISOString().split("T")[0],
    })
    expect(session.status).toBe("scheduled")

    const activated = await makeCaller(coach).sessions.activate({ id: session.id })
    expect(activated.status).toBe("active")
  })

  it("lanza BAD_REQUEST si el atleta intenta activar su sesión por segunda vez", async () => {
    const { session, athleteCaller } = await buildTrainingSession()

    await athleteCaller.sessions.activate({ id: session.id })
    await expect(athleteCaller.sessions.activate({ id: session.id }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

// ── sessions.recordSet ────────────────────────────────────────────────────────

describe("sessions.recordSet", () => {
  it("atleta registra su propia serie en sesión de entrenamiento", async () => {
    const { session, athlete, athleteCaller } = await buildTrainingSession()

    await athleteCaller.sessions.activate({ id: session.id })
    const progress = await athleteCaller.sessions.myProgress({ sessionId: session.id })
    const firstExercise = progress.exercises[0]

    const set = await athleteCaller.sessions.recordSet({
      sessionId: session.id,
      athleteId: athlete.id,
      sessionExerciseId: firstExercise.id,
      sessionSetTargetId: firstExercise.targets[0]?.id ?? null,
      setNumber: 1,
      reps: 5,
      weightLbs: "100",
      status: "valid",
    })

    expect(set.reps).toBe(5)
    expect(Number(set.weightLbs)).toBeCloseTo(100)
  })

  it("coach registra una serie en sesión de evaluación", async () => {
    const { session, athlete, coachCaller } = await buildEvaluationSession()
    const detail = await coachCaller.sessions.get({ id: session.id })
    const firstExercise = detail.exercises[0]

    const set = await coachCaller.sessions.recordSet({
      sessionId: session.id,
      athleteId: athlete.id,
      sessionExerciseId: firstExercise.id,
      sessionSetTargetId: firstExercise.targets[0]?.id ?? null,
      setNumber: 1,
      reps: 3,
      weightLbs: "80",
      status: "valid",
    })

    expect(set.reps).toBe(3)
  })

  it("coach no puede registrar series en sesión de entrenamiento", async () => {
    const { session, athlete, coachCaller, athleteCaller } = await buildTrainingSession()
    await athleteCaller.sessions.activate({ id: session.id })
    const progress = await athleteCaller.sessions.myProgress({ sessionId: session.id })
    const firstExercise = progress.exercises[0]

    await expect(
      coachCaller.sessions.recordSet({
        sessionId: session.id,
        athleteId: athlete.id,
        sessionExerciseId: firstExercise.id,
        sessionSetTargetId: null,
        setNumber: 1,
        reps: 5,
        weightLbs: "100",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("lanza BAD_REQUEST si el atleta no ha activado su sesión de entrenamiento", async () => {
    const { session, athlete, athleteCaller } = await buildTrainingSession()
    const progress = await athleteCaller.sessions.myProgress({ sessionId: session.id })
    const firstExercise = progress.exercises[0]

    await expect(
      athleteCaller.sessions.recordSet({
        sessionId: session.id,
        athleteId: athlete.id,
        sessionExerciseId: firstExercise.id,
        sessionSetTargetId: null,
        setNumber: 1,
        reps: 5,
        weightLbs: "100",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

// ── sessions.complete (evaluación → 1RM con Epley) ────────────────────────────

describe("sessions.complete (evaluation)", () => {
  it("calcula y guarda el 1RM del atleta con la fórmula Epley", async () => {
    const { session, athlete, coachCaller } = await buildEvaluationSession()
    const detail = await coachCaller.sessions.get({ id: session.id })
    const firstExercise = detail.exercises[0]

    // 100 lbs × 5 reps → Epley: 100 × (1 + 5/30) ≈ 116.67
    await coachCaller.sessions.recordSet({
      sessionId: session.id,
      athleteId: athlete.id,
      sessionExerciseId: firstExercise.id,
      sessionSetTargetId: firstExercise.targets[0]?.id ?? null,
      setNumber: 1,
      reps: 5,
      weightLbs: "100",
      status: "valid",
    })

    await coachCaller.sessions.complete({ id: session.id })

    const rms = await coachCaller.rms.listByAthlete({ teamId: detail.teamId, athleteId: athlete.id })
    expect(rms).toHaveLength(1)
    expect(Number(rms[0].current.rmLbs)).toBeCloseTo(116.67, 1)
  })

  it("ignora series con reps fuera del rango 1–10", async () => {
    const { session, athlete, coachCaller } = await buildEvaluationSession()
    const detail = await coachCaller.sessions.get({ id: session.id })
    const firstExercise = detail.exercises[0]

    await coachCaller.sessions.recordSet({
      sessionId: session.id,
      athleteId: athlete.id,
      sessionExerciseId: firstExercise.id,
      sessionSetTargetId: null,
      setNumber: 1,
      reps: 11, // fuera del rango válido
      weightLbs: "100",
      status: "valid",
    })

    await coachCaller.sessions.complete({ id: session.id })

    const rms = await coachCaller.rms.listByAthlete({ teamId: detail.teamId, athleteId: athlete.id })
    expect(rms).toHaveLength(0)
  })

  it("no guarda el 1RM si no supera el registro anterior", async () => {
    const { session, athlete, coach, coachCaller, team, ex } = await buildEvaluationSession()
    const detail = await coachCaller.sessions.get({ id: session.id })
    const firstExercise = detail.exercises[0]

    // Primera evaluación: 100lbs × 5 reps → RM ≈ 116.67
    await coachCaller.sessions.recordSet({
      sessionId: session.id,
      athleteId: athlete.id,
      sessionExerciseId: firstExercise.id,
      sessionSetTargetId: null,
      setNumber: 1,
      reps: 5,
      weightLbs: "100",
      status: "valid",
    })
    await coachCaller.sessions.complete({ id: session.id })

    // Segunda evaluación: 50lbs × 5 reps → RM ≈ 58.33 (inferior, no debe guardarse)
    const routine2 = await seedRoutine(team.id, coach.id, { category: "evaluation", exerciseId: ex.id })
    const session2 = await coachCaller.sessions.create({
      routineId: routine2.id,
      teamId: team.id,
      athleteIds: [athlete.id],
    })
    const detail2 = await coachCaller.sessions.get({ id: session2.id })
    const exercise2 = detail2.exercises[0]

    await coachCaller.sessions.recordSet({
      sessionId: session2.id,
      athleteId: athlete.id,
      sessionExerciseId: exercise2.id,
      sessionSetTargetId: null,
      setNumber: 1,
      reps: 5,
      weightLbs: "50",
      status: "valid",
    })
    await coachCaller.sessions.complete({ id: session2.id })

    const rms = await coachCaller.rms.listByAthlete({ teamId: team.id, athleteId: athlete.id })
    // Solo 1 entrada en el historial — el segundo registro no se guardó
    expect(rms[0].history).toHaveLength(1)
    expect(Number(rms[0].current.rmLbs)).toBeCloseTo(116.67, 1)
  })

  it("la sesión queda en estado completed", async () => {
    const { session, coachCaller } = await buildEvaluationSession()
    await coachCaller.sessions.complete({ id: session.id })
    const detail = await coachCaller.sessions.get({ id: session.id })
    expect(detail.status).toBe("completed")
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const { session, athleteCaller } = await buildEvaluationSession()
    await expect(athleteCaller.sessions.complete({ id: session.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// ── sessions.completeMySession (entrenamiento → auto-cierre) ──────────────────

describe("sessions.completeMySession (training)", () => {
  it("sesión padre se cierra automáticamente cuando el único atleta termina", async () => {
    const { session, athleteCaller, coachCaller } = await buildTrainingSession()

    await athleteCaller.sessions.activate({ id: session.id })
    await athleteCaller.sessions.completeMySession({ sessionId: session.id })

    const detail = await coachCaller.sessions.get({ id: session.id })
    expect(detail.status).toBe("completed")
  })

  it("sesión padre permanece active mientras queden atletas activos", async () => {
    const coach = await seedUser()
    const athlete1 = await seedUser()
    const athlete2 = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete1.id)
    await addAthlete(team.id, athlete2.id)
    const ex = await seedExercise()
    const routine = await seedRoutine(team.id, coach.id, { category: "training", exerciseId: ex.id })

    const session = await makeCaller(coach).sessions.create({
      routineId: routine.id,
      teamId: team.id,
      athleteIds: [athlete1.id, athlete2.id],
    })

    await makeCaller(athlete1).sessions.activate({ id: session.id })
    await makeCaller(athlete2).sessions.activate({ id: session.id })

    // Solo athlete1 termina
    await makeCaller(athlete1).sessions.completeMySession({ sessionId: session.id })

    const detail = await makeCaller(coach).sessions.get({ id: session.id })
    expect(detail.status).toBe("active")
  })
})

// ── sessions.cancel ───────────────────────────────────────────────────────────

describe("sessions.cancel", () => {
  it("coach cancela la sesión", async () => {
    const { session, coachCaller } = await buildEvaluationSession()
    const result = await coachCaller.sessions.cancel({ id: session.id })
    expect(result.status).toBe("cancelled")
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const { session, athleteCaller } = await buildEvaluationSession()
    await expect(athleteCaller.sessions.cancel({ id: session.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// ── sessions.myList ───────────────────────────────────────────────────────────

describe("sessions.myList", () => {
  it("atleta ve sus sesiones asignadas", async () => {
    const { session, athleteCaller, team } = await buildEvaluationSession()
    const result = await athleteCaller.sessions.myList({ teamId: team.id })
    expect(result.some((s) => s.id === session.id)).toBe(true)
  })
})

// ── sessions.cancelAthlete / reactivateAthlete ────────────────────────────────

describe("sessions.cancelAthlete y reactivateAthlete", () => {
  it("coach cancela y reactiva a un atleta individual", async () => {
    const { session, athlete, coachCaller } = await buildEvaluationSession()

    await coachCaller.sessions.cancelAthlete({ sessionId: session.id, athleteId: athlete.id })
    const detail1 = await coachCaller.sessions.get({ id: session.id })
    expect(detail1.athletes.find((a) => a.athleteId === athlete.id)?.status).toBe("cancelled")

    await coachCaller.sessions.reactivateAthlete({ sessionId: session.id, athleteId: athlete.id })
    const detail2 = await coachCaller.sessions.get({ id: session.id })
    expect(detail2.athletes.find((a) => a.athleteId === athlete.id)?.status).toBe("active")
  })
})
