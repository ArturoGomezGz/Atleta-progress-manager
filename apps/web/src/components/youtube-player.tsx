"use client"

import { cn } from "@/lib/utils"
import { youtubeEmbedUrl, youtubeThumbnail, type VideoOrientation } from "@atleta/db/youtube"
import { PlayIcon } from "lucide-react"
import { useEffect, useState } from "react"

// ── Miniatura ─────────────────────────────────────────────────────────────────

export function YouTubeThumb({
  videoId,
  alt,
  className,
  showPlay = false,
  orientation = "horizontal",
}: {
  videoId: string
  alt: string
  className?: string
  showPlay?: boolean
  orientation?: VideoOrientation
}) {
  const [src, setSrc] = useState(youtubeThumbnail(videoId, "hq"))
  useEffect(() => { setSrc(youtubeThumbnail(videoId, "hq")) }, [videoId])

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        decoding="async"
        fetchPriority="low"
        onError={() => setSrc(youtubeThumbnail(videoId, "mq"))}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {orientation === "vertical" && (
        <span className="absolute top-1 left-1 text-[9px] font-semibold uppercase tracking-wide bg-black/70 text-white px-1.5 py-0.5 rounded">
          Vertical
        </span>
      )}
      {showPlay && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
            <PlayIcon className="w-4 h-4 text-white fill-white ml-0.5" />
          </span>
        </span>
      )}
    </div>
  )
}

// ── Reproductor ───────────────────────────────────────────────────────────────

/**
 * Reproductor de YouTube pensado para móvil:
 * - Muestra la miniatura hasta que el usuario toca (no carga el iframe antes).
 * - Caja 16:9 para videos normales y 9:16 para Shorts.
 * - Los controles (pantalla completa, etc.) los da el propio reproductor de YouTube.
 */
export function YouTubePlayer({
  videoId,
  title,
  orientation = "horizontal",
  autoStart = false,
  large = false,
  compact = false,
  className,
}: {
  videoId: string
  title: string
  orientation?: VideoOrientation
  autoStart?: boolean
  /** Botón de reproducir más grande (vista del atleta) */
  large?: boolean
  /** Limita la altura de los videos verticales para que quepan junto a otro contenido */
  compact?: boolean
  className?: string
}) {
  const [started, setStarted] = useState(autoStart)

  useEffect(() => { setStarted(autoStart) }, [videoId, autoStart])

  const isVertical = orientation === "vertical"

  return (
    <div
      className={cn(
        "relative bg-black overflow-hidden mx-auto",
        isVertical
          ? cn("aspect-[9/16] max-w-full rounded-2xl", compact ? "h-[min(48dvh,440px)]" : "h-[min(70dvh,640px)]")
          : "aspect-video w-full rounded-2xl",
        className,
      )}
    >
      {started ? (
        <iframe
          src={youtubeEmbedUrl(videoId, { autoplay: true })}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="group absolute inset-0 w-full h-full cursor-pointer"
          aria-label={`Reproducir video: ${title}`}
        >
          <YouTubeThumb videoId={videoId} alt={title} className="absolute inset-0" />
          <span className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className={cn(
              "rounded-full bg-red-600 flex items-center justify-center shadow-xl group-active:scale-95 transition-transform",
              large ? "w-20 h-20" : "w-14 h-14",
            )}>
              <PlayIcon className={cn("text-white fill-white ml-1", large ? "w-9 h-9" : "w-6 h-6")} />
            </span>
            {large && (
              <span className="text-white text-lg font-semibold drop-shadow-md bg-black/50 px-3 py-1 rounded-full">
                Ver video
              </span>
            )}
          </span>
        </button>
      )}
    </div>
  )
}
