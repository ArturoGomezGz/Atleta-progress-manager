import { signOut, useSession } from "@/lib/auth"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">Atleta</span>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Equipos
          </a>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
