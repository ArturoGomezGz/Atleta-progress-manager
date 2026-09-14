import { isShortsUrl, parseYoutubeId, youtubeThumbnail, youtubeWatchUrl, type VideoOrientation } from "@atleta/db/youtube"

export type YoutubeResolution =
  | { ok: false; reason: "invalid_url" | "not_found" | "not_embeddable" }
  | {
      ok: true
      videoId: string
      title: string | null
      authorName: string | null
      thumbnailUrl: string
      orientation: VideoOrientation
      // false si no se pudo contactar a YouTube; el video se acepta igual y el coach puede corregir
      verified: boolean
    }

const TIMEOUT_MS = 6000

async function fetchOembed(id: string) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(id))}`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 401 || res.status === 403) return "not_embeddable" as const
  if (res.status === 400 || res.status === 404) return "not_found" as const
  if (!res.ok) throw new Error(`oEmbed ${res.status}`)
  return (await res.json()) as { title?: string; author_name?: string }
}

/**
 * YouTube responde 200 en /shorts/{id} si el video es un Short y redirige (303) a /watch si no lo es.
 * No es una API oficial: ante cualquier duda se asume horizontal y el coach puede cambiarlo.
 */
async function detectOrientation(id: string): Promise<VideoOrientation> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.status === 200 ? "vertical" : "horizontal"
  } catch {
    return "horizontal"
  }
}

export async function resolveYoutube(input: string): Promise<YoutubeResolution> {
  const videoId = parseYoutubeId(input)
  if (!videoId) return { ok: false, reason: "invalid_url" }

  const orientationPromise = isShortsUrl(input) ? Promise.resolve<VideoOrientation>("vertical") : detectOrientation(videoId)

  try {
    const oembed = await fetchOembed(videoId)
    if (typeof oembed === "string") return { ok: false, reason: oembed }
    return {
      ok: true,
      videoId,
      title: oembed.title ?? null,
      authorName: oembed.author_name ?? null,
      thumbnailUrl: youtubeThumbnail(videoId),
      orientation: await orientationPromise,
      verified: true,
    }
  } catch {
    return {
      ok: true,
      videoId,
      title: null,
      authorName: null,
      thumbnailUrl: youtubeThumbnail(videoId),
      orientation: await orientationPromise,
      verified: false,
    }
  }
}
