"use client"

import { ExerciseFinderBar, FinderEmptyResults, useExerciseFinder, type FinderExercise } from "@/components/exercise-finder"
import { YouTubeThumb } from "@/components/youtube-player"
import { cn } from "@/lib/utils"
import { deriveBodyZone, ZONE_CONFIG } from "@/lib/body-zones"
import { ChevronDownIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

// Selector de ejercicios para armar una plantilla. Antes era un dropdown angosto
// posicionado junto al botón "Agregar ejercicio…"; con muchos ejercicios en el
// catálogo (o el botón ya empujado hacia el fondo de la pantalla por ejercicios
// previamente agregados) esa lista era difícil de explorar y podía quedar cortada
// por el borde del viewport. Ahora reutiliza el mismo panel de búsqueda + filtros
// y las tarjetas con miniatura que ya usa "Mis ejercicios": se abre como una hoja
// de pantalla completa (bottom sheet en móvil, panel lateral en desktop), así que
// nunca depende de la posición del botón que la abre ni del tamaño de la lista.

export type PickerExercise = FinderExercise & {
  category: "team" | "system" | "mine" | "saved" | "public"
  youtubeVideoId?: string | null
  videoOrientation?: "horizontal" | "vertical"
}

const CATEGORY_LABELS: Record<PickerExercise["category"], string> = {
  team: "Del equipo",
  mine: "Mis ejercicios",
  saved: "Guardados",
  system: "Sistema",
  public: "Públicos",
}

// Propios primero (equipo y personales), luego guardados, para encontrarlos rápido.
const CATEGORY_ORDER: PickerExercise["category"][] = ["team", "mine", "saved", "system", "public"]

const DIFFICULTY_CONFIG = {
  beginner:     { label: "Principiante", pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  intermediate: { label: "Intermedio",   pill: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  advanced:     { label: "Avanzado",     pill: "bg-red-500/10 text-red-600 border-red-500/20" },
} as const

const PATTERN_LABELS: Record<string, string> = {
  push: "Empuje", pull: "Jalón", squat: "Sentadilla", hinge: "Bisagra",
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad", core: "Core",
}

type Props = {
  exercises: PickerExercise[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  /** Reemplaza el botón por defecto (útil para un trigger con otro aspecto, como una tarjeta placeholder). Recibe la función que abre la hoja. */
  trigger?: (open: () => void) => ReactNode
}

export function ExercisePicker({ exercises, value, onChange, placeholder = "Seleccionar ejercicio...", trigger }: Props) {
  const [open, setOpen] = useState(false)
  const selected = exercises.find((e) => e.id === value)

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 cursor-pointer",
            selected ? "border-primary/30 bg-background hover:border-primary/50" : "border-border bg-background hover:border-muted-foreground/40",
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selected ? (
              <>
                <span className="font-medium text-foreground truncate">{selected.name}</span>
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.12)" }}
                >
                  {CATEGORY_LABELS[selected.category]}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDownIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {open && (
        <ExercisePickerSheet
          exercises={exercises}
          value={value}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// ─── Sheet: buscador + filtros + tarjetas, siempre a pantalla completa ─────────

function ExercisePickerSheet({ exercises, value, onSelect, onClose }: {
  exercises: PickerExercise[]
  value: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const closing = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const finder = useExerciseFinder(exercises)
  const results = finder.results

  // Igual que la ficha de ejercicio: el botón "atrás" del teléfono cierra la hoja
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    window.history.pushState({ ...window.history.state, exercisePicker: true }, "")

    function onPopState() {
      if (closing.current) return
      closing.current = true
      setVisible(false)
      setTimeout(() => onCloseRef.current(), 250)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  function close() {
    if (!closing.current) window.history.back()
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, PickerExercise[]>>((acc, cat) => {
    const items = results.filter((e) => e.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  if (typeof document === "undefined") return null

  return createPortal(
    <>
      <div
        onClick={close}
        className={cn("fixed inset-0 z-40 bg-black/50 transition-opacity duration-250", visible ? "opacity-100" : "opacity-0")}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Agregar ejercicio"
        className={cn(
          "fixed z-50 bg-background flex flex-col",
          // Móvil: hoja desde abajo, casi toda la pantalla
          "bottom-0 left-0 right-0 rounded-t-2xl max-h-[92dvh]",
          // Desktop: panel lateral, no depende de dónde esté el botón que lo abrió
          "md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[520px] md:rounded-none md:rounded-l-2xl md:max-h-full md:h-full",
          "transition-transform duration-250 ease-out",
          visible ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
        )}
      >
        {/* Drag handle (mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <p className="flex-1 text-base font-semibold">Agregar ejercicio</p>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        {/* Sin padding-top: el buscador es sticky y trae su propio padding; darle
           uno extra aquí deja una franja sin cubrir por donde asoma el contenido
           que se desplaza detrás (justo antes de que el buscador quede fijo). */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-3 space-y-5">
          <ExerciseFinderBar finder={finder} placeholder="Busca por nombre, músculo o equipo…" />

          {results.length === 0 ? (
            <FinderEmptyResults finder={finder} />
          ) : (
            CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
              <section key={cat} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[cat]} <span className="tabular-nums">· {grouped[cat].length}</span>
                </h3>
                <div className="space-y-1.5">
                  {grouped[cat].map((ex) => (
                    <PickerExerciseCard key={ex.id} exercise={ex} selected={ex.id === value} onSelect={() => onSelect(ex.id)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

// ─── Tarjeta de ejercicio (miniatura + etiquetas), igual espíritu que Mis ejercicios ──

function PickerExerciseCard({ exercise: ex, selected, onSelect }: {
  exercise: PickerExercise
  selected: boolean
  onSelect: () => void
}) {
  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left overflow-hidden border rounded-xl transition-colors cursor-pointer",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-border/80 hover:bg-muted/10",
      )}
    >
      <div className="flex">
        <div className={cn("w-1 shrink-0", zoneConf?.bar ?? "bg-border")} />
        {ex.youtubeVideoId ? (
          <YouTubeThumb
            videoId={ex.youtubeVideoId}
            alt={ex.name}
            orientation={ex.videoOrientation}
            className="w-24 sm:w-28 aspect-video shrink-0 self-center ml-3 rounded-lg"
          />
        ) : (
          <div className="w-24 sm:w-28 aspect-video shrink-0 self-center ml-3 rounded-lg bg-muted/40" />
        )}
        <div className="flex-1 min-w-0 px-4 py-3">
          <p className="text-sm font-medium leading-snug truncate">{ex.name}</p>
          {(primaryMuscles.length > 0 || ex.movementPatterns.length > 0 || ex.difficulty) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {zoneConf && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", zoneConf.pill)}>{zoneConf.label}</span>
              )}
              {primaryMuscles.slice(0, 2).map((m) => (
                <span key={m.muscleName} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">{m.muscleName}</span>
              ))}
              {primaryMuscles.length > 2 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">+{primaryMuscles.length - 2}</span>
              )}
              {ex.difficulty && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", DIFFICULTY_CONFIG[ex.difficulty].pill)}>
                  {DIFFICULTY_CONFIG[ex.difficulty].label}
                </span>
              )}
              {ex.movementPatterns.slice(0, 2).map((p) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">{PATTERN_LABELS[p] ?? p}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
