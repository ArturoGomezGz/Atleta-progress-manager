"use client"

import { YouTubePlayer } from "@/components/youtube-player"
import { cn } from "@/lib/utils"
import {
  BookmarkIcon,
  CheckIcon,
  DumbbellIcon,
  FlameIcon,
  SparklesIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
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

export type ReactionReason =
  | "video_roto" | "video_no_corresponde" | "datos_incorrectos"
  | "duplicado" | "no_me_sirve" | "otro"

export type ExerciseFeedback = {
  reaction: { value: "positive" | "negative"; reason: string | null } | null
  timesUsed: number
  isRecommended: boolean
  onReact: (value: "positive" | "negative", reason?: ReactionReason) => void
  onUnreact: () => void
  isPending?: boolean
}

// ── Config ────────────────────────────────────────────────────────────────────

export const REACTION_REASONS: { value: ReactionReason; label: string }[] = [
  { value: "video_roto",           label: "El video no carga" },
  { value: "video_no_corresponde", label: "El video no es de este ejercicio" },
  { value: "datos_incorrectos",    label: "Los datos están mal" },
  { value: "duplicado",            label: "Está duplicado" },
  { value: "no_me_sirve",          label: "No me sirve" },
  { value: "otro",                 label: "Otro motivo" },
]

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

function deriveBodyZone(muscles: ExerciseDetail["muscles"]) {
  const zones = new Set(muscles.filter((m) => m.role === "primary").map((m) => m.bodyZone))
  if (zones.size === 0) return null
  if (zones.size === 1) return [...zones][0] as "upper" | "lower" | "core"
  return "full_body" as const
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExerciseDetailSheet({
  exercise: ex,
  onClose,
  // Optional save action — omit to hide the bookmark button
  isSaved,
  onToggleSave,
  isMutating = false,
  // Opcional: omitir para ocultar el bloque de retroalimentación
  feedback,
}: {
  exercise: ExerciseDetail
  onClose: () => void
  isSaved?: boolean
  onToggleSave?: () => void
  isMutating?: boolean
  feedback?: ExerciseFeedback
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

    function onPopState() {
      if (closing.current) return
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
              {feedback?.isRecommended && (
                <span className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium flex items-center gap-1">
                  <SparklesIcon className="w-3 h-3" /> Recomendado
                </span>
              )}
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

            {feedback && <FeedbackSection feedback={feedback} />}

          </div>
        </div>
      </div>
    </>
  )
}

// ── Feedback ──────────────────────────────────────────────────────────────────

function FeedbackSection({ feedback }: { feedback: ExerciseFeedback }) {
  const [pickingReason, setPickingReason] = useState(false)
  const { reaction, timesUsed, onReact, onUnreact, isPending } = feedback

  const isPositive = reaction?.value === "positive"
  const isNegative = reaction?.value === "negative"
  const reasonLabel = REACTION_REASONS.find((r) => r.value === reaction?.reason)?.label

  function togglePositive() {
    setPickingReason(false)
    if (isPositive) onUnreact()
    else onReact("positive")
  }

  function toggleNegative() {
    if (isNegative) {
      setPickingReason(false)
      onUnreact()
      return
    }
    // Un voto negativo sin motivo no distingue si falla el ejercicio o el video
    setPickingReason((v) => !v)
  }

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          ¿Te sirvió este ejercicio?
        </h3>
        {timesUsed > 0 && (
          <span className="text-[11px] text-muted-foreground/70 shrink-0">
            {timesUsed === 1 ? "usado 1 vez" : `usado ${timesUsed} veces`}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={togglePositive}
          disabled={isPending}
          aria-pressed={isPositive}
          className={cn(
            "flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border text-sm cursor-pointer transition-colors disabled:opacity-50",
            isPositive
              ? "border-primary/30 bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/20",
          )}
        >
          <ThumbsUpIcon className={cn("w-4 h-4", isPositive && "fill-current")} />
          Me sirve
        </button>
        <button
          onClick={toggleNegative}
          disabled={isPending}
          aria-pressed={isNegative}
          className={cn(
            "flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl border text-sm cursor-pointer transition-colors disabled:opacity-50",
            isNegative
              ? "border-red-500/30 bg-red-500/10 text-red-600 font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/20",
          )}
        >
          <ThumbsDownIcon className={cn("w-4 h-4", isNegative && "fill-current")} />
          Reportar
        </button>
      </div>

      {isNegative && !pickingReason && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Reportado{reasonLabel ? `: ${reasonLabel.toLowerCase()}` : ""}. Gracias.
        </p>
      )}

      {pickingReason && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">¿Qué está mal?</p>
          <div className="flex flex-col gap-1">
            {REACTION_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => { onReact("negative", r.value); setPickingReason(false) }}
                disabled={isPending}
                className="text-left text-sm min-h-[44px] px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20 cursor-pointer transition-colors disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
