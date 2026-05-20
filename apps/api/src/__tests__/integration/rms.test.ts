import { beforeEach, describe, expect, it } from "vitest"
import { makeCaller } from "../helpers/caller"
import { truncateAll } from "../helpers/db"
import { addAthlete, seedExercise, seedRoutine, seedTeam, seedUser } from "../helpers/seed"

beforeEach(async () => {
  await truncateAll()
})

// ── rms.setManual ─────────────────────────────────────────────────────────────

describe("rms.setManual", () => {
  it("coach registra un RM manual para un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()

    const rm = await makeCaller(coach).rms.setManual({
      teamId: team.id,
      athleteId: athlete.id,
      exerciseId: ex.id,
      rmLbs: "150.00",
    })

    expect(rm.rmLbs).toBe("150.00")
    expect(rm.source).toBe("manual")
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()

    await expect(
      makeCaller(athlete).rms.setManual({
        teamId: team.id,
        athleteId: athlete.id,
        exerciseId: ex.id,
        rmLbs: "100.00",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("lanza error si el formato del peso es inválido", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()

    await expect(
      makeCaller(coach).rms.setManual({
        teamId: team.id,
        athleteId: athlete.id,
        exerciseId: ex.id,
        rmLbs: "no-es-numero",
      }),
    ).rejects.toThrow()
  })
})

// ── rms.listByAthlete ─────────────────────────────────────────────────────────

describe("rms.listByAthlete", () => {
  it("devuelve RMs agrupados por ejercicio con current e history", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex1 = await seedExercise()
    const ex2 = await seedExercise()

    await makeCaller(coach).rms.setManual({ teamId: team.id, athleteId: athlete.id, exerciseId: ex1.id, rmLbs: "100.00" })
    await makeCaller(coach).rms.setManual({ teamId: team.id, athleteId: athlete.id, exerciseId: ex2.id, rmLbs: "80.00" })

    const result = await makeCaller(coach).rms.listByAthlete({ teamId: team.id, athleteId: athlete.id })

    expect(result).toHaveLength(2)
    const exerciseIds = result.map((r) => r.exerciseId).sort()
    expect(exerciseIds).toContain(ex1.id)
    expect(exerciseIds).toContain(ex2.id)
  })

  it("el current es el RM más reciente del ejercicio", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()

    // Insertar dos registros para el mismo ejercicio
    await makeCaller(coach).rms.setManual({ teamId: team.id, athleteId: athlete.id, exerciseId: ex.id, rmLbs: "100.00" })
    await makeCaller(coach).rms.setManual({ teamId: team.id, athleteId: athlete.id, exerciseId: ex.id, rmLbs: "120.00" })

    const result = await makeCaller(coach).rms.listByAthlete({ teamId: team.id, athleteId: athlete.id })

    expect(result).toHaveLength(1)
    expect(result[0].current.rmLbs).toBe("120.00")
    expect(result[0].history).toHaveLength(2)
  })

  it("devuelve lista vacía si el atleta no tiene RMs", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    const result = await makeCaller(coach).rms.listByAthlete({ teamId: team.id, athleteId: athlete.id })

    expect(result).toHaveLength(0)
  })

  it("atleta puede ver sus propios RMs", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()
    await makeCaller(coach).rms.setManual({ teamId: team.id, athleteId: athlete.id, exerciseId: ex.id, rmLbs: "100.00" })

    const result = await makeCaller(athlete).rms.listByAthlete({ teamId: team.id, athleteId: athlete.id })

    expect(result).toHaveLength(1)
  })
})

// ── rms.exerciseReport ────────────────────────────────────────────────────────

describe("rms.exerciseReport", () => {
  it("devuelve null cuando no existe reporte para el ejercicio", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const ex = await seedExercise()

    const result = await makeCaller(coach).rms.exerciseReport({
      teamId: team.id,
      athleteId: athlete.id,
      exerciseId: ex.id,
    })

    expect(result).toBeNull()
  })

  it("lanza FORBIDDEN si el usuario no es miembro del equipo", async () => {
    const coach = await seedUser()
    const outsider = await seedUser()
    const team = await seedTeam(coach.id)
    const ex = await seedExercise()

    await expect(
      makeCaller(outsider).rms.exerciseReport({ teamId: team.id, athleteId: coach.id, exerciseId: ex.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// ── rms.reportStatuses ────────────────────────────────────────────────────────

describe("rms.reportStatuses", () => {
  it("devuelve lista vacía si no hay reportes", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    const result = await makeCaller(coach).rms.reportStatuses({ teamId: team.id, athleteId: athlete.id })

    expect(result).toHaveLength(0)
  })
})

// ── rms integrado con sessions.complete ───────────────────────────────────────

describe("rms via sessions.complete", () => {
  it("el RM automático de evaluación aparece en listByAthlete con source=auto", async () => {
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

    const detail = await makeCaller(coach).sessions.get({ id: session.id })
    const firstExercise = detail.exercises[0]

    await makeCaller(coach).sessions.recordSet({
      sessionId: session.id,
      athleteId: athlete.id,
      sessionExerciseId: firstExercise.id,
      sessionSetTargetId: null,
      setNumber: 1,
      reps: 5,
      weightLbs: "100",
      status: "valid",
    })

    await makeCaller(coach).sessions.complete({ id: session.id })

    const rms = await makeCaller(coach).rms.listByAthlete({ teamId: team.id, athleteId: athlete.id })
    expect(rms[0].current.source).toBe("auto")
  })
})
