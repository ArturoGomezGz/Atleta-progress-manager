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
  // Silencio: solo sirve para tener el audio activo y que la música del atleta baje de volumen
  silence: require("../../assets/sounds/silence.wav"),
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
    silence: createAudioPlayer(sources.silence),
  }
}

// ─── Bajar la música antes de los pitidos ──────────────────────────────────────

const DUCK_MAX_MS = 7000
const DUCK_RELEASE_MS = 1200
let duckTimer: ReturnType<typeof setTimeout> | null = null

function setInterruption(mode: "mixWithOthers" | "duckOthers") {
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: mode, shouldPlayInBackground: false }).catch(() => {})
}

/** Baja el volumen de la música del atleta (la nuestra sigue sonando normal). */
function duckMusic() {
  if (!soundOn || !players) return
  setInterruption("duckOthers")
  players.silence.seekTo(0).then(() => players?.silence.play()).catch(() => {})
  if (duckTimer) clearTimeout(duckTimer)
  duckTimer = setTimeout(restoreMusic, DUCK_MAX_MS)
}

/** Devuelve la música a su volumen. */
function restoreMusic() {
  if (duckTimer) clearTimeout(duckTimer)
  duckTimer = null
  try { players?.silence.pause() } catch { /* ya detenido */ }
  setInterruption("mixWithOthers")
}

/** Con un respiro tras el último pitido, para que no se corte encima de él. */
function restoreMusicSoon() {
  if (!duckTimer) return
  clearTimeout(duckTimer)
  duckTimer = setTimeout(restoreMusic, DUCK_RELEASE_MS)
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
  /** Faltan 5 segundos: baja la música para que se distingan los pitidos que vienen. */
  duck() {
    duckMusic()
  },
  /** Arranca el tiempo de una serie por tiempo. */
  go() {
    play("go")
    restoreMusicSoon()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
  },
  /** Se acabó el tiempo (descanso o serie por tiempo). */
  timeUp() {
    play("alarm")
    restoreMusicSoon()
    Vibration.vibrate([0, 300, 150, 300])
  },
  /** Se terminó la rutina: sonido de arranque y toque suave; la celebración añade el resto. */
  finish() {
    play("go")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  },
  /** Aterriza el día de hoy en la semana. */
  land() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  },
  /** Serie guardada. */
  setDone() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  },
  tap() {
    Haptics.selectionAsync().catch(() => {})
  },
}
