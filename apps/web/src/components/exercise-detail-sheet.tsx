"use client"

import { YouTubePlayer } from "@/components/youtube-player"
import { cn } from "@/lib/utils"
import { deriveBodyZone, ZONE_CONFIG } from "@/lib/body-zones"
import { BookmarkIcon, DumbbellIcon, FlameIcon, UserIcon, XIcon, ZapIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExerciseDetail = {
  id: string
  name: string
  description: string | null
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  suitableFor: "warmup" | "evaluation" | null
  contraindications: string | null
  youtubeVideoId?: string | null
  videoOrientation?: "horizontal" | "vertical"
  authorName?: string | null
  muscles: {
    muscleId: string
    muscleName: string
    role: string
    muscleGroupId: string
    muscleGroupName: string
    bodyZone: "upper" | "lower" | "core"
  }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  beginner:     { label: "Principiante", pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  intermediate: { label: "Intermedio",   pill: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  advanced:     { label: "Avanzado",     pill: "bg-red-500/10 text-red-600 border-red-500/20" },
} as const

const PATTERN_LABELS: Record<string, string> = {
  push: "Empuje", pull: "Jalón", squat: "Sentadilla", hinge: "Bisagra",
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad", core: "Core",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExerciseDetailSheet({
  exercise: ex,
  onClose,
  // Optional save action — omit to hide the bookmark button
  isSaved,
  onToggleSave,
  isMutating = false,
}: {
  exercise: ExerciseDetail
  onClose: () => void
  isSaved?: boolean
  onToggleSave?: () => void
  isMutating?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const closing = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // La ficha se comporta como una vista propia: al abrirse agrega una entrada al historial,
  // así el botón "atrás" del teléfono la cierra en lugar de salir de la pantalla anterior.
  // Solo se cierra con "atrás" o con la X (no con gestos ni tocando fuera).
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    window.history.pushState({ ...window.history.state, exerciseDetail: true }, "")

    // Igual que en el selector de ejercicios y el panel de filtros: si esta marca
    // sigue presente tras el "atrás", lo que se cerró fue una capa por debajo (no esta
    // ficha), así que no hay que cerrarla también.
    function onPopState(e: PopStateEvent) {
      if (closing.current || e.state?.exerciseDetail) return
      closing.current = true
      setVisible(false)
      setTimeout(() => onCloseRef.current(), 300)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // La X retrocede en el historial: el mismo camino que el botón "atrás", sin entradas huérfanas
  function close() {
    if (closing.current) return
    window.history.back()
  }

  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")
  const secondaryMuscles = ex.muscles.filter((m) => m.role === "secondary")

  return (
    <>
      {/* Backdrop (no cierra al tocar: solo "atrás" o la X) */}
      <div
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0 pr-4">
            <p className="text-base font-semibold truncate">{ex.name}</p>
            {ex.authorName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <UserIcon className="w-3 h-3 shrink-0" />
                {ex.authorName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onToggleSave !== undefined && isSaved !== undefined && (
              <button
                onClick={onToggleSave}
                disabled={isMutating}
                className={cn(
                  "p-2 rounded-lg cursor-pointer transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                  isSaved ? "text-primary hover:text-muted-foreground" : "text-muted-foreground hover:text-primary",
                )}
                title={isSaved ? "Quitar de guardados" : "Guardar"}
              >
                <BookmarkIcon className={cn("w-4 h-4", isSaved && "fill-current")} />
              </button>
            )}
            <button
              onClick={close}
              aria-label="Cerrar"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
        >

          {/* Video hero or zone bar */}
          {ex.youtubeVideoId ? (
            <div className="px-5 pt-5">
              <YouTubePlayer
                videoId={ex.youtubeVideoId}
                title={ex.name}
                orientation={ex.videoOrientation ?? "horizontal"}
              />
            </div>
          ) : zoneConf ? (
            <div className={cn("h-2 w-full", zoneConf.bar)} />
          ) : null}

          <div className="px-5 py-5 space-y-5">

            {/* Pills */}
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
                {primaryMuscles.length > 0 && (
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
