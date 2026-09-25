const BACK_NAV_KEY = "atleta:back-nav"

/**
 * Marca que la próxima navegación es "volver atrás" dentro de un flujo
 * secuencial (crear → editar, etc.), para que la vista de destino entre
 * deslizándose desde la izquierda en vez de aparecer sin animación.
 */
export function markBackNavigation() {
  try {
    sessionStorage.setItem(BACK_NAV_KEY, "1")
  } catch {
    // sessionStorage no disponible (privado/bloqueado): sin animación, no rompe la navegación
  }
}

/** Consume (y limpia) la marca dejada por markBackNavigation. */
export function consumeBackNavigation(): boolean {
  try {
    const flagged = sessionStorage.getItem(BACK_NAV_KEY) === "1"
    sessionStorage.removeItem(BACK_NAV_KEY)
    return flagged
  } catch {
    return false
  }
}
