// Descanso entre series: anillo con la cuenta regresiva, pitidos en los últimos
// 3 segundos y alarma al terminar. Pasado el tiempo cuenta el descanso extra.
import { Text } from "@/components/text"
import { colors, radiusLg } from "@/lib/theme"
import { formatClock } from "@/lib/workout"
import { Check } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"
import Svg, { Circle } from "react-native-svg"

const SIZE = 240
const STROKE = 14
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R

export function RestTimer({ remainingMs, totalSeconds, upcoming, autoContinue, onToggleAutoContinue }: {
  remainingMs: number
  totalSeconds: number
  upcoming: string
  autoContinue: boolean
  onToggleAutoContinue: (v: boolean) => void
}) {
  const overtime = remainingMs <= 0
  const seconds = overtime ? Math.floor(-remainingMs / 1000) : Math.ceil(remainingMs / 1000)
  const fraction = overtime ? 1 : Math.min(1, remainingMs / (totalSeconds * 1000))
  const tone = overtime ? colors.destructive : colors.primary

  return (
    <View style={styles.wrap}>
      <View style={{ gap: 6 }}>
        <Text heading size={34} center>{overtime ? "¡Descanso terminado!" : "¡Bien hecho! Descansa"}</Text>
        <Text size={18} center color={colors.mutedForeground}>
          {overtime ? "Continúa cuando estés listo." : "Respira tranquilo antes de la siguiente serie."}
        </Text>
      </View>

      <View style={{ width: SIZE, height: SIZE }} accessibilityRole="timer" accessibilityLabel={`${formatClock(seconds)} de descanso`}>
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.mutedSoft} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={tone}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - fraction)}
          />
        </Svg>
        <View style={styles.center}>
          <Text heading size={76} tabular color={overtime ? colors.destructive : colors.foreground}>
            {overtime ? `+${formatClock(seconds)}` : formatClock(seconds)}
          </Text>
          <Text size={18} color={overtime ? colors.destructive : colors.mutedForeground}>
            {overtime ? "descanso extra" : seconds >= 60 ? "minutos" : "segundos"}
          </Text>
        </View>
      </View>

      <View style={styles.upcoming}>
        <Text size={17} center>
          <Text size={17} color={colors.mutedForeground}>Lo siguiente: </Text>
          <Text size={17} weight="bold">{upcoming}</Text>
        </Text>
      </View>

      <Pressable
        onPress={() => onToggleAutoContinue(!autoContinue)}
        style={styles.toggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: autoContinue }}
      >
        <View style={[styles.box, autoContinue && styles.boxOn]}>
          {autoContinue && <Check size={16} color={colors.primaryForeground} strokeWidth={3} />}
        </View>
        <Text size={16} color={colors.mutedForeground}>Continuar automáticamente</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28, paddingHorizontal: 24, paddingVertical: 24 },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  upcoming: { borderRadius: radiusLg, backgroundColor: colors.mutedSoft, paddingHorizontal: 20, paddingVertical: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10 },
  box: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
})
