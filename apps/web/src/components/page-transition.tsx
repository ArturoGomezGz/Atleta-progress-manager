"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export type SlideDirection = "forward" | "back"

const SLIDE_MS = 320
const SLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/**
 * Envuelve una vista de un flujo secuencial (p. ej. crear una plantilla y
 * después editarla) para que entre deslizándose en vez de aparecer de golpe:
 * "forward" la trae desde la derecha (avanzar), "back" desde la izquierda
 * (volver atrás). Sin dirección, no anima nada (carga directa de la vista).
 */
export function PageTransition({ direction, children, className }: {
  direction: SlideDirection | null
  children: React.ReactNode
  className?: string
}) {
  const [entered, setEntered] = useState(false)

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
    >
      {children}
    </div>
  )
}
