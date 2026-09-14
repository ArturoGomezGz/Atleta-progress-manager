"use client"

import { YouTubeThumb } from "@/components/youtube-player"
import { ChevronDownIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export type PickerExercise = {
  id: string
  name: string
  category: "team" | "system" | "mine" | "saved" | "public"
  youtubeVideoId?: string | null
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

type Props = {
  exercises: PickerExercise[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

const DROPDOWN_MARGIN = 8
const DROPDOWN_PREFERRED_HEIGHT = 320 // igual al max-h-80 original
const DROPDOWN_MIN_HEIGHT = 160

type DropdownCoords = { left: number; width: number; maxHeight: number; top?: number; bottom?: number }

export function ExercisePicker({ exercises, value, onChange, placeholder = "Seleccionar ejercicio..." }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [coords, setCoords] = useState<DropdownCoords | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = exercises.find((e) => e.id === value)

  // Close on outside click (el dropdown vive en un portal, así que se revisan ambos refs)
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  // Posiciona el dropdown (portal en <body>) relativo al trigger, para que nunca
  // quede recortado por un ancestro con overflow-hidden (p. ej. la tarjeta de un circuito).
  // Si el trigger está cerca del borde inferior de la pantalla (plantilla con varios
  // ejercicios ya agregados), no hay espacio para abrir hacia abajo: se abre hacia
  // arriba y se limita la altura al espacio realmente disponible en cualquier caso.
  useEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom - DROPDOWN_MARGIN
      const spaceAbove = rect.top - DROPDOWN_MARGIN
      const openUp = spaceBelow < DROPDOWN_MIN_HEIGHT && spaceAbove > spaceBelow
      const available = openUp ? spaceAbove : spaceBelow
      const maxHeight = Math.max(DROPDOWN_MIN_HEIGHT, Math.min(DROPDOWN_PREFERRED_HEIGHT, available))
      setCoords(openUp
        ? { bottom: viewportHeight - rect.top + 6, left: rect.left, width: rect.width, maxHeight }
        : { top: rect.bottom + 6, left: rect.left, width: rect.width, maxHeight })
    }
    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open])

  // Focus search when opening — skip on touch devices to avoid keyboard pop-up
  useEffect(() => {
    if (open) {
      setSearch("")
      const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)
      if (!isTouch) setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = search
    ? exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

  const grouped = CATEGORY_ORDER.reduce<Record<string, PickerExercise[]>>((acc, cat) => {
    const items = filtered.filter((e) => e.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 cursor-pointer
          ${open
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
            : selected
              ? "border-primary/30 bg-background hover:border-primary/50"
              : "border-border bg-background hover:border-muted-foreground/40"
          }
        `}
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
        <ChevronDownIcon
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown — en un portal para no quedar recortado por contenedores con overflow-hidden */}
      {open && coords && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...(coords.top !== undefined ? { top: coords.top } : { bottom: coords.bottom }),
            left: coords.left,
            width: coords.width,
            maxHeight: coords.maxHeight,
          }}
          className="fixed z-50 flex flex-col border border-border rounded-lg shadow-2xl bg-popover overflow-hidden"
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/20 sticky top-0"
                  style={{ fontFamily: "var(--font-barlow-condensed, 'Barlow Condensed', sans-serif)" }}
                >
                  {CATEGORY_LABELS[cat as PickerExercise["category"]]}
                </div>
                {items.map((ex) => {
                  const isSelected = ex.id === value
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => handleSelect(ex.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150 cursor-pointer flex items-center gap-3
                        ${isSelected
                          ? "text-primary font-semibold bg-primary/5"
                          : "text-foreground hover:bg-muted/40"
                        }
                      `}
                    >
                      {ex.youtubeVideoId ? (
                        <YouTubeThumb videoId={ex.youtubeVideoId} alt="" className="w-16 aspect-video rounded shrink-0" />
                      ) : (
                        <span className="w-16 aspect-video rounded bg-muted/40 shrink-0" />
                      )}
                      <span className="truncate">{ex.name}</span>
                    </button>
                  )
                })}
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="px-4 py-5 text-sm text-muted-foreground text-center">Sin resultados</p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
