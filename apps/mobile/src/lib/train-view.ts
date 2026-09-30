// Preferencia de la vista de entrenamiento: "split" (video y objetivo al 50-50, por
// defecto) o "button" (solo el objetivo; el video se ve a demanda). Se guarda en el
// teléfono igual que la preferencia de sonido: no pasa por la API.
import * as SecureStore from "expo-secure-store"
import { useSyncExternalStore } from "react"

export type TrainView = "split" | "button"

const KEY = "atleta.trainView"
let view: TrainView = "split"
const listeners = new Set<() => void>()
SecureStore.getItemAsync(KEY).then((v) => { if (v === "button") setTrainView("button") }).catch(() => {})

export function setTrainView(next: TrainView) {
  view = next
  listeners.forEach((l) => l())
  SecureStore.setItemAsync(KEY, next).catch(() => {})
}

export function useTrainView() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => view,
  )
}
