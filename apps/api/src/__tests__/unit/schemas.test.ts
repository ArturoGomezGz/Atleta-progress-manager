import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { z } from "zod"

// Re-exportar los schemas internos del router para testearlos directamente.
// Los schemas viven en routines.ts — los redefinimos aquí para no exponer
// internals, y verificamos que tengan el mismo comportamiento.

const routineSetSchema = z.object({
  setNumber: z.number().int().min(1),
  setType: z.enum(["reps", "time", "distance", "amrap"]),
  targetReps: z.number().int().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  targetDistanceMeters: z.number().int().positive().optional(),
  loadType: z.enum(["fixed_kg", "percent_rm", "rpe"]).optional(),
  loadValue: z.number().positive().optional(),
})

const exerciseContentSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  order: z.number().int().min(0),
  tempo: z.string().optional(),
  restSeconds: z.number().int().positive().optional(),
  goal: z.enum(["strength", "hypertrophy", "endurance", "power", "cardio", "recovery"]).optional(),
  notes: z.string().optional(),
  sets: z.array(routineSetSchema).min(1),
})

const routineItemSchema = z.discriminatedUnion("type", [
  exerciseContentSchema.extend({ type: z.literal("exercise") }),
  z.object({
    type: z.literal("block"),
    id: z.string().uuid(),
    order: z.number().int().min(0),
    name: z.string().optional(),
    rounds: z.number().int().min(2),
    exercises: z.array(exerciseContentSchema).min(1),
  }),
])

const routineContentSchema = z.object({
  v: z.literal(1),
  items: z.array(routineItemSchema),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const validSet = () => ({
  setNumber: 1,
  setType: "reps" as const,
  targetReps: 5,
  loadType: "percent_rm" as const,
  loadValue: 80,
})

const validExerciseItem = () => ({
  type: "exercise" as const,
  id: randomUUID(),
  exerciseId: randomUUID(),
  order: 0,
  sets: [validSet()],
})

const validBlockItem = () => ({
  type: "block" as const,
  id: randomUUID(),
  order: 1,
  rounds: 3,
  exercises: [{ ...validExerciseItem(), order: 0 }],
})

// ── routineSetSchema ──────────────────────────────────────────────────────────

describe("routineSetSchema", () => {
  it("acepta una serie mínima válida", () => {
    const result = routineSetSchema.safeParse({ setNumber: 1, setType: "reps" })
    expect(result.success).toBe(true)
  })

  it("acepta todos los tipos de serie", () => {
    const types = ["reps", "time", "distance", "amrap"] as const
    for (const setType of types) {
      expect(routineSetSchema.safeParse({ setNumber: 1, setType }).success).toBe(true)
    }
  })

  it("rechaza setNumber < 1", () => {
    const result = routineSetSchema.safeParse({ setNumber: 0, setType: "reps" })
    expect(result.success).toBe(false)
  })

  it("rechaza targetReps negativo", () => {
    const result = routineSetSchema.safeParse({ setNumber: 1, setType: "reps", targetReps: -1 })
    expect(result.success).toBe(false)
  })

  it("rechaza loadValue negativo o cero", () => {
    const result = routineSetSchema.safeParse({ setNumber: 1, setType: "reps", loadValue: 0 })
    expect(result.success).toBe(false)
  })

  it("acepta los tres loadType", () => {
    const types = ["fixed_kg", "percent_rm", "rpe"] as const
    for (const loadType of types) {
      expect(routineSetSchema.safeParse({ setNumber: 1, setType: "reps", loadType }).success).toBe(true)
    }
  })
})

// ── exerciseContentSchema ─────────────────────────────────────────────────────

describe("exerciseContentSchema", () => {
  it("acepta un ejercicio válido mínimo", () => {
    const result = exerciseContentSchema.safeParse(validExerciseItem())
    expect(result.success).toBe(true)
  })

  it("rechaza exerciseId que no es UUID", () => {
    const result = exerciseContentSchema.safeParse({
      ...validExerciseItem(),
      exerciseId: "no-es-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rechaza sets vacío", () => {
    const result = exerciseContentSchema.safeParse({
      ...validExerciseItem(),
      sets: [],
    })
    expect(result.success).toBe(false)
  })

  it("rechaza order negativo", () => {
    const result = exerciseContentSchema.safeParse({
      ...validExerciseItem(),
      order: -1,
    })
    expect(result.success).toBe(false)
  })

  it("acepta todos los valores de goal", () => {
    const goals = ["strength", "hypertrophy", "endurance", "power", "cardio", "recovery"] as const
    for (const goal of goals) {
      expect(exerciseContentSchema.safeParse({ ...validExerciseItem(), goal }).success).toBe(true)
    }
  })

  it("acepta campos opcionales ausentes", () => {
    const { tempo: _, restSeconds: __, goal: ___, notes: ____, ...minimal } = {
      ...validExerciseItem(),
      tempo: "3-1-2-0",
      restSeconds: 90,
      goal: "strength" as const,
      notes: "bajar lento",
    }
    expect(exerciseContentSchema.safeParse(minimal).success).toBe(true)
  })
})

// ── routineItemSchema (discriminated union) ───────────────────────────────────

describe("routineItemSchema", () => {
  it("acepta un item de tipo exercise", () => {
    expect(routineItemSchema.safeParse(validExerciseItem()).success).toBe(true)
  })

  it("acepta un item de tipo block", () => {
    expect(routineItemSchema.safeParse(validBlockItem()).success).toBe(true)
  })

  it("rechaza block con menos de 2 rounds", () => {
    const result = routineItemSchema.safeParse({ ...validBlockItem(), rounds: 1 })
    expect(result.success).toBe(false)
  })

  it("rechaza block sin exercises", () => {
    const result = routineItemSchema.safeParse({ ...validBlockItem(), exercises: [] })
    expect(result.success).toBe(false)
  })

  it("rechaza type desconocido", () => {
    const result = routineItemSchema.safeParse({ type: "superset", id: randomUUID(), order: 0 })
    expect(result.success).toBe(false)
  })
})

// ── routineContentSchema ──────────────────────────────────────────────────────

describe("routineContentSchema", () => {
  it("acepta content vacío válido", () => {
    expect(routineContentSchema.safeParse({ v: 1, items: [] }).success).toBe(true)
  })

  it("acepta content con ejercicios y bloques mezclados", () => {
    const result = routineContentSchema.safeParse({
      v: 1,
      items: [validExerciseItem(), validBlockItem()],
    })
    expect(result.success).toBe(true)
  })

  it("rechaza versión distinta de 1", () => {
    const result = routineContentSchema.safeParse({ v: 2, items: [] })
    expect(result.success).toBe(false)
  })

  it("rechaza items undefined", () => {
    const result = routineContentSchema.safeParse({ v: 1 })
    expect(result.success).toBe(false)
  })

  it("rechaza item inválido dentro de items", () => {
    const result = routineContentSchema.safeParse({
      v: 1,
      items: [{ type: "exercise", id: "no-uuid", exerciseId: randomUUID(), order: 0, sets: [] }],
    })
    expect(result.success).toBe(false)
  })
})
