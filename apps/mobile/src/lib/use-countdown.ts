// Cuenta regresiva basada en la hora de fin, no en ir restando segundos: si la
// app se duerme (pantalla bloqueada, otra app), al volver marca el tiempo real.
import { useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

/** Milisegundos que faltan para `endAt` (negativos si ya pasó), o null si no hay cuenta. */
export function useRemainingMs(endAt: number | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endAt == null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 200)
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") setNow(Date.now()) })
    return () => { clearInterval(id); sub.remove() }
  }, [endAt])

  return endAt == null ? null : endAt - now
}

/**
 * Llama a `onSecond(s)` cada vez que el contador baja exactamente un segundo
 * (4 → 3, 3 → 2…). Si la app vuelve de segundo plano con varios segundos de
 * salto no se dispara: ese aviso ya lo dio la notificación del sistema.
 */
export function useSecondTicks(seconds: number | null, onSecond: (s: number) => void) {
  const prev = useRef<number | null>(null)
  const cb = useRef(onSecond)
  cb.current = onSecond

  useEffect(() => {
    const before = prev.current
    prev.current = seconds
    if (seconds == null || before == null) return
    if (before - seconds === 1 && AppState.currentState === "active") cb.current(seconds)
  }, [seconds])
}
