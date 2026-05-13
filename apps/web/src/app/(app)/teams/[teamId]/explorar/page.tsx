"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  BookmarkIcon,
  DumbbellIcon,
  FlameIcon,
  SearchIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

// ── Config ────────────────────────────────────────────────────────────────────

const ZONE_FILTERS = [
  { value: undefined, label: "Todos" },
  { value: "upper",   label: "Superior" },
  { value: "lower",   label: "Inferior" },
  { value: "core",    label: "Core" },
] as const

const DIFFICULTY_CONFIG = {
  beginner:     { label: "Principiante", pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  intermediate: { label: "Intermedio",   pill: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  advanced:     { label: "Avanzado",     pill: "bg-red-500/10 text-red-600 border-red-500/20" },
} as const

const ZONE_CONFIG = {
  upper:     { bar: "bg-teal-500",   label: "Superior",  pill: "bg-teal-500/10 text-teal-600 border-teal-500/20",   bg: "from-teal-500/10" },
  lower:     { bar: "bg-red-500",    label: "Inferior",  pill: "bg-red-500/10 text-red-600 border-red-500/20",     bg: "from-red-500/10" },
  core:      { bar: "bg-amber-500",  label: "Core",      pill: "bg-amber-500/10 text-amber-600 border-amber-500/20", bg: "from-amber-500/10" },
  full_body: { bar: "bg-violet-500", label: "Full body", pill: "bg-violet-500/10 text-violet-600 border-violet-500/20", bg: "from-violet-500/10" },
} as const

const PATTERN_LABELS: Record<string, string> = {
  push: "Empuje", pull: "Jalón", squat: "Sentadilla", hinge: "Bisagra",
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad",
}

function deriveBodyZone(muscles: { bodyZone: "upper" | "lower" | "core"; role: string }[]) {
  const zones = new Set(muscles.filter((m) => m.role === "primary").map((m) => m.bodyZone))
  if (zones.size === 0) return null
  if (zones.size === 1) return [...zones][0] as "upper" | "lower" | "core"
  return "full_body" as const
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PublicExercise = {
  id: string
  name: string
  description: string | null
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  suitableFor: "warmup" | "evaluation" | null
  contraindications: string | null
  videoUrl: string | null | undefined
  isSaved: boolean
  muscles: { muscleId: string; muscleName: string; role: string; muscleGroupId: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core" }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExplorarPage() {
  const [query, setQuery] = useState("")
  const [bodyZone, setBodyZone] = useState<"upper" | "lower" | "core" | undefined>(undefined)
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced" | undefined>(undefined)
  const [selected, setSelected] = useState<PublicExercise | null>(null)

  const { data: exercises, isLoading, refetch } = trpc.exercises.listPublic.useQuery({
    query: query || undefined,
    bodyZone,
    difficulty,
  })

  const saveMutation = trpc.exercises.saveExercise.useMutation({ onSuccess: () => refetch() })
  const unsaveMutation = trpc.exercises.unsaveExercise.useMutation({ onSuccess: () => refetch() })

  function toggleSave(exerciseId: string, isSaved: boolean) {
    if (isSaved) unsaveMutation.mutate({ exerciseId })
    else saveMutation.mutate({ exerciseId })
  }

  // Keep selected exercise in sync with refetched data
  useEffect(() => {
    if (selected && exercises) {
      const updated = exercises.find((e) => e.id === selected.id)
      if (updated) setSelected(updated as PublicExercise)
    }
  }, [exercises])

  const hasFilters = !!query || !!bodyZone || !!difficulty
  const isMutating = saveMutation.isPending || unsaveMutation.isPending

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      <h1 className="text-xl font-semibold">Explorar</h1>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ejercicios..."
          className="w-full pl-10 pr-9 py-2.5 text-sm border border-border rounded-xl bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {ZONE_FILTERS.map((z) => (
            <button key={String(z.value)} type="button" onClick={() => setBodyZone(z.value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer shrink-0",
                bodyZone === z.value ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >{z.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {(["beginner", "intermediate", "advanced"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(difficulty === d ? undefined : d)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer shrink-0",
                difficulty === d ? `${DIFFICULTY_CONFIG[d].pill} font-medium` : "border-border text-muted-foreground hover:text-foreground",
              )}
            >{DIFFICULTY_CONFIG[d].label}</button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-1.5">
          {!exercises?.length ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {hasFilters ? "Sin resultados para ese filtro." : "No hay ejercicios públicos todavía."}
            </p>
          ) : (
            exercises.map((ex) => (
              <ExploreCard
                key={ex.id}
                exercise={ex as PublicExercise}
                onOpen={() => setSelected(ex as PublicExercise)}
                onToggleSave={(e) => { e.stopPropagation(); toggleSave(ex.id, ex.isSaved) }}
                isMutating={isMutating}
              />
            ))
          )}
        </div>
      )}

      {/* Detail sheet */}
      {selected && (
        <ExerciseDetailSheet
          exercise={selected}
          onClose={() => setSelected(null)}
          onToggleSave={() => toggleSave(selected.id, selected.isSaved)}
          isMutating={isMutating}
        />
      )}
    </div>
  )
}

// ── Explore Card ──────────────────────────────────────────────────────────────

function ExploreCard({ exercise: ex, onOpen, onToggleSave, isMutating }: {
  exercise: PublicExercise
  onOpen: () => void
  onToggleSave: (e: React.MouseEvent) => void
  isMutating: boolean
}) {
  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")

  return (
    <div
      onClick={onOpen}
      className="overflow-hidden border border-border rounded-xl hover:border-border/60 hover:bg-muted/10 transition-colors cursor-pointer"
    >
      <div className="flex">
        <div className={cn("w-1 shrink-0", zoneConf?.bar ?? "bg-border")} />
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{ex.name}</p>
              {ex.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.description}</p>}
            </div>
            <button
              onClick={onToggleSave}
              disabled={isMutating}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center",
                ex.isSaved ? "text-primary hover:text-muted-foreground" : "text-muted-foreground hover:text-primary",
              )}
            >
              <BookmarkIcon className={cn("w-4 h-4", ex.isSaved && "fill-current")} />
            </button>
          </div>

          {(primaryMuscles.length > 0 || ex.difficulty || ex.movementPatterns.length > 0 || ex.suitableFor) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {zoneConf && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", zoneConf.pill)}>{zoneConf.label}</span>}
              {primaryMuscles.slice(0, 2).map((m) => (
                <span key={m.muscleId} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">{m.muscleName}</span>
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
              {ex.suitableFor === "warmup" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-600 flex items-center gap-0.5">
                  <FlameIcon className="w-2.5 h-2.5" /> Calentamiento
                </span>
              )}
              {ex.suitableFor === "evaluation" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary flex items-center gap-0.5">
                  <ZapIcon className="w-2.5 h-2.5" /> Evaluación
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Exercise Detail Sheet ─────────────────────────────────────────────────────

function ExerciseDetailSheet({ exercise: ex, onClose, onToggleSave, isMutating }: {
  exercise: PublicExercise
  onClose: () => void
  onToggleSave: () => void
  isMutating: boolean
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() { setVisible(false); setTimeout(onClose, 300) }

  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")
  const secondaryMuscles = ex.muscles.filter((m) => m.role === "secondary")

  // Group muscles by muscle group
  const primaryGroups = groupByMuscleGroup(primaryMuscles)
  const secondaryGroups = groupByMuscleGroup(secondaryMuscles)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Sheet */}
      <div className={cn(
        "fixed z-50 bg-background flex flex-col",
        "bottom-0 left-0 right-0 rounded-t-2xl max-h-[90dvh]",
        "md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[480px] md:rounded-none md:rounded-l-2xl md:max-h-full md:h-full",
        "transition-transform duration-300 ease-out",
        visible ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full md:translate-y-0",
      )}>

        {/* Drag handle (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <p className="text-base font-semibold truncate pr-4">{ex.name}</p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleSave}
              disabled={isMutating}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                ex.isSaved ? "text-primary hover:text-muted-foreground" : "text-muted-foreground hover:text-primary",
              )}
              title={ex.isSaved ? "Quitar de guardados" : "Guardar"}
            >
              <BookmarkIcon className={cn("w-4 h-4", ex.isSaved && "fill-current")} />
            </button>
            <button onClick={close} className="p-2 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Video hero */}
          {ex.videoUrl ? (
            <div className="aspect-video bg-black shrink-0">
              <iframe
                src={`https://iframe.videodelivery.net/${ex.videoUrl}`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : (
            /* Zone color banner when no video */
            zoneConf && (
              <div className={cn("h-2 w-full", zoneConf.bar)} />
            )
          )}

          <div className="px-5 py-5 space-y-5">

            {/* Pills row */}
            <div className="flex flex-wrap gap-1.5">
              {zoneConf && (
                <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", zoneConf.pill)}>{zoneConf.label}</span>
              )}
              {ex.difficulty && (
                <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", DIFFICULTY_CONFIG[ex.difficulty].pill)}>
                  {DIFFICULTY_CONFIG[ex.difficulty].label}
                </span>
              )}
              {ex.movementPatterns.map((p) => (
                <span key={p} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                  {PATTERN_LABELS[p] ?? p}
                </span>
              ))}
              {ex.suitableFor === "warmup" && (
                <span className="text-xs px-2.5 py-1 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-600 flex items-center gap-1">
                  <FlameIcon className="w-3 h-3" /> Calentamiento
                </span>
              )}
              {ex.suitableFor === "evaluation" && (
                <span className="text-xs px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary flex items-center gap-1">
                  <ZapIcon className="w-3 h-3" /> Evaluación
                </span>
              )}
            </div>

            {/* Description */}
            {ex.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{ex.description}</p>
            )}

            {/* Muscles */}
            {ex.muscles.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DumbbellIcon className="w-3.5 h-3.5" /> Músculos
                </h3>

                {primaryGroups.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Primarios</p>
                    <div className="flex flex-wrap gap-1.5">
                      {primaryMuscles.map((m) => (
                        <span key={m.muscleId} className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-foreground font-medium">
                          {m.muscleName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {secondaryMuscles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Secundarios / Estabilizadores</p>
                    <div className="flex flex-wrap gap-1.5">
                      {secondaryMuscles.map((m) => (
                        <span key={m.muscleId} className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/20 text-muted-foreground">
                          {m.muscleName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Equipment */}
            {ex.equipment.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Equipamiento</h3>
                <div className="flex flex-wrap gap-1.5">
                  {ex.equipment.map((e) => (
                    <span key={e.equipmentId} className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/20 text-foreground">
                      {e.equipmentName}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Contraindications */}
            {ex.contraindications && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contraindicaciones</h3>
                <p className="text-sm text-muted-foreground leading-relaxed border border-border rounded-xl px-4 py-3 bg-muted/10">
                  {ex.contraindications}
                </p>
              </section>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByMuscleGroup(muscles: PublicExercise["muscles"]) {
  const map = new Map<string, { groupName: string; muscles: typeof muscles }>()
  for (const m of muscles) {
    const entry = map.get(m.muscleGroupId) ?? { groupName: m.muscleGroupName, muscles: [] }
    entry.muscles.push(m)
    map.set(m.muscleGroupId, entry)
  }
  return [...map.values()]
}
