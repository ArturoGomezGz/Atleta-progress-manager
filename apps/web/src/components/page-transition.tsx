"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export type SlideDirection = "forward" | "back"

const SLIDE_MS = 280

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
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (direction === null) return children

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "transition-transform ease-out",
        entered ? "translate-x-0" : direction === "forward" ? "translate-x-full" : "-translate-x-full",
        className,
      )}
      style={{ transitionDuration: `${SLIDE_MS}ms` }}
    >
      {children}
    </div>
  )
}
