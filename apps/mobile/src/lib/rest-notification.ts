// Cuenta regresiva del descanso fuera de la app (solo Android). Notificación fija
// con cronómetro nativo: el sistema la actualiza solo, sin reenviarla cada segundo.
// Nunca lanza: el entrenamiento no puede fallar por la notificación.
import { colors } from "@/lib/theme"
import { Platform } from "react-native"
import { requireOptionalNativeModule } from "expo"

type RestCountdownNative = {
  show(endAt: number, title: string, body: string, color: string): void
  clear(): void
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<RestCountdownNative>("RestCountdown") : null

/** Muestra (o reemplaza) la cuenta regresiva hasta `endAt` (ms epoch). */
export function showRestCountdown(endAt: number, upcomingLabel: string) {
  try {
    native?.show(endAt, "Descanso", `Sigue: ${upcomingLabel}`, colors.primary)
  } catch {}
}

export function clearRestCountdown() {
  try {
    native?.clear()
  } catch {}
}
