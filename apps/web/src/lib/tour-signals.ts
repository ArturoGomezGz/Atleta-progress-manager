"use client"

// Datos que las pantallas le avisan al tutorial (docs/onboarding.md): "el editor ya tiene
// ejercicios", "el atleta ya se eligió", "el entrenamiento terminó"... Es un almacén mínimo
// fuera de React: las pantallas escriben sin saber si hay tutorial y el tutorial las lee.
// Si no hay tutorial, escribir una señal no cuesta nada ni hace nada.

import { useEffect, useSyncExternalStore } from "react"

type Value = string | number | boolean | undefined

let signals: Readonly<Record<string, Value>> = {}
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function setSignal(name: string, value: Value) {
  if (signals[name] === value) return
  const next = { ...signals }
  if (value === undefined) delete next[name]
  else next[name] = value
  signals = next
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Todas las señales actuales (snapshot estable mientras no cambien). */
export function useTourSignals() {
  return useSyncExternalStore(subscribe, () => signals, () => signals)
}

export function useTourSignal(name: string) {
  return useSyncExternalStore(subscribe, () => signals[name], () => undefined)
}

/** Publica un valor mientras la pantalla está montada; al desmontar lo retira. */
export function usePublishTourSignal(name: string, value: Value) {
  useEffect(() => {
    setSignal(name, value)
  }, [name, value])
  useEffect(() => () => setSignal(name, undefined), [name])
}
