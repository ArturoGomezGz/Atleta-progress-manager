"use client"

import { useTheme } from "@/lib/theme-provider"
import { trpc } from "@/lib/trpc/client"
import { usePathname } from "next/navigation"

// ─── Color utils ──────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "").padEnd(6, "0")
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function toVar(hex: string): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex))
  return `${h} ${s}% ${l}%`
}

// ─── Palette → CSS vars ───────────────────────────────────────────────────────

type PaletteMode = {
  primary: string; secondary: string; accent: string
  background: string; foreground: string; card: string; border: string
}

function paletteToVars(p: PaletteMode): Record<string, string> {
  const [fgH, fgS, fgL] = rgbToHsl(...hexToRgb(p.foreground))
  const [, , bgL] = rgbToHsl(...hexToRgb(p.background))
  const mutedL = Math.round(bgL + (fgL - bgL) * 0.45)

  return {
    "--primary":              toVar(p.primary),
    "--secondary":            toVar(p.secondary),
    "--accent":               toVar(p.accent),
    "--background":           toVar(p.background),
    "--foreground":           toVar(p.foreground),
    "--card":                 toVar(p.card),
    "--border":               toVar(p.border),
    "--card-foreground":      toVar(p.foreground),
    "--popover":              toVar(p.card),
    "--popover-foreground":   toVar(p.foreground),
    "--secondary-foreground": toVar(p.foreground),
    "--muted":                toVar(p.secondary),
    "--muted-foreground":     `${fgH} ${Math.round(fgS * 0.5)}% ${mutedL}%`,
    "--accent-foreground":    toVar(p.foreground),
    "--primary-foreground":   "0 0% 100%",
    "--input":                toVar(p.secondary),
    "--ring":                 toVar(p.primary),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamThemeApplicator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const { data: teams } = trpc.teams.list.useQuery()

  const teamId = pathname.match(/^\/teams\/([^/]+)/)?.[1] ?? null
  const palette = teamId
    ? (teams?.find((t) => t.team.id === teamId)?.team.brandPalette as
        | { dark: PaletteMode; light: PaletteMode }
        | null
        | undefined)
    : null

  if (!palette) return <>{children}</>

  return (
    <div style={paletteToVars(palette[resolvedTheme]) as React.CSSProperties} className="contents">
      {children}
    </div>
  )
}
