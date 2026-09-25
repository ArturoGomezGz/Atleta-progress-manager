"use client"

import { cn } from "@/lib/utils"
import { useFullscreenMode } from "@/lib/fullscreen-mode"
import { Sidebar } from "./sidebar"

/**
 * Envuelve el sidebar/topbar y el contenido. En modo pantalla completa (activado por
 * quien lo necesite, como el entrenamiento en curso) se oculta todo el chrome de
 * navegación: sin sidebar, sin topbar móvil ni botón de hamburguesa, y la única forma
 * de salir queda en manos de la propia pantalla (su botón de salir).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { fullscreen } = useFullscreenMode()
  return (
    <div className="flex h-dvh overflow-hidden">
      {!fullscreen && <Sidebar />}
      {/* scrollbar-gutter: el hueco de la barra de scroll queda reservado siempre. Si no,
          al cambiar un esqueleto corto por el contenido real (más alto) aparecía la barra
          y todo lo centrado (max-w-* mx-auto) se corría unos píxeles a la izquierda. */}
      <main className={cn("flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]", !fullscreen && "pt-14 lg:pt-0")}>
        {children}
      </main>
    </div>
  )
}
