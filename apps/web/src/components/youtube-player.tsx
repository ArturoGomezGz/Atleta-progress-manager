"use client"

import { cn } from "@/lib/utils"
import { youtubeEmbedUrl, youtubeThumbnail, youtubeWatchUrl, type VideoOrientation } from "@atleta/db/youtube"
import { ExternalLinkIcon, MaximizeIcon, MinimizeIcon, PlayIcon, Repeat2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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
 * - Pantalla completa real (con bloqueo de orientación cuando el navegador lo permite).
 * - Modo "repetir" para ver la técnica en bucle.
 */
export function YouTubePlayer({
  videoId,
  title,
  orientation = "horizontal",
  autoStart = false,
  toolbar = true,
  large = false,
  compact = false,
  className,
}: {
  videoId: string
  title: string
  orientation?: VideoOrientation
  autoStart?: boolean
  toolbar?: boolean
  /** Botones y textos más grandes (vista del atleta) */
  large?: boolean
  /** Limita la altura de los videos verticales para que quepan junto a otro contenido */
  compact?: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(autoStart)
  const [loop, setLoop] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => { setStarted(autoStart) }, [videoId, autoStart])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  async function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    setStarted(true)
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
      return
    }
    if (!el.requestFullscreen) {
      // iPhone Safari no permite fullscreen de un div: se abre YouTube, que sí lo gestiona
      window.open(youtubeWatchUrl(videoId), "_blank", "noopener")
      return
    }
    await el.requestFullscreen().catch(() => {})
    const lock = (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock
    await lock?.call(screen.orientation, orientation === "vertical" ? "portrait" : "landscape").catch(() => {})
  }

  const isVertical = orientation === "vertical"

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className={cn(
          "relative bg-black overflow-hidden mx-auto",
          isFullscreen
            ? "w-screen h-screen"
            : isVertical
              ? cn("aspect-[9/16] max-w-full rounded-2xl", compact ? "h-[min(48dvh,440px)]" : "h-[min(70dvh,640px)]")
              : "aspect-video w-full rounded-2xl",
        )}
      >
        {started ? (
          <iframe
            key={`${videoId}-${loop}`}
            src={youtubeEmbedUrl(videoId, { autoplay: true, loop, mute: loop })}
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

        {isFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-3 rounded-full bg-black/70 text-white text-base font-semibold cursor-pointer"
          >
            <MinimizeIcon className="w-5 h-5" /> Salir
          </button>
        )}
      </div>

      {toolbar && (
        <div className={cn("flex flex-wrap items-center gap-2", isVertical && "justify-center")}>
          <ToolbarButton large={large} onClick={toggleFullscreen} icon={<MaximizeIcon />} label="Pantalla completa" />
          <ToolbarButton
            large={large}
            onClick={() => { setLoop((v) => !v); setStarted(true) }}
            icon={<Repeat2Icon />}
            label={loop ? "Repetir: sí" : "Repetir: no"}
            active={loop}
          />
          <a
            href={youtubeWatchUrl(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors",
              large ? "px-4 py-3 text-base" : "px-2.5 py-1.5 text-xs",
            )}
          >
            <ExternalLinkIcon className={large ? "w-5 h-5" : "w-3.5 h-3.5"} />
            YouTube
          </a>
        </div>
      )}
    </div>
  )
}

function ToolbarButton({ onClick, icon, label, active, large }: {
  onClick: () => void
  icon: React.ReactElement<{ className?: string }>
  label: string
  active?: boolean
  large?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border transition-colors cursor-pointer",
        large ? "px-4 py-3 text-base [&_svg]:w-5 [&_svg]:h-5" : "px-2.5 py-1.5 text-xs [&_svg]:w-3.5 [&_svg]:h-3.5",
        active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
