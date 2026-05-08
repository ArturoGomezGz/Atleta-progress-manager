"use client"

import { ChevronDownIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export type PickerExercise = {
  id: string
  name: string
  category: "team" | "system" | "mine" | "public"
}

const CATEGORY_LABELS: Record<PickerExercise["category"], string> = {
  team: "Del equipo",
  system: "Sistema",
  mine: "Mis ejercicios",
  public: "Públicos",
}

const CATEGORY_ORDER: PickerExercise["category"][] = ["team", "system", "mine", "public"]

type Props = {
  exercises: PickerExercise[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

export function ExercisePicker({ exercises, value, onChange, placeholder = "Seleccionar ejercicio..." }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = exercises.find((e) => e.id === value)

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setSearch("")
      setTimeout(() => searchRef.current?.focus(), 0)
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

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 border border-border rounded-lg shadow-2xl bg-popover overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
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
          <div className="max-h-52 overflow-y-auto">
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
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer flex items-center gap-2
                        ${isSelected
                          ? "text-primary font-semibold"
                          : "text-foreground hover:bg-muted/40"
                        }
                      `}
                    >
                      {isSelected && (
                        <span className="w-1 h-4 rounded-full shrink-0" style={{ background: "hsl(var(--primary))" }} />
                      )}
                      <span className={isSelected ? "" : "pl-3"}>{ex.name}</span>
                    </button>
                  )
                })}
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="px-4 py-5 text-sm text-muted-foreground text-center">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
