// Momentum = constancia: semanas seguidas (lunes a domingo, hora local) en las
// que el atleta completó al menos `WEEKLY_GOAL` sesiones.
export const WEEKLY_GOAL = 3
export const HEATMAP_WEEKS = 12

function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

export type MomentumDay = { date: Date; count: number; future: boolean }

export type Momentum = {
  streak: number
  thisWeek: number
  /** Una entrada por día de lunes a domingo de la semana en curso. */
  weekDays: MomentumDay[]
  /** HEATMAP_WEEKS semanas (más antigua primero), cada una con 7 días. */
  heatmap: MomentumDay[][]
}

export function computeMomentum(completedAt: string[], now = new Date()): Momentum {
  const perDay = new Map<string, number>()
  const perWeek = new Map<number, number>()
  for (const iso of completedAt) {
    const d = new Date(iso)
    const dayKey = d.toDateString()
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1)
    const wk = mondayOf(d).getTime()
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1)
  }

  const thisMonday = mondayOf(now)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week = (monday: Date): MomentumDay[] =>
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
      return { date, count: perDay.get(date.toDateString()) ?? 0, future: date > today }
    })

  const thisWeek = perWeek.get(thisMonday.getTime()) ?? 0

  // La semana en curso suma a la racha si ya cumplió la meta, pero no la rompe si aún no.
  let streak = thisWeek >= WEEKLY_GOAL ? 1 : 0
  for (let i = 1; ; i++) {
    const monday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7)
    if ((perWeek.get(monday.getTime()) ?? 0) < WEEKLY_GOAL) break
    streak++
  }

  const heatmap = Array.from({ length: HEATMAP_WEEKS }, (_, i) =>
    week(new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - (HEATMAP_WEEKS - 1 - i) * 7)),
  )

  return { streak, thisWeek, weekDays: week(thisMonday), heatmap }
}

export const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"]
