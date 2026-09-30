// Videos de los ejercicios (YouTube), igual que apps/web/src/components/youtube-player.tsx:
// miniatura hasta que el atleta toca, caja fija 16:9 (los Shorts verticales se ven
// con barras a los lados dentro de la misma caja) y controles del propio YouTube.
import { Text } from "@/components/text"
import { colors, radiusLg } from "@/lib/theme"
import type { WorkoutExercise } from "@/lib/workout"
import { youtubeEmbedUrl, youtubeThumbnail } from "@atleta/db/youtube"
import { Play, X } from "lucide-react-native"
import { useEffect, useState } from "react"
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"

// YouTube rechaza los embeds sin Referer (error 153). Para apps pide identificarse
// como https://<id del paquete>; es el origen de la página que contiene el iframe.
const EMBED_ORIGIN = "https://com.atleta.app"

function embedHtml(videoId: string) {
  const src = `${youtubeEmbedUrl(videoId, { autoplay: true })}&origin=${encodeURIComponent(EMBED_ORIGIN)}`
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`
}

export function VideoThumb({ videoId, style, playSize = 36, vertical }: {
  videoId: string
  style?: StyleProp<ViewStyle>
  playSize?: number
  vertical?: boolean
}) {
  const [uri, setUri] = useState(() => youtubeThumbnail(videoId, "hq"))
  useEffect(() => { setUri(youtubeThumbnail(videoId, "hq")) }, [videoId])
  return (
    <View style={[styles.thumb, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setUri(youtubeThumbnail(videoId, "mq"))} />
      {vertical && (
        <View style={styles.verticalTag}><Text size={9} weight="semibold" color="#fff">VERTICAL</Text></View>
      )}
      <View style={styles.playOverlay}>
        <View style={[styles.playDot, { width: playSize, height: playSize, borderRadius: playSize / 2 }]}>
          <Play size={playSize * 0.45} color="#fff" fill="#fff" style={{ marginLeft: playSize * 0.06 }} />
        </View>
      </View>
    </View>
  )
}

/** Reproductor en línea: primero la miniatura, al tocar carga YouTube. */
export function VideoPlayer({ videoId, title, autoStart = false }: { videoId: string; title: string; autoStart?: boolean }) {
  const [started, setStarted] = useState(autoStart)
  const [loading, setLoading] = useState(true)
  useEffect(() => { setStarted(autoStart); setLoading(true) }, [videoId, autoStart])

  return (
    <View style={styles.player}>
      {started ? (
        <>
          <WebView
            source={{ html: embedHtml(videoId), baseUrl: EMBED_ORIGIN }}
            style={styles.webview}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onLoadEnd={() => setLoading(false)}
            // Los enlaces del reproductor (logo, "ver en YouTube") se abren fuera, en la app de YouTube
            onShouldStartLoadWithRequest={(r) => {
              if (r.url.startsWith(EMBED_ORIGIN) || r.url.startsWith("about:")) return true
              Linking.openURL(r.url).catch(() => {})
              return false
            }}
          />
          {loading && <View style={styles.loading}><ActivityIndicator color="#fff" size="large" /></View>}
        </>
      ) : (
        <Pressable onPress={() => setStarted(true)} style={StyleSheet.absoluteFill} accessibilityLabel={`Reproducir video: ${title}`}>
          <Image source={{ uri: youtubeThumbnail(videoId, "hq") }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.25)" }]} />
          <View style={[styles.playOverlay, { gap: 8 }]}>
            <View style={styles.bigPlay}><Play size={36} color="#fff" fill="#fff" style={{ marginLeft: 4 }} /></View>
            <View style={styles.bigPlayLabel}><Text size={17} weight="semibold" color="#fff">Ver video</Text></View>
          </View>
        </Pressable>
      )}
    </View>
  )
}

/** Video a pantalla completa con la descripción del ejercicio ("Ver cómo se hace"). */
export function VideoModal({ exercise, onClose }: { exercise: WorkoutExercise | null; onClose: () => void }) {
  return (
    <Modal visible={!!exercise?.youtubeVideoId} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        <SafeAreaView style={styles.modal}>
          {exercise?.youtubeVideoId && (
            <>
              <View style={styles.modalHeader}>
                <Text size={18} weight="semibold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>{exercise.exerciseName}</Text>
                <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                  <X size={20} color="#fff" />
                  <Text size={16} weight="semibold" color="#fff">Cerrar</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                <VideoPlayer videoId={exercise.youtubeVideoId} title={exercise.exerciseName} autoStart />
                {exercise.description && <Text size={16} color="rgba(255,255,255,0.8)">{exercise.description}</Text>}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  thumb: { overflow: "hidden", backgroundColor: colors.muted, borderRadius: 12, aspectRatio: 16 / 9 },
  verticalTag: { position: "absolute", top: 4, left: 4, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  playOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  playDot: { backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  player: { width: "100%", aspectRatio: 16 / 9, borderRadius: radiusLg, overflow: "hidden", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  bigPlay: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" },
  bigPlayLabel: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.97)" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
})
