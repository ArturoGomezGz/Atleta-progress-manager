"use client"

import { afterNextPaint } from "@/lib/after-paint"
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
 * terminar el deslizamiento, o tras el primer paint si no hay animación). Es el
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

  // Pintar primero fuera de pantalla y recién entonces pedir la posición final (ver
  // afterNextPaint: con un solo rAF la vista a veces "salta" en vez de deslizarse).
  useEffect(() => afterNextPaint(() => setEntered(true)), [])

  useEffect(() => {
    if (!entered) return
    // Sin animación también se espera a ese primer paint: quien usa la vista puede
    // fijar la dirección en un useLayoutEffect (p. ej. al volver atrás), y React
    // corre los efectos del primer render —todavía con `null`— antes de aplicarla;
    // avisar ahí daría la vista por "entrada" justo antes de que empiece a deslizarse.
    if (direction === null) {
      finish()
      return
    }
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

/**
 * Orden de aparición de una vista que entra animada mientras todavía carga sus datos:
 * primero el movimiento, después (ya quieta) el esqueleto y al final el contenido real.
 *
 * Si los datos llegan a mitad de la animación, esperan a que termine: cambiar el
 * contenido —y su alto— en pleno movimiento es lo que se ve como un salto. Si ya
 * estaban al montar (caché), el contenido real entra animado desde el principio.
 *
 * `onEntered` se conecta a `PageTransition` (o a la animación de entrada propia).
 */
export function useRevealAfterEnter(ready: boolean) {
  const [entered, setEntered] = useState(false)
  const [readyOnMount] = useState(ready)
  const onEntered = useCallback(() => setEntered(true), [])
  const showContent = ready && (entered || readyOnMount)
  return { onEntered, showContent, showSkeleton: entered && !showContent }
}
