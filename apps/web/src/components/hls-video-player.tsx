"use client"

import { cn } from "@/lib/utils"
import { PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const SPEEDS = [0.5, 1, 2]
const HIDE_DELAY_MS = 3000

export function HlsVideoPlayer({
  videoId,
  className,
}: {
  videoId: string
  className?: string
}) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [ready,           setReady]           = useState(false)
  const [playing,         setPlaying]         = useState(false)
  const [loop,            setLoop]            = useState(false)
  const [speed,           setSpeed]           = useState(1)
  const [progress,        setProgress]        = useState(0)
  const [currentTime,     setCurrentTime]     = useState(0)
  const [duration,        setDuration]        = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [tapFlash,        setTapFlash]        = useState<"play" | "pause" | null>(null)

  const src = `https://videodelivery.net/${videoId}/manifest/video.m3u8`

  // ── Mostrar controles y arrancar el timer para ocultarlos ──────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false)
    }, HIDE_DELAY_MS)
  }, [])

  // ── Inicializar HLS ────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src
      setReady(true)
      return
    }

    let hls: import("hls.js").default | null = null
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return
      hls = new Hls({ startLevel: -1 })
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true))
    })

    return () => {
      hls?.destroy()
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [src])

  // ── Escuchar eventos del video ─────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready) return

    const onPlay            = () => { setPlaying(true); showControls() }
    const onPause           = () => { setPlaying(false); setControlsVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current) }
    const onTimeUpdate      = () => { setCurrentTime(video.currentTime); if (video.duration) setProgress((video.currentTime / video.duration) * 100) }
    const onLoadedMetadata  = () => setDuration(video.duration)

    video.addEventListener("play",            onPlay)
    video.addEventListener("pause",           onPause)
    video.addEventListener("timeupdate",      onTimeUpdate)
    video.addEventListener("loadedmetadata",  onLoadedMetadata)

    return () => {
      video.removeEventListener("play",           onPlay)
      video.removeEventListener("pause",          onPause)
      video.removeEventListener("timeupdate",     onTimeUpdate)
      video.removeEventListener("loadedmetadata", onLoadedMetadata)
    }
  }, [ready, showControls])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleTap() {
    const video = videoRef.current
    if (!video) return
    showControls()
    if (video.paused) {
      video.play()
      setTapFlash("play")
    } else {
      video.pause()
      setTapFlash("pause")
    }
    setTimeout(() => setTapFlash(null), 500)
  }

  function handleSpeed(s: number) {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
    showControls()
  }

  function handleLoop() {
    const next = !loop
    setLoop(next)
    if (videoRef.current) videoRef.current.loop = next
    showControls()
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current
    if (!video?.duration) return
    video.currentTime = (Number(e.target.value) / 100) * video.duration
    showControls()
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn("relative bg-black overflow-hidden select-none", className)}>

      {/* Spinner de carga */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        playsInline
        loop={loop}
        className="w-full h-full"
        style={{ opacity: ready ? 1 : 0 }}
      />

      {/* Área de tap — cubre todo el video */}
      <div className="absolute inset-0 z-10" onClick={handleTap} />

      {/* Flash central al tocar */}
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

      {/* Controles — auto-ocultar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Gradiente de fondo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-5 pt-10 space-y-2">

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

          {/* Fila inferior: tiempo | velocidad + loop */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 tabular-nums">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); handleSpeed(s) }}
                  className={cn(
                    "text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors",
                    speed === s
                      ? "bg-primary text-black"
                      : "text-white/50 hover:text-white",
                  )}
                  style={{ fontFamily: "var(--font-barlow-condensed)" }}
                >
                  {s}×
                </button>
              ))}

              <button
                onClick={(e) => { e.stopPropagation(); handleLoop() }}
                aria-label="Repetir"
                className={cn(
                  "p-1.5 rounded-lg cursor-pointer transition-colors ml-1",
                  loop ? "text-primary" : "text-white/40 hover:text-white",
                )}
              >
                <RotateCwIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
