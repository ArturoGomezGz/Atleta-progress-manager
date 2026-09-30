// Serie por tiempo: "prepárate" 3-2-1 con pitidos, cuenta del tiempo con aviso en
// los últimos 3 segundos y alarma al terminar. Si el atleta sale de la app mientras
// corre, la notificación del sistema le avisa al terminar.
import { Button } from "@/components/button"
import { Text } from "@/components/text"
import { feedback } from "@/lib/feedback"
import { cancelTimerAlert, scheduleTimerAlert } from "@/lib/notifications"
import { colors, radiusLg } from "@/lib/theme"
import { useRemainingMs, useSecondTicks } from "@/lib/use-countdown"
import { formatClock } from "@/lib/workout"
import { Pause, Play, RotateCcw } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"

export type CountdownPhase = "idle" | "prepare" | "running" | "paused" | "finished"

const PREPARE_MS = 3000

export function TimeCountdown({ seconds, exerciseName, onPhaseChange }: {
  seconds: number
  exerciseName: string
  onPhaseChange: (phase: CountdownPhase) => void
}) {
  const [phase, setPhase] = useState<CountdownPhase>("idle")
  const [endAt, setEndAt] = useState<number | null>(null)
  const [pausedLeft, setPausedLeft] = useState(seconds * 1000)
  const alert = useRef<Promise<string | null> | null>(null)
  const lastShown = useRef<number | null>(null)

  const ms = useRemainingMs(phase === "prepare" || phase === "running" ? endAt : null)
  const shown = ms == null ? null : Math.max(0, Math.ceil(ms / 1000))

  useEffect(() => { onPhaseChange(phase) }, [phase, onPhaseChange])
  useEffect(() => () => cancelTimerAlert(alert.current), [])

  function run(leftMs: number) {
    const end = Date.now() + leftMs
    setEndAt(end)
    setPhase("running")
    alert.current = scheduleTimerAlert(end, "¡Tiempo!", `Terminó la serie de ${exerciseName}. Márcala como hecha.`)
  }

  // 3-2-1 y últimos segundos
  useSecondTicks(shown, (s) => {
    if (s >= 1 && s <= 3) feedback.tick()
  })

  // Transiciones al llegar a cero
  useEffect(() => {
    if (ms == null) return
    if (ms > 0) { lastShown.current = shown; return }
    if (phase === "prepare") {
      feedback.go()
      run(seconds * 1000)
    } else if (phase === "running") {
      // Si volvemos de segundo plano ya terminado, el aviso lo dio la notificación
      if (lastShown.current != null && lastShown.current <= 1) feedback.timeUp()
      setPhase("finished")
      setPausedLeft(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, phase])

  function start() {
    feedback.tick()
    lastShown.current = 3
    setEndAt(Date.now() + PREPARE_MS)
    setPhase("prepare")
  }

  function togglePause() {
    if (phase === "running" && ms != null) {
      cancelTimerAlert(alert.current)
      setPausedLeft(Math.max(0, ms))
      setPhase("paused")
    } else if (phase === "paused") {
      run(pausedLeft)
    }
  }

  function reset() {
    cancelTimerAlert(alert.current)
    setPhase("idle")
    setEndAt(null)
    setPausedLeft(seconds * 1000)
  }

  const preparing = phase === "prepare"
  const running = phase === "running" || phase === "paused"
  const finished = phase === "finished"
  const tone = preparing || finished ? colors.destructive : running ? colors.success : colors.foreground
  const value = preparing
    ? String(shown ?? 3)
    : phase === "running"
      ? formatClock(shown ?? seconds)
      : formatClock(Math.ceil(pausedLeft / 1000))

  return (
    <View style={{ gap: 12, alignSelf: "stretch" }}>
      <View style={[
        styles.display,
        (preparing || finished) && { backgroundColor: colors.destructiveSoft },
        running && { backgroundColor: colors.successSoft },
      ]}>
        <Text heading size={84} color={tone} center tabular>{value}</Text>
        <Text size={22} center color={running || preparing || finished ? tone : colors.foreground}>
          {preparing ? "prepárate…" : finished ? "¡Tiempo!" : phase === "paused" ? "en pausa" : "segundos"}
        </Text>
      </View>
      <View style={styles.actions}>
        {phase === "idle" && <Button label="Empezar a contar" icon={Play} variant="secondary" onPress={start} />}
        {running && (
          <Button
            label={phase === "running" ? "Pausar" : "Seguir"}
            icon={phase === "running" ? Pause : Play}
            variant="secondary"
            onPress={togglePause}
          />
        )}
        {phase !== "idle" && <Button label="Reiniciar" icon={RotateCcw} variant="outline" onPress={reset} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  display: { borderRadius: radiusLg, paddingVertical: 18 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 12, flexWrap: "wrap" },
})
