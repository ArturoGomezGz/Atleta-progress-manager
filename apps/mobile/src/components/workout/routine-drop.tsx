// Rutina completa resumida: baja desde la cabecera (de arriba hacia abajo) al tocar
// "Ejercicio N de M" y cubre el cuerpo del ejecutor. Usa las mismas tarjetas de la
// vista previa de la rutina (RoutineCards).
import { Text } from "@/components/text"
import { RoutineCards } from "@/components/workout/cards"
import { colors } from "@/lib/theme"
import type { WorkoutExercise } from "@/lib/workout"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, ScrollView, StyleSheet, View } from "react-native"

export function RoutineDrop({ open, title, done, total, exercises, current, onWatch, onClosed }: {
  open: boolean
  title: string
  done: number
  total: number
  exercises: WorkoutExercise[]
  current: WorkoutExercise
  onWatch: (exercise: WorkoutExercise) => void
  // Se avisa cuando termina la animación de cierre (no si se interrumpe al reabrir)
  onClosed?: () => void
}) {
  const [h, setH] = useState(0)
  const progress = useRef(new Animated.Value(0)).current
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const wasOpen = useRef(false)

  useEffect(() => {
    const closing = wasOpen.current && !open
    wasOpen.current = open
    const anim = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 340 : 260,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    })
    anim.start(({ finished }) => {
      if (finished && closing) onClosedRef.current?.()
    })
    // Si se reabre o se desmonta a medias, la animación se corta sin avisar el cierre
    return () => anim.stop()
  }, [open, progress])

  // Mientras no se conoce el alto, se deja bien arriba fuera de la vista
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-(h || 1200), 0] })

  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
      style={[styles.panel, { transform: [{ translateY }] }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text heading size={30}>{title}</Text>
          <Text size={15} color={colors.mutedForeground}>{done} de {total} series hechas</Text>
        </View>
        <RoutineCards exercises={exercises} current={current} onWatch={onWatch} />
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  panel: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 10, elevation: 10 },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
})
