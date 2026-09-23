import { ZONE_CONFIG, type ZoneProfile } from "@/lib/body-zones"
import { cn } from "@/lib/utils"

// Visualización del perfil por zonas de una rutina o sesión: cada zona ocupa la
// proporción de series que le toca, de mayor a menor, así el color dominante
// (el de la zona con más series) es el que más se ve.

const pct = (share: number) => `${Math.round(share * 100)}%`

function describe(profile: ZoneProfile) {
  return profile.shares.map((s) => `${ZONE_CONFIG[s.zone].label} ${pct(s.share)}`).join(", ")
}

/** Franja vertical para el borde izquierdo de una tarjeta. Se estira al alto del contenedor. */
export function ZoneStripe({ profile, className }: { profile: ZoneProfile | null | undefined; className?: string }) {
  const shares = profile?.shares ?? []
  return (
    <div
      className={cn("w-1 shrink-0 self-stretch flex flex-col overflow-hidden rounded-full", shares.length === 0 && "bg-border", className)}
      role={shares.length > 0 ? "img" : undefined}
      aria-label={shares.length > 0 ? `Zonas: ${describe(profile!)}` : undefined}
    >
      {shares.map((s) => (
        <div key={s.zone} className={ZONE_CONFIG[s.zone].bar} style={{ flexGrow: s.share }} />
      ))}
    </div>
  )
}

/** Barra horizontal proporcional, con separación mínima entre segmentos. */
export function ZoneBar({ profile, className }: { profile: ZoneProfile | null | undefined; className?: string }) {
  const shares = profile?.shares ?? []
  if (shares.length === 0) return null
  return (
    <div className={cn("flex h-1.5 w-full gap-px overflow-hidden rounded-full", className)} role="img" aria-label={`Zonas: ${describe(profile!)}`}>
      {shares.map((s) => (
        <div key={s.zone} className={ZONE_CONFIG[s.zone].bar} style={{ flexGrow: s.share }} title={`${ZONE_CONFIG[s.zone].label} ${pct(s.share)}`} />
      ))}
    </div>
  )
}

/** Leyenda compacta: "● Inferior 60% ● Full body 40%". `max` recorta las zonas menores. */
export function ZoneLegend({ profile, max = 4, className }: { profile: ZoneProfile | null | undefined; max?: number; className?: string }) {
  const shares = profile?.shares ?? []
  if (shares.length === 0) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground", className)}>
      {shares.slice(0, max).map((s) => (
        <span key={s.zone} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className={cn("w-1.5 h-1.5 rounded-full", ZONE_CONFIG[s.zone].bar)} />
          {ZONE_CONFIG[s.zone].label}
          {shares.length > 1 && <span className="tabular-nums">{pct(s.share)}</span>}
        </span>
      ))}
    </div>
  )
}
