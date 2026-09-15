// El token de un entrenamiento de invitado es su única credencial mientras no
// hay cuenta: vive en el navegador que lo empezó y nunca viaja por URL ni correo.
// Gracias a eso el invitado puede cerrar la pestaña y retomar donde quedó, y al
// registrarse la pantalla /reclamar lo convierte en una sesión de su cuenta.

const STORAGE_KEY = "atleta.guestWorkout"

export type StoredGuestWorkout = { token: string; code: string }

export function readGuestWorkout(): StoredGuestWorkout | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredGuestWorkout>
    if (typeof parsed?.token !== "string" || typeof parsed?.code !== "string") return null
    return { token: parsed.token, code: parsed.code }
  } catch {
    // Modo privado o almacenamiento bloqueado: el invitado entrena igual,
    // solo pierde la posibilidad de retomar la rutina más tarde.
    return null
  }
}

export function storeGuestWorkout(value: StoredGuestWorkout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch { /* sin almacenamiento */ }
}

export function clearGuestWorkout() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch { /* sin almacenamiento */ }
}
