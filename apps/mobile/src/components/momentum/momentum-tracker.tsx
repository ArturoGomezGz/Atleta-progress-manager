import { Text } from "@/components/text"
import { computeMomentum, DAY_LABELS, type MomentumDay } from "@/lib/momentum"
import { colors, radiusLg } from "@/lib/theme"
import { useMemo } from "react"
import { StyleSheet, View } from "react-native"

// Niveles del mapa de calor: 0, 1, 2, 3+ sesiones en el día.
const LEVELS = [colors.secondary, "#2f4c94", "#4272e0", "#7fa5ff"]

const levelColor = (day: MomentumDay) => LEVELS[Math.min(day.count, 3)]

export function MomentumTracker({ completedAt }: { completedAt: string[] }) {
  const m = useMemo(() => computeMomentum(completedAt), [completedAt])

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.streaks}>
        <StreakCard label="Racha diaria" value={m.dailyStreak} unit={m.dailyStreak === 1 ? "día" : "días"} best={m.bestDailyStreak} bestUnit="día" bestUnitPlural="días" />
        <StreakCard label="Racha semanal" value={m.weeklyStreak} unit={m.weeklyStreak === 1 ? "semana" : "semanas"} best={m.bestWeeklyStreak} bestUnit="semana" bestUnitPlural="semanas" />
      </View>

      <View style={styles.card}>
        <View style={styles.between}>
          <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.eyebrow}>Esta semana</Text>
          <Text size={14} weight="bold">{m.daysThisWeek} de 7</Text>
        </View>
        <View style={[styles.between, { marginTop: 16 }]}>
          {m.weekDays.map((d, i) => (
            <View key={i} style={{ alignItems: "center", gap: 8 }}>
              <View style={[styles.dot, d.count > 0 ? styles.dotDone : d.future ? styles.dotFuture : null]} />
              <Text size={12} color={colors.mutedForeground}>{DAY_LABELS[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.eyebrow}>Últimas 12 semanas</Text>
        <View style={[styles.between, { marginTop: 16 }]}>
          {m.heatmap.map((week, wi) => (
            <View key={wi} style={{ gap: 4 }}>
              {week.map((d, di) => (
                <View key={di} style={[styles.cell, { backgroundColor: levelColor(d) }, d.future && { opacity: 0.25 }]} />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Text size={12} color={colors.mutedForeground}>Menos</Text>
          {LEVELS.map((c) => <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />)}
          <Text size={12} color={colors.mutedForeground}>Más</Text>
        </View>
      </View>
    </View>
  )
}

type StreakCardProps = { label: string; value: number; unit: string; best: number; bestUnit: string; bestUnitPlural: string }

function StreakCard({ label, value, unit, best, bestUnit, bestUnitPlural }: StreakCardProps) {
  const pct = best > 0 ? Math.min(value / best, 1) : 0
  return (
    <View style={[styles.card, styles.streakCard]}>
      <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.eyebrow}>{label}</Text>
      <View style={styles.valueRow}>
        <Text heading size={48} tabular>{value}</Text>
        <Text size={15} color={colors.mutedForeground}>{unit}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>
      <Text size={13} color={colors.mutedForeground}>
        Mejor racha: <Text size={13} weight="bold">{best} {best === 1 ? bestUnit : bestUnitPlural}</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radiusLg, padding: 20 },
  streaks: { flexDirection: "row", gap: 12 },
  streakCard: { flex: 1, gap: 10, paddingHorizontal: 18 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.secondary },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.6 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.secondary },
  dotDone: { backgroundColor: colors.primary },
  dotFuture: { backgroundColor: "transparent", borderWidth: 2, borderStyle: "dashed", borderColor: colors.border },
  cell: { width: 18, height: 18, borderRadius: 4 },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 14 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
})
