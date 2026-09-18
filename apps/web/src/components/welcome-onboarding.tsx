"use client"

import { cn } from "@/lib/utils"
import { BookmarkIcon, CompassIcon, DumbbellIcon, PlusIcon, SparklesIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

// ── Contenido de los pasos ───────────────────────────────────────────────────
// Solo tres: bienvenida → explorar/guardar → crear. Es el núcleo que se pidió
// mostrar a un usuario nuevo, ni un paso más.

const STEPS = [
  {
    icon: DumbbellIcon,
    title: "Bienvenido a Atleta",
    cta: "Empezar",
    body: (
      <>
        Aquí viven tus ejercicios, tus rutinas y el progreso de tu equipo.
        Te mostramos lo esencial en menos de un minuto.
      </>
    ),
  },
  {
    icon: CompassIcon,
    title: "Explora y guarda",
    cta: "Siguiente",
    body: (
      <>
        En <span className="text-foreground font-medium">Explorar</span> tienes un catálogo
        con video, músculos y equipamiento de cada ejercicio. Toca el{" "}
        <BookmarkIcon className="w-3.5 h-3.5 inline-block align-[-2px] text-primary" /> marcador
        de la tarjeta para guardarlo en tu colección.
      </>
    ),
  },
  {
    icon: PlusIcon,
    title: "Crea el tuyo",
    cta: "Ir a Explorar",
    body: null, // se arma en el render: la última frase cambia según el rol
  },
] as const

// Última frase del paso 3 — lo único que cambia entre coach y atleta.
const CLOSING_SENTENCE = {
  coach: "Podrás usarlo en tus plantillas y sesiones, y publicarlo para que otros entrenadores lo encuentren.",
  athlete: "Lo tendrás siempre a mano junto a los que guardaste.",
} as const

export function WelcomeOnboarding({
  isCoach,
  onDone,
  onNavigateToExplore,
}: {
  isCoach: boolean
  onDone: () => void
  onNavigateToExplore: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [stepVisible, setStepVisible] = useState(true)
  const [step, setStep] = useState(0)
  const closing = useRef(false)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Entrada + foco inicial en el CTA primario
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => primaryRef.current?.focus(), 320)
    return () => clearTimeout(t)
  }, [])

  // Bloquea el scroll de fondo mientras está abierto
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  // Escape cierra (equivale a Saltar); Tab queda atrapado dentro del panel
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        skip()
        return
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>("button")
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close(after: () => void) {
    if (closing.current) return
    closing.current = true
    setVisible(false)
    setTimeout(() => {
      onDoneRef.current()
      after()
    }, 300)
  }

  function skip() {
    close(() => {})
  }

  function finish() {
    close(onNavigateToExplore)
  }

  function go(delta: number) {
    setStepVisible(false)
    setTimeout(() => {
      setStep((s) => s + delta)
      setStepVisible(true)
    }, 150)
  }

  const { icon: Icon, title, body, cta } = STEPS[step]
  const isLast = step === STEPS.length - 1

  return createPortal(
    <>
      {/* Backdrop — no cierra al tocar: solo Saltar, Escape o terminar */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0 pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-body"
          className={cn(
            "w-full max-w-md pointer-events-auto flex flex-col overflow-hidden",
            "bg-card border border-border rounded-2xl shadow-xl max-h-[85dvh]",
            "transition-all duration-300 ease-out",
            visible
              ? "translate-y-0 opacity-100 sm:scale-100"
              : "translate-y-full opacity-0 sm:translate-y-2 sm:scale-95",
          )}
        >
          <p className="sr-only" aria-live="polite">
            Paso {step + 1} de {STEPS.length}: {title}
          </p>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 pl-5 pr-2 pt-2 shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
              Paso {step + 1} de {STEPS.length}
            </p>
            <button
              type="button"
              onClick={skip}
              className="min-w-[44px] h-11 px-3 text-sm text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Saltar
            </button>
          </div>

          {/* Cuerpo */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pt-3 pb-5 min-h-[196px]">
            <div className={cn("transition-opacity duration-150 ease-out", stepVisible ? "opacity-100" : "opacity-0")}>
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h2 id="onboarding-title" className="text-2xl font-bold uppercase tracking-wider text-foreground mt-4">
                {title}
              </h2>
              <p id="onboarding-body" className="text-sm text-muted-foreground leading-relaxed mt-2">
                {body ?? (
                  <>
                    ¿Falta un ejercicio? Créalo desde{" "}
                    <span className="text-foreground font-medium">Mis ejercicios</span>. Pega el enlace de
                    YouTube y la{" "}
                    <SparklesIcon className="w-3.5 h-3.5 inline-block align-[-2px] text-primary" /> IA te
                    propone músculos, patrón de movimiento y equipamiento.{" "}
                    {isCoach ? CLOSING_SENTENCE.coach : CLOSING_SENTENCE.athlete}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 pb-4 shrink-0" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 ease-out",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 sm:px-6 pb-5 shrink-0">
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="flex-1 h-11 text-sm border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Atrás
              </button>
            )}
            <button
              type="button"
              ref={primaryRef}
              onClick={() => (isLast ? finish() : go(1))}
              className="flex-1 h-11 text-sm bg-primary text-primary-foreground rounded-xl font-medium cursor-pointer hover:brightness-110 transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {cta}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
