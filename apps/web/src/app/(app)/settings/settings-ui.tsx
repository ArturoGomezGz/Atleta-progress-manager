// Piezas visuales de la página Cuenta (/settings) y sus subpáginas (p. ej. /settings/conectar-ia).

import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"

export const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"

export const ghostButtonClass =
  "border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"

export const primaryButtonClass =
  "bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"

export function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="border border-border rounded-xl bg-card divide-y divide-border">{children}</div>
    </section>
  )
}

export function Row({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function BackToSettings() {
  return (
    <Link
      href="/settings"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
    >
      <ChevronLeftIcon className="w-3.5 h-3.5" />
      Cuenta
    </Link>
  )
}
