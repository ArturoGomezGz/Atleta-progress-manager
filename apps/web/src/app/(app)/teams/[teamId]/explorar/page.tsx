"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  BookmarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlameIcon,
  GlobeIcon,
  PlayIcon,
  SearchIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
import { useState } from "react"

// ── Config (shared with ejercicios page) ──────────────────────────────────────

const ZONE_FILTERS = [
  { value: undefined,  label: "Todos" },
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
  upper:     { bar: "bg-teal-500",   label: "Superior",  pill: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  lower:     { bar: "bg-red-500",    label: "Inferior",  pill: "bg-red-500/10 text-red-600 border-red-500/20" },
  core:      { bar: "bg-amber-500",  label: "Core",      pill: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  full_body: { bar: "bg-violet-500", label: "Full body", pill: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExplorarPage() {
  const [query, setQuery] = useState("")
  const [bodyZone, setBodyZone] = useState<"upper" | "lower" | "core" | undefined>(undefined)
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced" | undefined>(undefined)

  const { data: exercises, isLoading, refetch } = trpc.exercises.listPublic.useQuery({
    query: query || undefined,
    bodyZone,
    difficulty,
  })

  const saveMutation = trpc.exercises.saveExercise.useMutation({
    onSuccess: () => refetch(),
  })
  const unsaveMutation = trpc.exercises.unsaveExercise.useMutation({
    onSuccess: () => refetch(),
  })

  function toggleSave(exerciseId: string, isSaved: boolean) {
    if (isSaved) unsaveMutation.mutate({ exerciseId })
    else saveMutation.mutate({ exerciseId })
  }

  const hasFilters = !!query || !!bodyZone || !!difficulty

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Explorar</h1>
      </div>

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
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="space-y-2">
        {/* Zone */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {ZONE_FILTERS.map((z) => (
            <button
              key={String(z.value)}
              type="button"
              onClick={() => setBodyZone(z.value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer shrink-0",
                bodyZone === z.value
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Difficulty */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {(["beginner", "intermediate", "advanced"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(difficulty === d ? undefined : d)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer shrink-0",
                difficulty === d
                  ? `${DIFFICULTY_CONFIG[d].pill} font-medium`
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {DIFFICULTY_CONFIG[d].label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
          ))}
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
                exercise={ex}
                isSaved={ex.isSaved}
                onToggleSave={() => toggleSave(ex.id, ex.isSaved)}
                isSaving={saveMutation.isPending || unsaveMutation.isPending}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Explore Card ──────────────────────────────────────────────────────────────

type PublicExercise = {
  id: string
  name: string
  description: string | null
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  suitableFor: "warmup" | "evaluation" | null
  videoUrl: string | null
  isSaved: boolean
  muscles: { muscleId: string; muscleName: string; role: string; muscleGroupId: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core" }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

function ExploreCard({ exercise: ex, isSaved, onToggleSave, isSaving }: {
  exercise: PublicExercise
  isSaved: boolean
  onToggleSave: () => void
  isSaving: boolean
}) {
  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <div className="overflow-hidden border border-border rounded-xl hover:border-border/80 transition-colors">
      <div className="flex hover:bg-muted/10 transition-colors">
        <div className={cn("w-1 shrink-0", zoneConf?.bar ?? "bg-border")} />
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{ex.name}</p>
              {ex.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <GlobeIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <button
                onClick={onToggleSave}
                disabled={isSaving}
                className={cn(
                  "p-1.5 rounded-lg cursor-pointer transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                  isSaved
                    ? "text-primary hover:text-muted-foreground"
                    : "text-muted-foreground hover:text-primary",
                )}
                title={isSaved ? "Quitar de guardados" : "Guardar ejercicio"}
              >
                <BookmarkIcon className={cn("w-4 h-4", isSaved && "fill-current")} />
              </button>
            </div>
          </div>

          {(primaryMuscles.length > 0 || ex.movementPatterns.length > 0 || ex.difficulty || ex.suitableFor || ex.videoUrl) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {zoneConf && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", zoneConf.pill)}>{zoneConf.label}</span>
              )}
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
              {ex.videoUrl && (
                <button
                  onClick={() => setVideoOpen((v) => !v)}
                  className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground flex items-center gap-0.5 cursor-pointer hover:text-foreground transition-colors"
                >
                  <PlayIcon className="w-2.5 h-2.5" /> Video
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {ex.videoUrl && videoOpen && (
        <div className="border-t border-border bg-black aspect-video">
          <iframe
            src={`https://iframe.videodelivery.net/${ex.videoUrl}`}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  )
}
