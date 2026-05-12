"use client"

import { useTheme } from "@/lib/theme-provider"
import { generatePalette, hexToRgb, rgbToHsl, toHslVar, type PaletteMode } from "@/lib/brand-palette"
import { trpc } from "@/lib/trpc/client"
import { usePathname } from "next/navigation"

function paletteToVars(p: PaletteMode): Record<string, string> {
  const [fgH, fgS, fgL] = rgbToHsl(...hexToRgb(p.foreground))
  const [, , bgL] = rgbToHsl(...hexToRgb(p.background))
  const mutedL = Math.round(bgL + (fgL - bgL) * 0.45)

  return {
    "--primary":              toHslVar(p.primary),
    "--secondary":            toHslVar(p.secondary),
    "--accent":               toHslVar(p.accent),
    "--background":           toHslVar(p.background),
    "--foreground":           toHslVar(p.foreground),
    "--card":                 toHslVar(p.card),
    "--border":               toHslVar(p.border),
    "--card-foreground":      toHslVar(p.foreground),
    "--popover":              toHslVar(p.card),
    "--popover-foreground":   toHslVar(p.foreground),
    "--secondary-foreground": toHslVar(p.foreground),
    "--muted":                toHslVar(p.secondary),
    "--muted-foreground":     `${fgH} ${Math.round(fgS * 0.5)}% ${mutedL}%`,
    "--accent-foreground":    toHslVar(p.foreground),
    "--primary-foreground":   "0 0% 100%",
    "--input":                toHslVar(p.secondary),
    "--ring":                 toHslVar(p.primary),
  }
}

export function TeamThemeApplicator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const { data: teams } = trpc.teams.list.useQuery()

  const teamId = pathname.match(/^\/teams\/([^/]+)/)?.[1] ?? null
  const brandData = teamId
    ? (teams?.find((t) => t.team.id === teamId)?.team.brandPalette as { color: string } | null | undefined)
    : null

  if (!brandData?.color) return <>{children}</>

  const palette = generatePalette(brandData.color)
  const vars = paletteToVars(palette[resolvedTheme])

  return (
    <div style={vars as React.CSSProperties} className="contents">
      {children}
    </div>
  )
}
