// Serie por tiempo: "prepárate" 3-2-1 con pitidos, cuenta del tiempo con aviso en
// los últimos 3 segundos y alarma al terminar. Si el atleta sale de la app mientras
// corre, la notificación del sistema le avisa al terminar.
// El control (empezar, pausar, seguir, reiniciar) vive en los botones del pie del
// ejecutor: aquí solo está la lógica (`useSetCountdown`) y la cara del cronómetro.
// "Por cada lado": dos tiempos seguidos (lado 1, pausa "Cambia de lado", lado 2);
// la serie solo queda terminada al acabar el lado 2.
import { Text } from "@/components/text"
import { feedback } from "@/lib/feedback"
import { cancelTimerAlert, scheduleTimerAlert } from "@/lib/notifications"
import { colors } from "@/lib/theme"
import { useRemainingMs, useSecondTicks } from "@/lib/use-countdown"
import { formatClock } from "@/lib/workout"
import { SIDE_SWITCH_SECONDS } from "@/lib/workout-text"
import { useEffect, useRef, useState } from "react"
import { View } from "react-native"

/** "switch": pausa corta entre el lado 1 y el lado 2 de una serie "Por cada lado". */
export type CountdownPhase = "idle" | "prepare" | "running" | "paused" | "switch" | "finished"

const PREPARE_MS = 3000
const SWITCH_MS = SIDE_SWITCH_SECONDS * 1000

export function useSetCountdown(seconds: number, exerciseName: string, perSide = false) {
  const [phase, setPhase] = useState<CountdownPhase>("idle")
  const [endAt, setEndAt] = useState<number | null>(null)
  const [pausedLeft, setPausedLeft] = useState(seconds * 1000)
  const [side, setSide] = useState<1 | 2>(1)
  const alert = useRef<Promise<string | null> | null>(null)
  const lastShown = useRef<number | null>(null)
  const latest = useRef({ seconds, exerciseName, perSide, side })
  latest.current = { seconds, exerciseName, perSide, side }

  const ms = useRemainingMs(phase === "prepare" || phase === "running" || phase === "switch" ? endAt : null)
  const shown = ms == null ? null : Math.max(0, Math.ceil(ms / 1000))

  useEffect(() => () => cancelTimerAlert(alert.current), [])

  /** Corre el tiempo del lado actual. `from` encadena con el final anterior (si se volvió de segundo plano). */
  function run(leftMs: number, from = Date.now()) {
    const end = from + leftMs
    setEndAt(end)
    setPhase("running")
    const { exerciseName: name, perSide: ps, side: s } = latest.current
    alert.current = ps && s === 1
      ? scheduleTimerAlert(end, "Cambia de lado", `Terminó el lado 1 de ${name}. Sigue con el lado 2.`)
      : scheduleTimerAlert(end, "¡Tiempo!", `Terminó la serie de ${name}. Márcala como hecha.`)
  }

  /** Termina el lado 1 y empieza la pausa para cambiar de lado. */
  function toSwitch(from = Date.now()) {
    cancelTimerAlert(alert.current)
    alert.current = null
    setEndAt(from + SWITCH_MS)
    setPhase("switch")
  }

  /** Empieza el lado 2. */
  function toSide2(from = Date.now()) {
    setSide(2)
    latest.current = { ...latest.current, side: 2 }
    run(latest.current.seconds * 1000, from)
  }

  // 3-2-1 y últimos segundos
  useSecondTicks(shown, (s) => {
    if (s >= 1 && s <= 3) feedback.tick()
  })

  // Transiciones al llegar a cero. Los lados se encadenan desde el final anterior
  // (no desde ahora): al volver de segundo plano el tiempo sigue siendo el real.
  useEffect(() => {
    if (ms == null) return
    if (ms > 0) { lastShown.current = shown; return }
    if (phase === "prepare") {
      feedback.go()
      run(latest.current.seconds * 1000)
    } else if (phase === "switch") {
      feedback.go()
      toSide2(endAt ?? Date.now())
    } else if (phase === "running" && latest.current.perSide && latest.current.side === 1) {
      if (lastShown.current != null && lastShown.current <= 1) feedback.timeUp()
      lastShown.current = SIDE_SWITCH_SECONDS
      toSwitch(endAt ?? Date.now())
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
    setSide(1)
    latest.current = { ...latest.current, side: 1 }
    setEndAt(Date.now() + PREPARE_MS)
    setPhase("prepare")
  }

  /** "Por cada lado": salta lo que queda del lado 1 o de la pausa de cambio. */
  function skipSide() {
    if (phase === "running" && perSide && side === 1) {
      feedback.go()
      toSwitch()
    } else if (phase === "switch") {
      feedback.go()
      toSide2()
    }
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
    setSide(1)
    setPausedLeft(latest.current.seconds * 1000)
  }

  const value = phase === "prepare"
    ? String(shown ?? 3)
    : phase === "switch"
      ? String(shown ?? SIDE_SWITCH_SECONDS)
    : phase === "running"
      ? formatClock(shown ?? seconds)
      : phase === "idle" ? formatClock(seconds) : formatClock(Math.ceil(pausedLeft / 1000))

  /** En una serie "Por cada lado" sin terminar, ¿el lado 1 todavía no acaba? */
  const onFirstSide = perSide && side === 1 && phase !== "finished"

  return { phase, value, side, perSide, onFirstSide, start, pause, resume, reset, skipSide }
}

export type SetCountdown = ReturnType<typeof useSetCountdown>

/** Cara del cronómetro: solo el tiempo y su leyenda, sin botones. */
export function CountdownFace({ phase, value, size }: { phase: CountdownPhase; value: string; size: number }) {
  const switching = phase === "switch"
  const preparing = phase === "prepare" || switching
  const running = phase === "running" || phase === "paused"
  const finished = phase === "finished"
  const tone = preparing || finished ? colors.destructive : running ? colors.success : colors.foreground
  return (
    <View style={{ alignItems: "center" }}>
      <Text heading size={size} color={tone} center tabular style={{ lineHeight: size }}>{value}</Text>
      <Text size={20} center color={running || preparing || finished ? tone : colors.foreground}>
        {switching ? "cambia de lado…" : preparing ? "prepárate…" : finished ? "¡Tiempo!" : phase === "paused" ? "en pausa" : "segundos"}
      </Text>
    </View>
  )
}
