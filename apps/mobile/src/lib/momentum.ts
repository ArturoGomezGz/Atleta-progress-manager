// Momentum = constancia. Un día cuenta si el atleta completó al menos una sesión;
// una semana (lunes a domingo) cuenta si tuvo al menos un día con sesión. Todo en hora local.
export const HEATMAP_WEEKS = 12

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function mondayOf(d: Date) {
  return addDays(startOfDay(d), -((d.getDay() + 6) % 7))
}

export type MomentumDay = { date: Date; count: number; future: boolean }

export type Momentum = {
  dailyStreak: number
  bestDailyStreak: number
  weeklyStreak: number
  bestWeeklyStreak: number
  /** Días distintos con sesión en la semana en curso (de 7). */
  daysThisWeek: number
  /** Una entrada por día de lunes a domingo de la semana en curso. */
  weekDays: MomentumDay[]
  /** HEATMAP_WEEKS semanas (más antigua primero), cada una con 7 días. */
  heatmap: MomentumDay[][]
}

// Racha actual y mejor racha de una serie de periodos ordenados de menor a mayor;
// `next` da el periodo siguiente. El periodo en curso no rompe la racha si aún está vacío.
function streaks(sorted: Date[], current: Date, next: (d: Date) => Date, previous: (d: Date) => Date) {
  const has = new Set(sorted.map((d) => d.getTime()))
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const d of sorted) {
    run = prev && next(prev).getTime() === d.getTime() ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  let cursor = has.has(current.getTime()) ? current : previous(current)
  let now = 0
  while (has.has(cursor.getTime())) {
    now++
    cursor = previous(cursor)
  }
  return { now, best }
}

export function computeMomentum(completedAt: string[], now = new Date()): Momentum {
  const perDay = new Map<number, number>()
  for (const iso of completedAt) {
    const t = startOfDay(new Date(iso)).getTime()
    perDay.set(t, (perDay.get(t) ?? 0) + 1)
  }
  const days = [...perDay.keys()].sort((a, b) => a - b).map((t) => new Date(t))
  const weeks = [...new Set(days.map((d) => mondayOf(d).getTime()))].map((t) => new Date(t))

  const today = startOfDay(now)
  const thisMonday = mondayOf(now)

  const daily = streaks(days, today, (d) => addDays(d, 1), (d) => addDays(d, -1))
  const weekly = streaks(weeks, thisMonday, (d) => addDays(d, 7), (d) => addDays(d, -7))

  const week = (monday: Date): MomentumDay[] =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      return { date, count: perDay.get(date.getTime()) ?? 0, future: date > today }
    })

  const weekDays = week(thisMonday)
  const heatmap = Array.from({ length: HEATMAP_WEEKS }, (_, i) => week(addDays(thisMonday, -(HEATMAP_WEEKS - 1 - i) * 7)))

  return {
    dailyStreak: daily.now,
    bestDailyStreak: daily.best,
    weeklyStreak: weekly.now,
    bestWeeklyStreak: weekly.best,
    daysThisWeek: weekDays.filter((d) => d.count > 0).length,
    weekDays,
    heatmap,
  }
}

export const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"]
