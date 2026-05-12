// Shared color math and palette generation for team branding.

export type PaletteMode = {
  primary: string; secondary: string; accent: string
  background: string; foreground: string; card: string; border: string
}

export type BrandPalette = { dark: PaletteMode; light: PaletteMode }

export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "").padEnd(6, "0")
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const c = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

function contrastRatio(c1: string, c2: string): number {
  const l1 = relativeLuminance(c1), l2 = relativeLuminance(c2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function ensureContrast(color: string, bg: string, min = 4.5): string {
  if (contrastRatio(color, bg) >= min) return color
  const [r, g, b] = hexToRgb(color)
  const [h, s, l] = rgbToHsl(r, g, b)
  const onDark = relativeLuminance(bg) < 0.5
  for (let i = 1; i <= 20; i++) {
    const newL = onDark ? Math.min(95, l + i * 3) : Math.max(5, l - i * 3)
    const adj = hslToHex(h, s, newL)
    if (contrastRatio(adj, bg) >= min) return adj
  }
  return onDark ? "#ffffff" : "#000000"
}

export function generatePalette(hex: string): BrandPalette {
  const [r, g, b] = hexToRgb(hex)
  const [h, s] = rgbToHsl(r, g, b)
  const sat = Math.max(s, 15)

  const darkBg      = hslToHex(h, Math.min(sat, 22), 4)
  const darkCard    = hslToHex(h, Math.min(sat, 20), 10)
  const darkBorder  = hslToHex(h, Math.min(sat, 18), 22)
  const darkFg      = hslToHex(h, 28, 92)
  const darkPrimary = ensureContrast(hslToHex(h, Math.max(sat, 70), 64), darkBg)
  const darkSec     = hslToHex(h, Math.min(sat, 22), 17)
  const darkAccent  = ensureContrast(hslToHex((h + 30) % 360, Math.max(sat * 0.7, 40), 60), darkBg)

  const lightBg      = hslToHex(h, Math.min(sat, 17), 97)
  const lightCard    = "#ffffff"
  const lightBorder  = hslToHex(h, Math.min(sat, 14), 88)
  const lightFg      = hslToHex(h, 10, 10)
  const lightPrimary = ensureContrast(hslToHex(h, Math.max(sat, 60), 40), lightBg)
  const lightSec     = hslToHex(h, Math.min(sat, 15), 94)
  const lightAccent  = ensureContrast(hslToHex((h + 30) % 360, Math.max(sat * 0.7, 40), 40), lightBg)

  return {
    dark:  { primary: darkPrimary,  secondary: darkSec,  accent: darkAccent,  background: darkBg,  foreground: darkFg,  card: darkCard,  border: darkBorder },
    light: { primary: lightPrimary, secondary: lightSec, accent: lightAccent, background: lightBg, foreground: lightFg, card: lightCard, border: lightBorder },
  }
}

/** Converts a hex color to the HSL var format used by CSS custom properties (e.g. "217 91% 60%"). */
export function toHslVar(hex: string): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex))
  return `${h} ${s}% ${l}%`
}
