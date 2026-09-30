// Serie por tiempo: "prepárate" 3-2-1 con pitidos, cuenta del tiempo con aviso en
// los últimos 3 segundos y alarma al terminar. Si el atleta sale de la app mientras
// corre, la notificación del sistema le avisa al terminar.
// El control (empezar, pausar, seguir, reiniciar) vive en los botones del pie del
// ejecutor: aquí solo está la lógica (`useSetCountdown`) y la cara del cronómetro.
import { Text } from "@/components/text"
import { feedback } from "@/lib/feedback"
import { cancelTimerAlert, scheduleTimerAlert } from "@/lib/notifications"
import { colors } from "@/lib/theme"
import { useRemainingMs, useSecondTicks } from "@/lib/use-countdown"
import { formatClock } from "@/lib/workout"
import { useEffect, useRef, useState } from "react"
import { View } from "react-native"

export type CountdownPhase = "idle" | "prepare" | "running" | "paused" | "finished"

const PREPARE_MS = 3000

export function useSetCountdown(seconds: number, exerciseName: string) {
  const [phase, setPhase] = useState<CountdownPhase>("idle")
  const [endAt, setEndAt] = useState<number | null>(null)
  const [pausedLeft, setPausedLeft] = useState(seconds * 1000)
  const alert = useRef<Promise<string | null> | null>(null)
  const lastShown = useRef<number | null>(null)
  const latest = useRef({ seconds, exerciseName })
  latest.current = { seconds, exerciseName }

  const ms = useRemainingMs(phase === "prepare" || phase === "running" ? endAt : null)
  const shown = ms == null ? null : Math.max(0, Math.ceil(ms / 1000))

  useEffect(() => () => cancelTimerAlert(alert.current), [])

  function run(leftMs: number) {
    const end = Date.now() + leftMs
    setEndAt(end)
    setPhase("running")
    alert.current = scheduleTimerAlert(end, "¡Tiempo!", `Terminó la serie de ${latest.current.exerciseName}. Márcala como hecha.`)
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
      run(latest.current.seconds * 1000)
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

  function pause() {
    if (phase !== "running" || ms == null) return
    cancelTimerAlert(alert.current)
    setPausedLeft(Math.max(0, ms))
    setPhase("paused")
  }

  function resume() {
    if (phase === "paused") run(pausedLeft)
  }

  /** Vuelve a "listo" (cancelar, reiniciar o cambiar de serie). */
  function reset() {
    cancelTimerAlert(alert.current)
    alert.current = null
    setPhase("idle")
    setEndAt(null)
    setPausedLeft(latest.current.seconds * 1000)
  }

  const value = phase === "prepare"
    ? String(shown ?? 3)
    : phase === "running"
      ? formatClock(shown ?? seconds)
      : phase === "idle" ? formatClock(seconds) : formatClock(Math.ceil(pausedLeft / 1000))

  return { phase, value, start, pause, resume, reset }
}

export type SetCountdown = ReturnType<typeof useSetCountdown>

/** Cara del cronómetro: solo el tiempo y su leyenda, sin botones. */
export function CountdownFace({ phase, value, size }: { phase: CountdownPhase; value: string; size: number }) {
  const preparing = phase === "prepare"
  const running = phase === "running" || phase === "paused"
  const finished = phase === "finished"
  const tone = preparing || finished ? colors.destructive : running ? colors.success : colors.foreground
  return (
    <View style={{ alignItems: "center" }}>
      <Text heading size={size} color={tone} center tabular style={{ lineHeight: size }}>{value}</Text>
      <Text size={20} center color={running || preparing || finished ? tone : colors.foreground}>
        {preparing ? "prepárate…" : finished ? "¡Tiempo!" : phase === "paused" ? "en pausa" : "segundos"}
      </Text>
    </View>
  )
}
