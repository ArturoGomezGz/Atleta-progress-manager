import { describe, expect, it } from "vitest"
import { epley } from "../../lib/epley"

describe("epley", () => {
  describe("casos de referencia", () => {
    it("100 lbs × 5 reps → ~116.67", () => {
      expect(epley(100, 5)).toBeCloseTo(116.67, 1)
    })

    it("100 lbs × 1 rep → ~103.33", () => {
      expect(epley(100, 1)).toBeCloseTo(103.33, 1)
    })

    it("100 lbs × 10 reps → ~133.33 (límite superior del sistema)", () => {
      // El sistema solo acepta series con reps <= 10 para calcular 1RM
      expect(epley(100, 10)).toBeCloseTo(133.33, 1)
    })

    it("200 lbs × 3 reps → ~220", () => {
      expect(epley(200, 3)).toBeCloseTo(220, 1)
    })
  })

  describe("casos límite", () => {
    it("peso 0 → siempre retorna 0", () => {
      expect(epley(0, 5)).toBe(0)
    })

    it("reps 0 → retorna el peso exacto sin modificar", () => {
      expect(epley(50, 0)).toBe(50)
    })

    it("peso decimal se maneja correctamente", () => {
      expect(epley(135.5, 5)).toBeCloseTo(135.5 * (1 + 5 / 30), 5)
    })
  })

  describe("monotonía (propiedades que el negocio depende)", () => {
    it("más peso con mismas reps produce mayor 1RM estimado", () => {
      expect(epley(150, 5)).toBeGreaterThan(epley(100, 5))
    })

    it("más reps con mismo peso produce mayor 1RM estimado", () => {
      expect(epley(100, 8)).toBeGreaterThan(epley(100, 3))
    })

    it("1RM siempre es mayor o igual al peso levantado", () => {
      // Con reps >= 0, (1 + reps/30) >= 1
      expect(epley(100, 0)).toBeGreaterThanOrEqual(100)
      expect(epley(100, 5)).toBeGreaterThanOrEqual(100)
    })
  })

  describe("paridad con la fórmula de referencia", () => {
    const cases: [number, number][] = [
      [60, 3],
      [80, 5],
      [100, 8],
      [120, 2],
      [140, 10],
    ]

    it.each(cases)("epley(%s lbs, %s reps) == peso × (1 + reps/30)", (weight, reps) => {
      expect(epley(weight, reps)).toBeCloseTo(weight * (1 + reps / 30), 10)
    })
  })
})
