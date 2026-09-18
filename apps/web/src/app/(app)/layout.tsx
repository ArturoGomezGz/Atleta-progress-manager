import { FullscreenModeProvider } from "@/lib/fullscreen-mode"
import { AppShell } from "./app-shell"
import { TeamThemeApplicator } from "./TeamThemeApplicator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamThemeApplicator>
      <FullscreenModeProvider>
        <AppShell>{children}</AppShell>
      </FullscreenModeProvider>
    </TeamThemeApplicator>
  )
}
