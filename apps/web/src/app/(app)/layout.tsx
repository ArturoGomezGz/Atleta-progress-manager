import { FullscreenModeProvider } from "@/lib/fullscreen-mode"
import type { Viewport } from "next"
import { AppShell } from "./app-shell"
import { TeamThemeApplicator } from "./TeamThemeApplicator"

// Por defecto (Chrome Android ≥108, Firefox) el teclado solo encoge el viewport
// *visual*: `h-dvh` no cambia, el shell sigue midiendo la pantalla entera y, para
// mostrar un campo que quedó bajo el teclado, el navegador desplaza la página
// completa —barra superior, cabeceras sticky y hojas inferiores incluidas— en vez
// del <main> con scroll. Con `resizes-content` el teclado encoge el viewport de
// layout: el shell (h-dvh) se ajusta al espacio sobre el teclado y solo <main>
// hace scroll hasta el campo. iOS Safari ignora esta clave.
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamThemeApplicator>
      <FullscreenModeProvider>
        <AppShell>{children}</AppShell>
      </FullscreenModeProvider>
    </TeamThemeApplicator>
  )
}
