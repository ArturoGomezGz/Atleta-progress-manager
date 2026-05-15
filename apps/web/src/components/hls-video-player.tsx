"use client"

import { useEffect, useRef, useState } from "react"

export function HlsVideoPlayer({
  videoId,
  className,
}: {
  videoId: string
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const src = `https://videodelivery.net/${videoId}/manifest/video.m3u8`

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Safari / iOS — HLS nativo
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src
      setReady(true)
      return
    }

    // Chrome / Firefox / Android — hls.js
    let hlsInstance: import("hls.js").default | null = null

    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return
      hlsInstance = new Hls({ startLevel: -1 })
      hlsInstance.loadSource(src)
      hlsInstance.attachMedia(video)
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => setReady(true))
    })

    return () => {
      hlsInstance?.destroy()
    }
  }, [src])

  return (
    <div className={`relative bg-black ${className ?? ""}`}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full h-full"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.2s" }}
      />
    </div>
  )
}
