import { Sidebar } from "./sidebar"
import { TeamThemeApplicator } from "./TeamThemeApplicator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamThemeApplicator>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
      </div>
    </TeamThemeApplicator>
  )
}
