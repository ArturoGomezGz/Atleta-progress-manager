"use client"

import { ExerciseDetailSheet, type ExerciseDetail } from "@/components/exercise-detail-sheet"
import { ExerciseFinderBar, FinderEmptyResults, useExerciseFinder } from "@/components/exercise-finder"
import { YouTubeThumb } from "@/components/youtube-player"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  BookmarkIcon,
  FlameIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

// ── Config ────────────────────────────────────────────────────────────────────

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
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad", core: "Core",
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
  youtubeVideoId: string | null
  videoOrientation: "horizontal" | "vertical"
  isSaved: boolean
  authorName: string | null
  muscles: { muscleId: string; muscleName: string; role: string; muscleGroupId: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core" }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExplorarPage() {
  const [selected, setSelected] = useState<(ExerciseDetail & { isSaved: boolean }) | null>(null)

  // Se trae el catálogo público completo y se filtra en el cliente con el mismo buscador de "Mis ejercicios"
  const { data, isLoading, refetch } = trpc.exercises.listPublic.useQuery({})
  const exercises = (data ?? []) as PublicExercise[]
  const finder = useExerciseFinder(exercises)

  const saveMutation = trpc.exercises.saveExercise.useMutation({ onSuccess: () => refetch() })
  const unsaveMutation = trpc.exercises.unsaveExercise.useMutation({ onSuccess: () => refetch() })

  function toggleSave(exerciseId: string, isSaved: boolean) {
    if (isSaved) unsaveMutation.mutate({ exerciseId })
    else saveMutation.mutate({ exerciseId })
  }

  // Keep selected exercise in sync with refetched data
  useEffect(() => {
    if (selected && data) {
      const updated = data.find((e) => e.id === selected.id)
      if (updated) setSelected(updated as PublicExercise)
    }
  }, [data])

  const isMutating = saveMutation.isPending || unsaveMutation.isPending

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      <h1 className="text-xl font-semibold">Explorar</h1>

      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          No hay ejercicios públicos de otros entrenadores. Los tuyos están en “Mis ejercicios”.
        </p>
      ) : (
        <>
          <ExerciseFinderBar finder={finder} />

          {finder.results.length === 0 ? (
            <FinderEmptyResults finder={finder} />
          ) : (
            <div className="space-y-1.5">
              {finder.results.map((ex) => (
                <ExploreCard
                  key={ex.id}
                  exercise={ex}
                  onOpen={() => setSelected(ex)}
                  onToggleSave={(e) => { e.stopPropagation(); toggleSave(ex.id, ex.isSaved) }}
                  isMutating={isMutating}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      {selected && (
        <ExerciseDetailSheet
          exercise={selected}
          onClose={() => setSelected(null)}
          isSaved={selected.isSaved}
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
        {ex.youtubeVideoId && (
          <YouTubeThumb
            videoId={ex.youtubeVideoId}
            alt={ex.name}
            orientation={ex.videoOrientation}
            showPlay
            className="w-28 sm:w-36 aspect-video shrink-0 self-center ml-3 rounded-lg"
          />
        )}
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{ex.name}</p>
              {ex.authorName && (
                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 mt-0.5">
                  <UserIcon className="w-2.5 h-2.5 shrink-0" />{ex.authorName}
                </p>
              )}
              {ex.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.description}</p>}
            </div>
            <button
              onClick={onToggleSave}
              disabled={isMutating}
              aria-label={ex.isSaved ? `Quitar ${ex.name} de guardados` : `Guardar ${ex.name}`}
              className={cn(
                "rounded-lg cursor-pointer transition-colors shrink-0 w-11 h-11 -mt-2 -mr-2 flex items-center justify-center",
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
