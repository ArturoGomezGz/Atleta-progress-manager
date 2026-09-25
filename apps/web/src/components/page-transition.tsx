"use client"

import { cn } from "@/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"

export type SlideDirection = "forward" | "back"

const SLIDE_MS = 320
const SLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/**
 * Envuelve una vista de un flujo secuencial (p. ej. crear una plantilla y
 * después editarla) para que entre deslizándose en vez de aparecer de golpe:
 * "forward" la trae desde la derecha (avanzar), "back" desde la izquierda
 * (volver atrás). Sin dirección, no anima nada (carga directa de la vista).
 *
 * `onEntered` se llama una sola vez cuando la vista ya está en su sitio (al
 * terminar el deslizamiento, o justo al montar si no hay animación). Es el
 * momento para enfocar un input: hacerlo antes (p. ej. con `autoFocus`) enfoca
 * un elemento que aún está fuera de pantalla, y el navegador desplaza el
 * contenedor con scroll para mostrarlo —y abre el teclado en móvil— en mitad
 * del deslizamiento, que es lo que hace que la vista "tiemble".
 */
export function PageTransition({ direction, children, className, onEntered }: {
  direction: SlideDirection | null
  children: React.ReactNode
  className?: string
  onEntered?: () => void
}) {
  const [entered, setEntered] = useState(false)

  const onEnteredRef = useRef(onEntered)
  useEffect(() => {
    onEnteredRef.current = onEntered
  })
  const doneRef = useRef(false)
  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onEnteredRef.current?.()
  }, [])

  useEffect(() => {
    // Un solo rAF no basta: el navegador puede fusionar el paint inicial (fuera de
    // pantalla) con el callback en el mismo frame, y la vista "salta" en vez de
    // deslizarse. El segundo rAF garantiza que el primer frame ya se pintó antes
    // de pedir la posición final, así la transición sí tiene un punto de partida
    // real del que animar.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  useEffect(() => {
    if (direction === null) {
      finish()
      return
    }
    if (!entered) return
    // Red de seguridad por si `transitionend` no llega (pestaña en segundo plano,
    // transición cancelada, movimiento reducido…).
    const t = setTimeout(finish, SLIDE_MS + 80)
    return () => clearTimeout(t)
  }, [direction, entered, finish])

  if (direction === null) return children

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "transition-transform will-change-transform",
        entered ? "translate-x-0" : direction === "forward" ? "translate-x-full" : "-translate-x-full",
        className,
      )}
      style={{ transitionDuration: `${SLIDE_MS}ms`, transitionTimingFunction: SLIDE_EASING }}
      onTransitionEnd={(e) => {
        // Solo la transición del propio contenedor (en Tailwind 4 la propiedad es
        // `translate`, no `transform`); las de los hijos también burbujean aquí.
        if (entered && e.target === e.currentTarget) finish()
      }}
    >
      {children}
    </div>
  )
}
