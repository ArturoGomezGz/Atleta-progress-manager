// Sonidos y vibración del ejecutor. Los sonidos se mezclan con la música del
// atleta (no la pausan) y se pueden apagar desde el ejecutor; la preferencia se
// guarda en el teléfono.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio"
import * as Haptics from "expo-haptics"
import * as SecureStore from "expo-secure-store"
import { useSyncExternalStore } from "react"
import { Vibration } from "react-native"

const sources = {
  tick: require("../../assets/sounds/tick.wav"),
  go: require("../../assets/sounds/go.wav"),
  alarm: require("../../assets/sounds/rest_end.wav"),
}
type Sound = keyof typeof sources

let players: Record<Sound, AudioPlayer> | null = null

/** Crea los reproductores una sola vez; se llama al entrar al ejecutor. */
export function prepareSounds() {
  if (players) return
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {})
  players = {
    tick: createAudioPlayer(sources.tick),
    go: createAudioPlayer(sources.go),
    alarm: createAudioPlayer(sources.alarm),
  }
}

function play(sound: Sound) {
  if (!soundOn) return
  const p = players?.[sound]
  if (!p) return
  // Un reproductor que ya terminó no vuelve a sonar sin regresar al inicio
  p.seekTo(0).then(() => p.play()).catch(() => {})
}

// ─── Preferencia de sonido ─────────────────────────────────────────────────────

const SOUND_KEY = "atleta.sound"
let soundOn = true
const listeners = new Set<() => void>()
SecureStore.getItemAsync(SOUND_KEY).then((v) => { if (v === "off") setSoundEnabled(false) }).catch(() => {})

export function setSoundEnabled(on: boolean) {
  soundOn = on
  listeners.forEach((l) => l())
  SecureStore.setItemAsync(SOUND_KEY, on ? "on" : "off").catch(() => {})
}

export function useSoundEnabled() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => soundOn,
  )
}

// ─── Momentos del entrenamiento ────────────────────────────────────────────────

export const feedback = {
  /** Cuenta regresiva: 3, 2, 1… */
  tick() {
    play("tick")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  },
  /** Arranca el tiempo de una serie por tiempo. */
  go() {
    play("go")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
  },
  /** Se acabó el tiempo (descanso o serie por tiempo). */
  timeUp() {
    play("alarm")
    Vibration.vibrate([0, 300, 150, 300])
  },
  /** Serie guardada. */
  setDone() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  },
  tap() {
    Haptics.selectionAsync().catch(() => {})
  },
}
