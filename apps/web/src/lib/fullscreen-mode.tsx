"use client"

// Le permite a una pantalla (como el entrenamiento en curso) pedirle al layout de la
// app que oculte el sidebar/topbar mientras está montada, para no distraer ni dejar
// una salida que no sea su propio botón de salir. Si no hay <FullscreenModeProvider/>
// en el árbol (p. ej. la vista de invitado, que ya vive fuera del layout con sidebar),
// el hook queda como no-op: es seguro usarlo desde un componente compartido sin saber
// dónde vive.

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react"

type FullscreenModeContextValue = {
  fullscreen: boolean
  setFullscreen: (value: boolean) => void
}

const FullscreenModeContext = createContext<FullscreenModeContextValue>({
  fullscreen: false,
  setFullscreen: () => {},
})

export function FullscreenModeProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false)
  return (
    <FullscreenModeContext.Provider value={{ fullscreen, setFullscreen }}>
      {children}
    </FullscreenModeContext.Provider>
  )
}

export function useFullscreenMode() {
  return useContext(FullscreenModeContext)
}

/**
 * Activa el modo pantalla completa mientras el componente que lo llama está montado.
 *
 * Con useLayoutEffect el sidebar/topbar se quitan antes del primer paint de la
 * pantalla: con useEffect se alcanzaba a pintar un frame con el menú todavía puesto
 * y en el siguiente todo el contenido se corría a la izquierda (o hacia arriba en
 * móvil), justo cuando una vista empezaba a deslizarse o aparecía su contenido.
 */
export function useFullscreenWhileMounted(active: boolean) {
  const { setFullscreen } = useFullscreenMode()
  useLayoutEffect(() => {
    if (!active) return
    setFullscreen(true)
    return () => setFullscreen(false)
  }, [active, setFullscreen])
}
