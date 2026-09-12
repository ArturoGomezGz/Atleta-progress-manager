// Utilidades de YouTube compartidas entre API y web (sin dependencias de Node).

export type VideoOrientation = "horizontal" | "vertical"

const YOUTUBE_ID_RE =
  /(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/|e\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/

const BARE_ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Extrae el ID de 11 caracteres de cualquier URL de YouTube (o un ID suelto). */
export function parseYoutubeId(input: string): string | null {
  const value = input.trim()
  if (BARE_ID_RE.test(value)) return value
  return value.match(YOUTUBE_ID_RE)?.[1] ?? null
}

/** Una URL /shorts/ es inequívocamente vertical; el resto se decide en servidor. */
export function isShortsUrl(input: string): boolean {
  return /youtube\.com\/shorts\//i.test(input)
}

export function youtubeThumbnail(id: string, quality: "hq" | "maxres" | "mq" = "hq"): string {
  const file = quality === "maxres" ? "maxresdefault" : quality === "mq" ? "mqdefault" : "hqdefault"
  return `https://i.ytimg.com/vi/${id}/${file}.jpg`
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

export function youtubeEmbedUrl(id: string, opts: { autoplay?: boolean; loop?: boolean; mute?: boolean } = {}): string {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    ...(opts.autoplay ? { autoplay: "1" } : {}),
    ...(opts.mute ? { mute: "1" } : {}),
    ...(opts.loop ? { loop: "1", playlist: id } : {}),
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}
