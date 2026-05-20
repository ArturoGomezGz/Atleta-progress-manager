import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { makeCaller } from "../helpers/caller"
import { truncateAll } from "../helpers/db"
import { addAthlete, seedExercise, seedRoutine, seedTeam, seedUser } from "../helpers/seed"

beforeEach(async () => {
  await truncateAll()
})

// ── routines.create ───────────────────────────────────────────────────────────

describe("routines.create", () => {
  it("coach crea una rutina de entrenamiento", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)

    const result = await makeCaller(coach).routines.create({
      teamId: team.id,
      name: "Fuerza A",
      category: "training",
    })

    expect(result.name).toBe("Fuerza A")
    expect(result.category).toBe("training")
    expect(result.content).toMatchObject({ v: 1, items: [] })
  })

  it("coach crea una rutina de evaluación", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)

    const result = await makeCaller(coach).routines.create({
      teamId: team.id,
      name: "Evaluación de Fuerza",
      category: "evaluation",
    })

    expect(result.category).toBe("evaluation")
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    await expect(
      makeCaller(athlete).routines.create({ teamId: team.id, name: "X", category: "training" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// ── routines.list ─────────────────────────────────────────────────────────────

describe("routines.list", () => {
  it("devuelve todas las rutinas del equipo", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    await seedRoutine(team.id, coach.id, { name: "R1", category: "training" })
    await seedRoutine(team.id, coach.id, { name: "R2", category: "evaluation" })

    const result = await makeCaller(coach).routines.list({ teamId: team.id })

    expect(result).toHaveLength(2)
  })

  it("filtra por categoría", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    await seedRoutine(team.id, coach.id, { category: "training" })
    await seedRoutine(team.id, coach.id, { category: "evaluation" })

    const trainings = await makeCaller(coach).routines.list({ teamId: team.id, category: "training" })
    expect(trainings).toHaveLength(1)
    expect(trainings[0].category).toBe("training")
  })

  it("atleta puede listar rutinas (solo lectura)", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    await seedRoutine(team.id, coach.id, { name: "R1" })

    const result = await makeCaller(athlete).routines.list({ teamId: team.id })

    expect(result).toHaveLength(1)
  })
})

// ── routines.get ──────────────────────────────────────────────────────────────

describe("routines.get", () => {
  it("devuelve la rutina con nombres de ejercicios", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    const ex = await seedExercise({ name: "Sentadilla" })
    const routine = await seedRoutine(team.id, coach.id, { exerciseId: ex.id })

    const result = await makeCaller(coach).routines.get({ id: routine.id })

    expect(result.id).toBe(routine.id)
    expect(result.exerciseNames[ex.id]).toBe("Sentadilla")
  })

  it("lanza NOT_FOUND para una rutina inexistente", async () => {
    const coach = await seedUser()
    await seedTeam(coach.id)

    await expect(makeCaller(coach).routines.get({ id: randomUUID() }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

// ── routines.updateContent ────────────────────────────────────────────────────

describe("routines.updateContent", () => {
  it("coach actualiza el content con un ejercicio individual", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    const ex = await seedExercise()
    const routine = await makeCaller(coach).routines.create({
      teamId: team.id,
      name: "R1",
      category: "evaluation",
    })

    const content = {
      v: 1 as const,
      items: [
        {
          type: "exercise" as const,
          id: randomUUID(),
          exerciseId: ex.id,
          order: 0,
          sets: [{ setNumber: 1, setType: "reps" as const, targetReps: 5 }],
        },
      ],
    }

    const updated = await makeCaller(coach).routines.updateContent({ id: routine.id, content })

    expect(updated.content.items).toHaveLength(1)
    expect(updated.content.items[0].type).toBe("exercise")
  })

  it("coach actualiza el content con un bloque de ejercicios", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    const ex = await seedExercise()
    const routine = await makeCaller(coach).routines.create({ teamId: team.id, name: "R1", category: "training" })

    const content = {
      v: 1 as const,
      items: [
        {
          type: "block" as const,
          id: randomUUID(),
          order: 0,
          rounds: 3,
          exercises: [
            {
              id: randomUUID(),
              exerciseId: ex.id,
              order: 0,
              sets: [{ setNumber: 1, setType: "reps" as const, targetReps: 10 }],
            },
          ],
        },
      ],
    }

    const updated = await makeCaller(coach).routines.updateContent({ id: routine.id, content })

    expect(updated.content.items[0].type).toBe("block")
    // @ts-expect-error — acceso a campo de bloque
    expect(updated.content.items[0].rounds).toBe(3)
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const routine = await seedRoutine(team.id, coach.id)

    await expect(
      makeCaller(athlete).routines.updateContent({ id: routine.id, content: { v: 1, items: [] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// ── routines.rename ───────────────────────────────────────────────────────────

describe("routines.rename", () => {
  it("coach renombra una rutina", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    const routine = await seedRoutine(team.id, coach.id, { name: "Nombre Viejo" })

    const updated = await makeCaller(coach).routines.rename({ id: routine.id, name: "Nombre Nuevo" })

    expect(updated.name).toBe("Nombre Nuevo")
  })
})

// ── routines.delete ───────────────────────────────────────────────────────────

describe("routines.delete", () => {
  it("coach elimina una rutina y desaparece del listado", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)
    const routine = await seedRoutine(team.id, coach.id)

    await makeCaller(coach).routines.delete({ id: routine.id })

    const list = await makeCaller(coach).routines.list({ teamId: team.id })
    expect(list.every((r) => r.id !== routine.id)).toBe(true)
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)
    const routine = await seedRoutine(team.id, coach.id)

    await expect(makeCaller(athlete).routines.delete({ id: routine.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
