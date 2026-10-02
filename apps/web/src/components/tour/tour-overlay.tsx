"use client"

// Motor del tutorial guiado (docs/onboarding.md). No sabe nada de pasos: recibe una lista de
// "vistas" candidatas (un elemento objetivo identificado con `data-tour="<id>"` más el texto del
// pop-over) y muestra la primera cuyo elemento exista:
//
//  - Oscurece toda la página dejando un hueco sobre el objetivo. Solo el objetivo (y el pop-over)
//    reciben clics y teclado; todo lo demás queda bloqueado mientras la vista es bloqueante.
//  - Si el objetivo aún no existe lo espera un momento; si no aparece, ofrece Reintentar u Omitir.
//  - Esc no omite. Omitir es siempre un botón del pop-over.
//
// Nada de lo que se hace aquí debe poder dejar la app bloqueada: los escuchadores se retiran al
// desmontar y el pop-over siempre trae "Omitir tutorial".

import { computePlacement, holeBox, type Box } from "@/lib/tour-placement"
import { cn } from "@/lib/utils"
import { Component, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

export type TourView = {
  /** Cambia cuando cambia lo que se muestra (reinicia el foco y los temporizadores). */
  key: string
  /** Selector CSS del objetivo; null = pop-over centrado sin objetivo. */
  selector: string | null
  title: string
  body: ReactNode
  /** El objetivo recibe clics y teclado (por defecto sí). false = solo se resalta. */
  interactive?: boolean
  /** Bloquea el resto de la página (por defecto sí). false = solo un aviso. */
  blocking?: boolean
  /** Botón principal para pasos sin acción (Entendido, Continuar…). */
  action?: { label: string; onClick: () => void }
  /** Aviso mínimo (una cinta chica) en vez del pop-over completo. Solo con blocking false. */
  compact?: boolean
}

type Props = {
  views: TourView[]
  onSkip: () => void
}

// Tiempo máximo esperando al objetivo antes de ofrecer Reintentar/Omitir
const MISSING_AFTER_MS = 4000
// Con el objetivo a la vista y sin avanzar, Omitir se vuelve el botón destacado
const STUCK_AFTER_MS = 45000
const Z = 1000

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'

function findVisible(selector: string): HTMLElement | null {
  let nodes: NodeListOf<HTMLElement>
  try {
    nodes = document.querySelectorAll<HTMLElement>(selector)
  } catch {
    return null
  }
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    // Fuera de pantalla en horizontal (menú móvil cerrado) cuenta como "aún no está"
    if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= window.innerWidth) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === "hidden" || cs.display === "none") continue
    return el
  }
  return null
}

function pick(views: TourView[]): { key: string; el: HTMLElement | null } | null {
  for (const v of views) {
    if (!v.selector) return { key: v.key, el: null }
    const el = findVisible(v.selector)
    if (el) return { key: v.key, el }
  }
  return null
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return reduced
}

/** Primera vista cuyo objetivo existe, vigilando el DOM (cambios y sondeo corto). */
function usePicked(views: TourView[], attempt: number) {
  const viewsRef = useRef(views)
  viewsRef.current = views
  const sig = views.map((v) => `${v.key}|${v.selector}`).join(";")
  const [picked, setPicked] = useState<{ key: string; el: HTMLElement | null } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let missingTimer: ReturnType<typeof setTimeout> | undefined
    setMissing(false)
    const tick = () => {
      const next = pick(viewsRef.current)
      setPicked((prev) => (prev?.key === next?.key && prev?.el === next?.el ? prev : next))
      if (next) {
        setMissing(false)
        if (missingTimer) { clearTimeout(missingTimer); missingTimer = undefined }
      } else if (!missingTimer) {
        missingTimer = setTimeout(() => { if (!pick(viewsRef.current)) setMissing(true) }, MISSING_AFTER_MS)
      }
    }
    tick()
    const observer = new MutationObserver(tick)
    observer.observe(document.body, { childList: true, subtree: true })
    const interval = setInterval(tick, 250)
    return () => {
      observer.disconnect()
      clearInterval(interval)
      if (missingTimer) clearTimeout(missingTimer)
    }
  }, [sig, attempt])

  return { picked, missing }
}

function useBox(el: HTMLElement | null): Box | null {
  const [box, setBox] = useState<Box | null>(null)
  useEffect(() => {
    if (!el) { setBox(null); return }
    let raf = 0
    let last = ""
    const loop = () => {
      const r = el.getBoundingClientRect()
      const k = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`
      if (k !== last) {
        last = k
        setBox({ left: r.left, top: r.top, width: r.width, height: r.height })
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [el])
  return box
}

function useViewport() {
  const [view, setView] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const on = () => setView({ width: window.innerWidth, height: window.innerHeight })
    on()
    window.addEventListener("resize", on)
    return () => window.removeEventListener("resize", on)
  }, [])
  return view
}

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  const list = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (root.matches(FOCUSABLE)) list.unshift(root)
  return list.filter((n) => {
    if ((n as HTMLButtonElement).disabled) return false
    if (n.closest("[data-tour-block]")) return false
    const r = n.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
}

// ─── Bloqueo de eventos ───────────────────────────────────────────────────────

const BLOCKED_EVENTS = [
  "pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick",
  "contextmenu", "touchstart", "touchend", "keydown", "keyup", "keypress", "submit", "dragstart",
] as const

/**
 * Mientras está activo, ningún evento llega a la página salvo los que ocurren dentro del
 * objetivo (si es interactivo) o del pop-over. Es lo que garantiza "solo se puede hacer clic
 * donde el tutorial indica" aunque el hueco cubra elementos vecinos, y cubre el teclado.
 */
function useEventGuard(active: boolean, target: HTMLElement | null, interactive: boolean, popRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return
    const allowed = (node: EventTarget | null) => {
      if (!(node instanceof Node)) return false
      if (popRef.current?.contains(node)) return true
      if (!interactive || !target || !target.contains(node)) return false
      const el = node instanceof Element ? node : node.parentElement
      return !el?.closest("[data-tour-block]")
    }
    const onEvent = (e: Event) => {
      if (e.type === "keydown" || e.type === "keyup" || e.type === "keypress") {
        const k = e as KeyboardEvent
        // Esc nunca omite ni cierra nada de la página
        if (k.key === "Escape") { k.preventDefault(); k.stopImmediatePropagation(); return }
        if (k.key === "Tab") {
          if (e.type !== "keydown") return
          const list = [...focusables(popRef.current), ...(interactive ? focusables(target) : [])]
          k.preventDefault()
          k.stopImmediatePropagation()
          if (list.length === 0) return
          const i = list.indexOf(document.activeElement as HTMLElement)
          const next = k.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i === -1 || i === list.length - 1 ? 0 : i + 1)
          list[next].focus({ preventScroll: false })
          return
        }
        // Sin nada enfocado (body) no hay a qué pegarle; que el navegador haga su scroll
        if (e.target === document.body || e.target === document.documentElement) return
      }
      if (allowed(e.target)) return
      // El envío de un formulario lo dispara el <form>, que contiene al objetivo (p. ej. su botón de enviar)
      if (e.type === "submit" && interactive && target && e.target instanceof Node && (e.target.contains(target) || target.contains(e.target))) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const onFocusIn = (e: FocusEvent) => {
      if (allowed(e.target)) return
      popRef.current?.focus({ preventScroll: true })
    }
    for (const t of BLOCKED_EVENTS) window.addEventListener(t, onEvent, { capture: true, passive: false })
    window.addEventListener("focusin", onFocusIn, true)
    return () => {
      for (const t of BLOCKED_EVENTS) window.removeEventListener(t, onEvent, { capture: true } as EventListenerOptions)
      window.removeEventListener("focusin", onFocusIn, true)
    }
  }, [active, target, interactive, popRef])
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TourOverlay({ views, onSkip }: Props) {
  const [attempt, setAttempt] = useState(0)
  const { picked, missing } = usePicked(views, attempt)
  const blockingAny = views.some((v) => v.blocking !== false)

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (typeof document === "undefined") return null

  if (!picked) {
    if (!missing) {
      // Esperando al objetivo: se bloquea sin pintar nada para no parpadear
      return blockingAny ? <Waiting /> : null
    }
    const lost: TourView = {
      key: "missing",
      selector: null,
      title: "No encontramos el siguiente paso",
      body: "Puede que la pantalla siga cargando. Reintenta, o salta el tutorial si prefieres seguir por tu cuenta.",
      action: { label: "Reintentar", onClick: retry },
    }
    return <Layer view={lost} el={null} onSkip={onSkip} prominentSkip />
  }

  const view = views.find((v) => v.key === picked.key)
  if (!view) return null
  return <Layer view={view} el={picked.el} onSkip={onSkip} />
}

/** Bloquea (puntero y teclado) sin pintar nada mientras se espera al objetivo. */
function Waiting() {
  const noPop = useRef<HTMLElement | null>(null)
  useEventGuard(true, null, false, noPop)
  return createPortal(<div className="fixed inset-0" style={{ zIndex: Z }} aria-hidden="true" />, document.body)
}

function Layer({ view, el, onSkip, prominentSkip = false }: { view: TourView; el: HTMLElement | null; onSkip: () => void; prominentSkip?: boolean }) {
  const blocking = view.blocking !== false
  const interactive = view.interactive !== false
  const popRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const box = useBox(el)
  const viewport = useViewport()
  const titleId = useId()
  const bodyId = useId()
  const [popSize, setPopSize] = useState<{ width: number; height: number } | null>(null)
  const [stuck, setStuck] = useState(false)

  useEventGuard(blocking, el, interactive, popRef)

  // Deja el objetivo a la vista (también dentro de contenedores con scroll)
  useEffect(() => {
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    if (r.top < 64 || r.bottom > vh - 24) {
      el.scrollIntoView({ block: r.height > vh * 0.7 ? "start" : "center", behavior: reduced ? "auto" : "smooth" })
    }
  }, [el, reduced])

  // El foco va al pop-over, salvo que ya esté dentro del objetivo (p. ej. escribiendo)
  useEffect(() => {
    if (!blocking) return
    const active = document.activeElement
    if (!active || active === document.body || !(el && el.contains(active))) popRef.current?.focus({ preventScroll: true })
  }, [view.key, blocking, el])

  // Si la vista lleva mucho sin avanzar, Omitir pasa a ser el botón destacado
  useEffect(() => {
    setStuck(false)
    if (!blocking) return
    const t = setTimeout(() => setStuck(true), STUCK_AFTER_MS)
    return () => clearTimeout(t)
  }, [view.key, blocking])

  useLayoutEffect(() => {
    const node = popRef.current
    if (!node) return
    const measure = () => {
      const r = node.getBoundingClientRect()
      setPopSize((p) => (p && Math.abs(p.width - r.width) < 1 && Math.abs(p.height - r.height) < 1 ? p : { width: r.width, height: r.height }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [view.key])

  const vp = { width: viewport.width, height: viewport.height }
  const hole = box && vp.width > 0 ? holeBox(box, vp) : null
  // Parte visible del objetivo: el pop-over se acomoda respecto a eso, no a su tamaño total
  const visible: Box | null = box && vp.width > 0
    ? (() => {
        const left = Math.max(0, box.left), top = Math.max(0, box.top)
        const right = Math.min(vp.width, box.left + box.width), bottom = Math.min(vp.height, box.top + box.height)
        return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
      })()
    : null
  const placement = popSize && vp.width > 0 ? computePlacement(el ? visible : null, popSize, vp) : null

  const skipProminent = prominentSkip || stuck

  if (view.compact) {
    return createPortal(
      <div className="fixed top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-popover/95 text-popover-foreground shadow-lg pl-3 pr-1 py-0.5 text-xs" style={{ zIndex: Z }}>
        <span className="text-muted-foreground">Tutorial</span>
        <button type="button" onClick={onSkip} className="rounded-full px-2.5 py-1.5 font-medium hover:bg-muted/60 cursor-pointer">
          Omitir
        </button>
      </div>,
      document.body,
    )
  }

  const skipButton = (
    <button
      type="button"
      onClick={onSkip}
      className={cn(
        "cursor-pointer text-xs font-medium",
        skipProminent
          ? "px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground hover:bg-muted"
          : "px-1 py-2 text-muted-foreground hover:text-foreground underline underline-offset-2",
      )}
    >
      Omitir tutorial
    </button>
  )

  const arrow = placement?.arrowSide
  const popover = (
    <div
      ref={popRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      className={cn(
        "fixed w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-primary/40 bg-popover text-popover-foreground shadow-2xl p-4 space-y-3 outline-none",
        !reduced && "tour-pop-in",
      )}
      style={{
        zIndex: Z + 1,
        // Aviso no bloqueante: arriba al centro, sin tapar los controles de abajo
        ...(blocking
          ? { left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement ? "visible" : "hidden" }
          : { left: "50%", top: 8, marginLeft: "calc(min(22rem, 100vw - 1.5rem) / -2)" }),
      }}
    >
      {blocking && arrow && placement && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute w-4 h-4 rotate-45 bg-popover border-primary/40",
            arrow === "top" && "-top-2 border-l border-t",
            arrow === "bottom" && "-bottom-2 border-r border-b",
            arrow === "left" && "-left-2 border-l border-b",
            arrow === "right" && "-right-2 border-r border-t",
          )}
          style={arrow === "top" || arrow === "bottom" ? { left: placement.arrowOffset - 8 } : { top: placement.arrowOffset - 8 }}
        />
      )}
      <div className="space-y-1">
        <h2 id={titleId} className="text-base font-semibold leading-snug">{view.title}</h2>
        <div id={bodyId} className="text-sm text-muted-foreground leading-relaxed">{view.body}</div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {skipButton}
        {view.action && (
          <button
            type="button"
            onClick={view.action.onClick}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer"
          >
            {view.action.label}
          </button>
        )}
      </div>
    </div>
  )

  if (!blocking) return createPortal(popover, document.body)

  // Bloqueo visual y de punteros: cuatro paneles alrededor del hueco (o uno si no hay objetivo).
  // El aro con sombra enorme pinta lo oscuro con esquinas redondeadas y no recibe eventos.
  const panels: { left: number; top: number; width: number; height: number }[] = hole
    ? [
        { left: 0, top: 0, width: vp.width, height: hole.top },
        { left: 0, top: hole.top + hole.height, width: vp.width, height: Math.max(0, vp.height - hole.top - hole.height) },
        { left: 0, top: hole.top, width: hole.left, height: hole.height },
        { left: hole.left + hole.width, top: hole.top, width: Math.max(0, vp.width - hole.left - hole.width), height: hole.height },
        // Un objetivo que solo se resalta (no interactivo) también se cubre por dentro
        ...(interactive ? [] : [hole]),
      ]
    : [{ left: 0, top: 0, width: vp.width, height: vp.height }]

  return createPortal(
    <>
      <div aria-hidden="true">
        {panels.map((p, i) => (
          <div key={i} className="fixed" style={{ left: p.left, top: p.top, width: p.width, height: p.height, zIndex: Z }} />
        ))}
        {hole ? (
          <div
            className={cn("fixed rounded-xl pointer-events-none", !reduced && "tour-ring")}
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              zIndex: Z,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
              outline: "2px solid hsl(var(--primary))",
              outlineOffset: 0,
            }}
          />
        ) : (
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: Z, backgroundColor: "rgba(0,0,0,0.62)" }} />
        )}
      </div>
      {popover}
    </>,
    document.body,
  )
}

// ─── Red de seguridad ─────────────────────────────────────────────────────────

/** Si algo del tutorial falla al pintarse, no se muestra nada (jamás deja la app bloqueada). */
export class TourErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error("Tutorial desactivado por un error", error) }
  render() { return this.state.failed ? null : this.props.children }
}
