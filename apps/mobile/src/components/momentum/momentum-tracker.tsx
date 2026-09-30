import { Text } from "@/components/text"
import { computeMomentum, DAY_LABELS, WEEKLY_GOAL, type MomentumDay } from "@/lib/momentum"
import { colors, radiusLg } from "@/lib/theme"
import { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Circle } from "react-native-svg"

// Niveles del mapa de calor: 0, 1, 2, 3+ sesiones en el día.
const LEVELS = [colors.secondary, "#2f4c94", "#4272e0", "#7fa5ff"]

const levelColor = (day: MomentumDay) => LEVELS[Math.min(day.count, 3)]

export function MomentumTracker({ completedAt }: { completedAt: string[] }) {
  const m = useMemo(() => computeMomentum(completedAt), [completedAt])
  const pct = Math.min(m.thisWeek / WEEKLY_GOAL, 1)

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.card, styles.row]}>
        <StreakRing value={m.streak} progress={pct} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text heading size={26}>
            {m.streak === 1 ? "1 semana seguida" : `${m.streak} semanas seguidas`}
          </Text>
          <Text size={14} color={colors.mutedForeground}>
            Cumpliendo tu meta de {WEEKLY_GOAL} sesiones por semana
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.between}>
          <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.eyebrow}>Esta semana</Text>
          <Text size={14} weight="bold">{m.thisWeek} de {WEEKLY_GOAL}</Text>
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

function StreakRing({ value, progress }: { value: number; progress: number }) {
  const size = 88
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.secondary} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text heading size={34} tabular>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radiusLg, padding: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 20 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.6 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.secondary },
  dotDone: { backgroundColor: colors.primary },
  dotFuture: { backgroundColor: "transparent", borderWidth: 2, borderStyle: "dashed", borderColor: colors.border },
  cell: { width: 18, height: 18, borderRadius: 4 },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 14 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
})
