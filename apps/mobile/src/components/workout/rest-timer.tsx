// Descanso entre series: anillo con la cuenta regresiva, pitidos en los últimos
// 3 segundos y alarma al terminar. Pasado el tiempo cuenta el descanso extra.
// Los botones (continuar / atrás) están en el pie del ejecutor.
import { Text } from "@/components/text"
import { colors, radiusLg } from "@/lib/theme"
import { formatClock } from "@/lib/workout"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import Svg, { Circle } from "react-native-svg"

const STROKE = 14

export function RestTimer({ remainingMs, totalSeconds, upcoming }: {
  remainingMs: number
  totalSeconds: number
  upcoming: string
}) {
  const [h, setH] = useState(520)
  // El anillo se ajusta al alto disponible para que todo quepa sin scroll
  const size = Math.max(130, Math.min(240, h - 190))
  const r = (size - STROKE) / 2
  const circ = 2 * Math.PI * r

  const overtime = remainingMs <= 0
  const seconds = overtime ? Math.floor(-remainingMs / 1000) : Math.ceil(remainingMs / 1000)
  const fraction = overtime ? 1 : Math.min(1, remainingMs / (totalSeconds * 1000))
  const tone = overtime ? colors.destructive : colors.primary

  return (
    <View style={styles.wrap} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <View style={{ gap: 4 }}>
        <Text heading size={32} center>{overtime ? "¡Descanso terminado!" : "¡Bien hecho! Descansa"}</Text>
        <Text size={16} center color={colors.mutedForeground}>
          {overtime ? "Continúa cuando estés listo." : "Respira tranquilo antes de la siguiente serie."}
        </Text>
      </View>

      <View style={{ width: size, height: size }} accessibilityRole="timer" accessibilityLabel={`${formatClock(seconds)} de descanso`}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.mutedSoft} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tone}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - fraction)}
          />
        </Svg>
        <View style={styles.center}>
          <Text heading size={Math.round(size * 0.32)} tabular color={overtime ? colors.destructive : colors.foreground}>
            {overtime ? `+${formatClock(seconds)}` : formatClock(seconds)}
          </Text>
          <Text size={16} color={overtime ? colors.destructive : colors.mutedForeground}>
            {overtime ? "descanso extra" : seconds >= 60 ? "minutos" : "segundos"}
          </Text>
        </View>
      </View>

      <View style={styles.upcoming}>
        <Text size={16} center numberOfLines={2}>
          <Text size={16} color={colors.mutedForeground}>Lo siguiente: </Text>
          <Text size={16} weight="bold">{upcoming}</Text>
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: 24, paddingVertical: 12 },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  upcoming: { borderRadius: radiusLg, backgroundColor: colors.mutedSoft, paddingHorizontal: 20, paddingVertical: 10 },
})
