import { OnboardingGate } from "./onboarding-gate"
import { Sidebar } from "./sidebar"
import { TeamThemeApplicator } from "./TeamThemeApplicator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamThemeApplicator>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
      </div>
      {/* Vive en el layout, no en /dashboard: ese redirige de inmediato y no
          sobrevive lo suficiente para mostrar nada. El layout de (app) no se
          remonta entre /dashboard y /teams/{id}/..., así que el modal persiste. */}
      <OnboardingGate />
    </TeamThemeApplicator>
  )
}
