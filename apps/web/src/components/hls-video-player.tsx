"use client"

import { cn } from "@/lib/utils"
import { PauseIcon, PlayIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const SPEEDS = [0.5, 1, 2]

export function HlsVideoPlayer({
  videoId,
  className,
}: {
  videoId: string
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [ready,       setReady]       = useState(false)
  const [loadError,   setLoadError]   = useState(false)
  const [speed,       setSpeed]       = useState(1)
  const [progress,    setProgress]    = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [tapFlash,    setTapFlash]    = useState<"play" | "pause" | null>(null)

  const src = `https://videodelivery.net/${videoId}/manifest/video.m3u8`

  // ── Inicializar HLS ────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src
      video.addEventListener("error", () => setLoadError(true), { once: true })
      video.addEventListener("loadedmetadata", () => setReady(true), { once: true })
      return
    }

    let hls: import("hls.js").default | null = null
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return
      hls = new Hls({ startLevel: -1 })
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true))
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setLoadError(true) })
    })

    return () => { hls?.destroy() }
  }, [src])

  // ── Eventos del video ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready) return

    const onTimeUpdate     = () => { setCurrentTime(video.currentTime); if (video.duration) setProgress((video.currentTime / video.duration) * 100) }
    const onLoadedMetadata = () => setDuration(video.duration)

    video.addEventListener("timeupdate",     onTimeUpdate)
    video.addEventListener("loadedmetadata", onLoadedMetadata)

    return () => {
      video.removeEventListener("timeupdate",     onTimeUpdate)
      video.removeEventListener("loadedmetadata", onLoadedMetadata)
    }
  }, [ready])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleTap() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setTapFlash("play") }
    else              { video.pause(); setTapFlash("pause") }
    setTimeout(() => setTapFlash(null), 500)
  }

  function handleSpeed(s: number) {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current
    if (!video?.duration) return
    video.currentTime = (Number(e.target.value) / 100) * video.duration
  }

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn("relative bg-black overflow-hidden select-none", className)}>

      {/* Error: video aún procesándose o no encontrado */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <p className="text-xs text-white/40 text-center px-6 leading-relaxed">
            Video no disponible.<br />Puede que aún esté procesándose —<br />intenta de nuevo en unos segundos.
          </p>
        </div>
      )}

      {/* Spinner */}
      {!ready && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        playsInline
        className="w-full h-full"
        style={{ opacity: ready ? 1 : 0 }}
      />

      {/* Área de tap */}
      <div className="absolute inset-0 z-10" onClick={handleTap} />

      {/* Flash al tocar */}
      {tapFlash && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center animate-in fade-in zoom-in-95 duration-150">
            {tapFlash === "play"
              ? <PlayIcon  className="w-7 h-7 text-white fill-white" />
              : <PauseIcon className="w-7 h-7 text-white fill-white" />
            }
          </div>
        </div>
      )}

      {/* Controles — siempre visibles */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-5 pt-10 space-y-3">

          {/* Barra de progreso */}
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-1 appearance-none rounded-full cursor-pointer accent-amber-400 bg-white/30"
          />

          {/* Tiempo + velocidad */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 tabular-nums">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="flex items-center gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); handleSpeed(s) }}
                  className={cn(
                    "min-w-[48px] py-2 rounded-xl font-bold text-sm cursor-pointer transition-colors",
                    speed === s
                      ? "bg-primary text-black"
                      : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white",
                  )}
                  style={{ fontFamily: "var(--font-barlow-condensed)" }}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
