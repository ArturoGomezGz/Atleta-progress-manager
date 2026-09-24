"use client"

import { cn } from "@/lib/utils"
import { deriveBodyZone } from "@/lib/body-zones"
import { CheckIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

// Buscador de ejercicios compartido por "Mis ejercicios" y "Explorar":
// barra de texto siempre visible + botón "Filtros" que abre un panel con Movimiento, Nivel y Equipo.
// Todo se filtra en el cliente (la lista completa ya está en memoria).

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FinderExercise = {
  id: string
  name: string
  description: string | null
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  equipment: { equipmentId: string; equipmentName: string }[]
  muscles: { muscleName: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core"; role: string }[]
}

export type FacetKey = "patterns" | "difficulties" | "equipment"

export type ExerciseFilters = {
  query: string
  patterns: string[]
  difficulties: string[]
  equipment: string[]   // equipmentId | NO_EQUIPMENT_KEY
}

export const EMPTY_FILTERS: ExerciseFilters = { query: "", patterns: [], difficulties: [], equipment: [] }

type FacetOption = { key: string; label: string; count: number; selected: boolean; disabled: boolean }
type Facets = Record<FacetKey, FacetOption[]>
type EmptySuggestion = { label: string; count: number; onApply: () => void }

const FACETS: FacetKey[] = ["patterns", "difficulties", "equipment"]
const FACET_LABELS: Record<FacetKey, string> = { patterns: "Movimiento", difficulties: "Nivel", equipment: "Equipo" }

const PATTERN_LABELS: Record<string, string> = {
  push: "Empuje", pull: "Jalón", squat: "Sentadilla", hinge: "Bisagra",
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad", core: "Core",
}
// De lo general a lo particular; el orden no cambia al filtrar para que las opciones no salten
const PATTERN_ORDER = ["push", "pull", "squat", "hinge", "core", "rotation", "isometric", "carry", "mobility"]
const DIFFICULTY_LABELS = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" } as const
const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"] as const
const ZONE_LABELS = { upper: "Superior", lower: "Inferior", core: "Core", full_body: "Full body" } as const

const NO_EQUIPMENT_KEY = "none"
const NO_EQUIPMENT_NAMES = new Set(["sin equipo", "suelo", "peso corporal", "ninguno"])

// Los nombres del catálogo están en inglés: "flexion" debe encontrar "Push Ups"
const SEARCH_SYNONYMS: Record<string, string[]> = {
  flexion: ["push up", "pushup"],
  lagartija: ["push up", "pushup"],
  dominada: ["pull up", "pullup", "chin up"],
  fondo: ["dip"],
  sentadilla: ["squat", "pistol"],
  zancada: ["lunge"],
  plancha: ["plank", "planche"],
  puente: ["bridge"],
  remo: ["row"],
  pino: ["handstand"],
  vertical: ["handstand"],
  elevacion: ["raise"],
  colgado: ["hang"],
}

// ── Filtrado ──────────────────────────────────────────────────────────────────
// Texto AND movimiento AND nivel AND equipo; dentro de cada faceta basta con una opción (OR).

function normalizeText(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[-_]/g, " ")
}

function isNoEquipment(ex: FinderExercise) {
  return ex.equipment.length === 0 || ex.equipment.every((e) => NO_EQUIPMENT_NAMES.has(normalizeText(e.equipmentName)))
}

function buildSearchText(ex: FinderExercise) {
  const zone = deriveBodyZone(ex.muscles)
  return normalizeText([
    ex.name,
    ex.description ?? "",
    ...ex.movementPatterns.map((p) => PATTERN_LABELS[p] ?? p),
    ex.difficulty ? DIFFICULTY_LABELS[ex.difficulty] : "",
    ...ex.equipment.map((e) => e.equipmentName),
    ...ex.muscles.flatMap((m) => [m.muscleName, m.muscleGroupName]),
    zone ? ZONE_LABELS[zone] : "",
    isNoEquipment(ex) ? "sin equipo peso corporal" : "",
  ].join(" "))
}

function matchesQuery(searchText: string, query: string) {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean)
  return tokens.every((token) => {
    // Si lo escrito es el inicio de una palabra con sinónimos ("flex" → flexión), se exige el
    // sinónimo ("push up") o la palabra completa; así "flex" no coincide con "Flexores del antebrazo"
    const synonymEntries = Object.entries(SEARCH_SYNONYMS).filter(([word]) => word.startsWith(token))
    if (synonymEntries.length > 0) {
      const wholeWord = new RegExp(`(^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(searchText)
      return wholeWord || synonymEntries.some(([word, synonyms]) =>
        searchText.includes(word) || synonyms.some((s) => searchText.includes(s)),
      )
    }
    return searchText.includes(token)
  })
}

function matchesFacet(ex: FinderExercise, facet: FacetKey, keys: string[]) {
  if (keys.length === 0) return true
  switch (facet) {
    case "patterns":     return keys.some((k) => ex.movementPatterns.includes(k))
    case "difficulties": return keys.some((k) => ex.difficulty === k)
    case "equipment":    return keys.some((k) => k === NO_EQUIPMENT_KEY ? isNoEquipment(ex) : ex.equipment.some((e) => e.equipmentId === k))
  }
}

function applyFilters<T extends FinderExercise>(pool: T[], filters: ExerciseFilters, index: Map<string, string>, except?: FacetKey) {
  return pool.filter((ex) =>
    matchesQuery(index.get(ex.id) ?? "", filters.query) &&
    FACETS.every((f) => f === except || matchesFacet(ex, f, filters[f])),
  )
}

/**
 * Opciones de cada faceta con conteos facetados: el número de una opción es cuántos resultados
 * habría si se eligiera, respetando los demás filtros. Solo aparecen opciones presentes en la
 * colección; las que quedan en 0 por los filtros se muestran atenuadas (salvo si están elegidas).
 */
function buildFacets(pool: FinderExercise[], filters: ExerciseFilters, index: Map<string, string>): Facets {
  function options(facet: FacetKey, candidates: { key: string; label: string }[]): FacetOption[] {
    const base = applyFilters(pool, filters, index, facet)
    return candidates.flatMap(({ key, label }) => {
      const selected = filters[facet].includes(key)
      if (!selected && !pool.some((ex) => matchesFacet(ex, facet, [key]))) return []
      const count = base.filter((ex) => matchesFacet(ex, facet, [key])).length
      return [{ key, label, count, selected, disabled: count === 0 && !selected }]
    })
  }

  const equipmentUsage = new Map<string, { label: string; uses: number }>()
  for (const ex of pool) {
    for (const e of ex.equipment) {
      if (NO_EQUIPMENT_NAMES.has(normalizeText(e.equipmentName))) continue
      const entry = equipmentUsage.get(e.equipmentId) ?? { label: e.equipmentName, uses: 0 }
      entry.uses++
      equipmentUsage.set(e.equipmentId, entry)
    }
  }

  return {
    patterns: options("patterns", PATTERN_ORDER.map((p) => ({ key: p, label: PATTERN_LABELS[p] ?? p }))),
    difficulties: options("difficulties", DIFFICULTY_ORDER.map((d) => ({ key: d, label: DIFFICULTY_LABELS[d] }))),
    equipment: options("equipment", [
      { key: NO_EQUIPMENT_KEY, label: "Sin equipo" },
      ...[...equipmentUsage.entries()]
        .sort(([, a], [, b]) => b.uses - a.uses || a.label.localeCompare(b.label, "es"))
        .map(([key, { label }]) => ({ key, label })),
    ]),
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExerciseFinder<T extends FinderExercise>(pool: T[]) {
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS)

  const index = new Map(pool.map((ex) => [ex.id, buildSearchText(ex)]))
  const results = applyFilters(pool, filters, index)
  const facets = buildFacets(pool, filters, index)
  const activeFilterCount = FACETS.reduce((n, f) => n + filters[f].length, 0)

  // Estado vacío: qué pasaría quitando cada filtro activo
  const emptySuggestions: EmptySuggestion[] = results.length > 0 ? [] : [
    ...(filters.query.trim() ? [{
      label: "Borrar búsqueda",
      count: applyFilters(pool, { ...filters, query: "" }, index).length,
      onApply: () => setFilters((f) => ({ ...f, query: "" })),
    }] : []),
    ...FACETS.flatMap((facet) =>
      filters[facet].map((key) => {
        const next = { ...filters, [facet]: filters[facet].filter((k) => k !== key) }
        return {
          label: `Quitar «${facets[facet].find((o) => o.key === key)?.label ?? key}»`,
          count: applyFilters(pool, next, index).length,
          onApply: () => setFilters(next),
        }
      }),
    ),
  ].filter((s) => s.count > 0)

  return {
    filters,
    results,
    facets,
    activeFilterCount,
    emptySuggestions,
    totalCount: pool.length,
    setQuery: (query: string) => setFilters((f) => ({ ...f, query })),
    toggle: (facet: FacetKey, key: string) =>
      setFilters((f) => ({ ...f, [facet]: f[facet].includes(key) ? f[facet].filter((k) => k !== key) : [...f[facet], key] })),
    clearFacets: () => setFilters((f) => ({ ...EMPTY_FILTERS, query: f.query })),
    clearAll: () => setFilters(EMPTY_FILTERS),
  }
}

export type ExerciseFinderState = ReturnType<typeof useExerciseFinder<FinderExercise>>

// ── Barra: buscador + botón Filtros ───────────────────────────────────────────

/**
 * Buscador fijo al hacer scroll con el botón de filtros al lado. Altura constante:
 * elegir filtros no cambia nada debajo, así la lista no salta.
 * Debe vivir dentro del contenedor con scroll de la app (<main>, que ya reserva la barra superior).
 */
export function ExerciseFinderBar({ finder, placeholder = "Busca por nombre, músculo o equipo…" }: {
  finder: ExerciseFinderState
  placeholder?: string
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const active = finder.activeFilterCount

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              enterKeyHint="search"
              value={finder.filters.query}
              onChange={(e) => finder.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") finder.setQuery("")
              }}
              placeholder={placeholder}
              aria-label="Buscar ejercicios"
              // text-base (16px) evita el zoom automático de iOS al enfocar
              className="w-full h-12 pl-10 pr-11 text-base border border-border rounded-xl bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
            />
            {finder.filters.query && (
              <button
                type="button"
                onClick={() => finder.setQuery("")}
                aria-label="Borrar búsqueda"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            aria-label={active > 0 ? `Filtros, ${active} activos` : "Filtros"}
            className={cn(
              "relative shrink-0 h-12 px-3.5 sm:px-4 flex items-center gap-2 rounded-xl border text-sm font-medium cursor-pointer transition-colors",
              active > 0 ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50",
            )}
          >
            <SlidersHorizontalIcon className="w-4 h-4" />
            <span>Filtros</span>
            {/* Contador superpuesto: no cambia el ancho del botón */}
            {active > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums flex items-center justify-center">
                {active}
              </span>
            )}
          </button>
        </div>
      </div>

      {filtersOpen && <FilterSheet finder={finder} onClose={() => setFiltersOpen(false)} />}
    </>
  )
}

// ── Panel de filtros ──────────────────────────────────────────────────────────

function FilterSheet({ finder, onClose }: { finder: ExerciseFinderState; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const closing = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Igual que la ficha de ejercicio: el botón "atrás" del teléfono cierra el panel
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    window.history.pushState({ ...window.history.state, exerciseFilters: true }, "")

    // Si esta hoja no es la que se acaba de cerrar (su propia marca sigue presente en
    // el estado actual), el "atrás" era de una capa por debajo y no toca esta hoja.
    function onPopState(e: PopStateEvent) {
      if (closing.current || e.state?.exerciseFilters) return
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

  const count = finder.results.length
  const visibleFacets = FACETS.filter((facet) => {
    const options = finder.facets[facet]
    // Con menos de dos opciones la faceta no ayuda a decidir (p. ej. un coach con 3 ejercicios)
    return options.length >= 2 || options.some((o) => o.selected)
  })

  if (typeof document === "undefined") return null

  // Portal al body: si este panel quedara anidado dentro del wrapper animado del picker
  // de ejercicios (que tiene su propio transform + overflow-y-auto), ese ancestro pasaría
  // a ser el containing block de este "fixed" y el overflow lo recortaría, dejando un hueco
  // abajo por el que se ven las tarjetas de ejercicios detrás. Portalear evita ese anidado.
  return createPortal(
    <>
      <div
        onClick={close}
        className={cn("fixed inset-0 z-40 bg-black/50 transition-opacity duration-250", visible ? "opacity-100" : "opacity-0")}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className={cn(
          "fixed z-50 bg-background flex flex-col",
          "bottom-0 left-0 right-0 rounded-t-2xl max-h-[85dvh]",
          "md:top-0 md:left-auto md:w-[420px] md:max-h-full md:rounded-none md:rounded-l-2xl",
          "transition-transform duration-250 ease-out",
          visible ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <p className="flex-1 text-base font-semibold">Filtros</p>
          {finder.activeFilterCount > 0 && (
            <button
              type="button"
              onClick={finder.clearFacets}
              className="h-11 px-3 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar filtros"
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          {visibleFacets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay filtros para esta lista.</p>
          ) : visibleFacets.map((facet) => (
            <section key={facet} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{FACET_LABELS[facet]}</h3>
              <div role="group" aria-label={FACET_LABELS[facet]} className="flex flex-wrap gap-2">
                {finder.facets[facet].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={o.selected}
                    aria-disabled={o.disabled}
                    onClick={() => !o.disabled && finder.toggle(facet, o.key)}
                    className={cn(
                      "flex items-center gap-1.5 h-11 px-4 rounded-full border text-sm transition-colors",
                      o.selected
                        ? "bg-primary/10 border-primary text-primary font-medium cursor-pointer"
                        : o.disabled
                          ? "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                          : "border-border text-foreground hover:border-primary/50 cursor-pointer",
                    )}
                  >
                    {/* Hueco fijo para el check y ancho fijo del conteo: el chip no cambia de tamaño */}
                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center" aria-hidden="true">
                      {o.selected && <CheckIcon className="w-3.5 h-3.5" />}
                    </span>
                    {o.label}
                    <span className={cn("text-xs tabular-nums min-w-[3ch] text-right", o.selected ? "text-primary/80" : "text-muted-foreground")}>
                      {o.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={close}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-base font-semibold cursor-pointer disabled:opacity-50"
          >
            {count === 0 ? "Sin resultados" : `Ver ${count} ${count === 1 ? "ejercicio" : "ejercicios"}`}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

export function FinderEmptyResults({ finder }: { finder: ExerciseFinderState }) {
  return (
    <div className="text-center py-10 px-4 space-y-4 border border-dashed border-border rounded-2xl">
      <div className="space-y-1">
        <p className="text-base font-medium">No encontramos ejercicios así</p>
        {finder.emptySuggestions.length > 0 && <p className="text-sm text-muted-foreground">Prueba quitando algún filtro:</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {finder.emptySuggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onApply}
            className="h-11 px-4 rounded-full border border-border text-sm hover:border-primary/50 cursor-pointer"
          >
            {s.label} <span className="text-muted-foreground">(ver {s.count})</span>
          </button>
        ))}
        <button
          type="button"
          onClick={finder.clearAll}
          className="h-11 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium cursor-pointer"
        >
          Limpiar todo
        </button>
      </div>
    </div>
  )
}
