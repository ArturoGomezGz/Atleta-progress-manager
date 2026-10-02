import { cn } from "@/lib/utils"
import Link from "next/link"
import type { ReactNode } from "react"

// Encabezado compartido de la sección "Entrenamientos" del coach: las dos pestañas
// son rutas existentes (plantillas y rutinas), así no se mueve ni duplica lógica.
const TABS = [
  { key: "mis-entrenamientos", label: "Mis entrenamientos", suffix: "plantillas" },
  { key: "asignados",          label: "Asignados",          suffix: "rutinas" },
] as const

export function EntrenamientosHeader({
  teamId, active, action,
}: {
  teamId: string
  active: (typeof TABS)[number]["key"]
  action?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Entrenamientos
        </h1>
        {action}
      </div>
      <nav className="flex gap-1 border-b border-border" aria-label="Entrenamientos">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/teams/${teamId}/${t.suffix}`}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "px-3 py-2 -mb-px text-sm border-b-2 transition-colors cursor-pointer",
              active === t.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
