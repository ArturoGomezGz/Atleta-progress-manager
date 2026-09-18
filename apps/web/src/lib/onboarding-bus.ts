// Bus mínimo para reabrir la bienvenida desde el menú de cuenta sin acoplar
// AccountMenu al gate con contexto o estado global — solo hace falta avisar
// "el usuario pidió verla de nuevo", una vez cada tanto.
type Listener = () => void
const listeners = new Set<Listener>()

export function reopenOnboarding() {
  listeners.forEach((l) => l())
}

export function onReopenOnboarding(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
