"use client"

import { trpc } from "@/lib/trpc/client"
import { CheckCircle2Icon, MoonIcon, RotateCcwIcon, SaveIcon, SunIcon, UploadIcon } from "lucide-react"
import { use, useCallback, useEffect, useRef, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PaletteMode = {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  card: string
  border: string
}

type BrandPalette = {
  dark: PaletteMode
  light: PaletteMode
}

// ─── Color math ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").padEnd(6, "0")
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
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

function hslToHex(h: number, s: number, l: number): string {
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
  const chan = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
}

function contrastRatio(c1: string, c2: string): number {
  const l1 = relativeLuminance(c1), l2 = relativeLuminance(c2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function ensureContrast(color: string, bg: string, minRatio = 4.5): string {
  if (contrastRatio(color, bg) >= minRatio) return color
  const [r, g, b] = hexToRgb(color)
  const [h, s, l] = rgbToHsl(r, g, b)
  const onDark = relativeLuminance(bg) < 0.5
  for (let step = 1; step <= 20; step++) {
    const newL = onDark ? Math.min(95, l + step * 3) : Math.max(5, l - step * 3)
    const adjusted = hslToHex(h, s, newL)
    if (contrastRatio(adjusted, bg) >= minRatio) return adjusted
  }
  return onDark ? "#ffffff" : "#000000"
}

function generatePalette(dominantHex: string): BrandPalette {
  const [r, g, b] = hexToRgb(dominantHex)
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

async function extractDominantColorFromSrc(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = 100
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = size
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {}
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
        if (a < 128) continue
        const [, sat, lum] = rgbToHsl(r, g, b)
        if (sat < 15 || lum < 5 || lum > 95) continue
        const key = `${Math.round(r / 32) * 32}-${Math.round(g / 32) * 32}-${Math.round(b / 32) * 32}`
        if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 }
        buckets[key].count++; buckets[key].r += r; buckets[key].g += g; buckets[key].b += b
      }
      const best = Object.values(buckets).sort((a, b) => b.count - a.count)[0]
      if (!best) { resolve("#3b82f6"); return }
      const avgR = Math.round(best.r / best.count)
      const avgG = Math.round(best.g / best.count)
      const avgB = Math.round(best.b / best.count)
      resolve(`#${avgR.toString(16).padStart(2, "0")}${avgG.toString(16).padStart(2, "0")}${avgB.toString(16).padStart(2, "0")}`)
    }
    img.onerror = () => resolve("#3b82f6")
    img.crossOrigin = "anonymous"
    img.src = src
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AparienciaPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const [logo, setLogo] = useState<string | null>(null)
  const [palette, setPalette] = useState<BrandPalette | null>(null)
  const [originalPalette, setOriginalPalette] = useState<BrandPalette | null>(null)
  const [previewMode, setPreviewMode] = useState<"dark" | "light">("dark")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: branding } = trpc.teams.getBranding.useQuery({ teamId })
  const updateBranding = trpc.teams.updateBranding.useMutation()

  const currentTeam = teams?.find((t) => t.team.id === teamId)
  const isCoach = currentTeam?.role === "coach"
  const teamName = currentTeam?.team.name ?? "Mi equipo"

  useEffect(() => {
    if (!initialized && branding?.brandPalette && branding?.logoDataUrl) {
      setInitialized(true)
      setPalette(branding.brandPalette as BrandPalette)
      setOriginalPalette(branding.brandPalette as BrandPalette)
      setLogo(branding.logoDataUrl)
    }
  }, [branding, initialized])

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return
    if (file.size > 2 * 1024 * 1024) { alert("El logo debe pesar menos de 2 MB."); return }
    setIsProcessing(true)
    const dataUrl = await new Promise<string>((res) => {
      const reader = new FileReader()
      reader.onload = (e) => res(e.target!.result as string)
      reader.readAsDataURL(file)
    })
    setLogo(dataUrl)
    const dominant = await extractDominantColorFromSrc(dataUrl)
    const generated = generatePalette(dominant)
    setPalette(generated)
    setOriginalPalette(generated)
    setSaved(false)
    setIsProcessing(false)
  }

  async function handleRegenerate() {
    if (!logo) return
    setIsProcessing(true)
    const dominant = await extractDominantColorFromSrc(logo)
    const generated = generatePalette(dominant)
    setPalette(generated)
    setOriginalPalette(generated)
    setSaved(false)
    setIsProcessing(false)
  }

  async function handleSave() {
    if (!palette) return
    setIsSaving(true)
    await updateBranding.mutateAsync({ teamId, logoDataUrl: logo ?? undefined, brandPalette: palette })
    setSaved(true)
    setIsSaving(false)
  }

  if (!isCoach && !branding) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">La apariencia es configurada por los entrenadores del equipo.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold font-heading tracking-wide">Apariencia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {palette
            ? "Tu marca está lista. Ajusta lo que quieras."
            : "Sube el logo de tu equipo para generar los colores automáticamente."}
        </p>
      </div>

      {!palette && !isProcessing ? (
        <LogoUploadZone onFile={handleFile} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Logo + controls */}
            <div className="flex items-center gap-3">
              {logo && (
                <img
                  src={logo}
                  alt="Logo del equipo"
                  className="w-12 h-12 rounded-xl object-contain bg-card border border-border p-1.5 shrink-0"
                />
              )}
              {isProcessing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  Analizando logo...
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium leading-tight">{teamName}</p>
                  {isCoach && (
                    <button
                      onClick={() => { setLogo(null); setPalette(null); setOriginalPalette(null); setSaved(false) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cambiar logo
                    </button>
                  )}
                </div>
              )}
            </div>

            {palette && !isProcessing && (
              <>
                <PaletteEditor palette={palette} onChange={(p) => { setPalette(p); setSaved(false) }} readOnly={!isCoach} />

                {isCoach && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={isSaving || saved}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer disabled:cursor-default"
                    >
                      {saved ? (
                        <><CheckCircle2Icon className="w-4 h-4" /> Aplicado</>
                      ) : isSaving ? (
                        <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Aplicando...</>
                      ) : (
                        <><SaveIcon className="w-4 h-4" /> Aplicar al equipo</>
                      )}
                    </button>

                    {originalPalette && !saved && (
                      <button
                        onClick={() => { setPalette(originalPalette); setSaved(false) }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Deshacer cambios manuales"
                      >
                        <RotateCcwIcon className="w-3.5 h-3.5" />
                        Restablecer
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: preview */}
          {palette && !isProcessing && (
            <div className="lg:col-span-3">
              <LivePreview
                logo={logo}
                teamName={teamName}
                palette={palette}
                mode={previewMode}
                onModeChange={setPreviewMode}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Logo upload zone ─────────────────────────────────────────────────────────

function LogoUploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) onFile(f)
    },
    [onFile],
  )

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center gap-5 py-20 rounded-2xl cursor-pointer
        border-2 border-dashed transition-all duration-200
        ${isDragging ? "border-primary bg-primary/5 scale-[1.005]" : "border-border hover:border-primary/50 hover:bg-primary/[0.02]"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <UploadIcon className="w-7 h-7 text-primary" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-medium">Arrastra tu logo aquí</p>
        <p className="text-xs text-muted-foreground">o haz clic para seleccionar un archivo</p>
        <p className="text-xs text-muted-foreground/50 mt-2">PNG · SVG · JPG · máx. 2 MB</p>
      </div>
    </div>
  )
}

// ─── Palette editor ───────────────────────────────────────────────────────────

const TOKENS: { key: keyof PaletteMode; label: string }[] = [
  { key: "primary",    label: "Color principal" },
  { key: "secondary",  label: "Secundario" },
  { key: "accent",     label: "Acento" },
  { key: "background", label: "Fondo" },
  { key: "foreground", label: "Texto" },
]

function PaletteEditor({
  palette,
  onChange,
  readOnly,
}: {
  palette: BrandPalette
  onChange: (p: BrandPalette) => void
  readOnly?: boolean
}) {
  function update(mode: "dark" | "light", key: keyof PaletteMode, value: string) {
    onChange({ ...palette, [mode]: { ...palette[mode], [key]: value } })
  }

  return (
    <div className="space-y-0.5">
      {/* Column headers */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-border">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-28 shrink-0">Token</span>
        <span className="flex-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MoonIcon className="w-3 h-3" /> Oscuro
        </span>
        <span className="flex-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <SunIcon className="w-3 h-3" /> Claro
        </span>
      </div>

      {TOKENS.map(({ key, label }) => (
        <TokenRow
          key={key}
          label={label}
          darkHex={palette.dark[key]}
          lightHex={palette.light[key]}
          readOnly={readOnly}
          onDarkChange={(v) => update("dark", key, v)}
          onLightChange={(v) => update("light", key, v)}
        />
      ))}
    </div>
  )
}

// ─── Token row ────────────────────────────────────────────────────────────────

function TokenRow({
  label, darkHex, lightHex, readOnly, onDarkChange, onLightChange,
}: {
  label: string
  darkHex: string
  lightHex: string
  readOnly?: boolean
  onDarkChange: (v: string) => void
  onLightChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <Swatch hex={darkHex} readOnly={readOnly} onChange={onDarkChange} />
      <Swatch hex={lightHex} readOnly={readOnly} onChange={onLightChange} />
    </div>
  )
}

// ─── Swatch ───────────────────────────────────────────────────────────────────

function Swatch({
  hex, readOnly, onChange,
}: {
  hex: string
  readOnly?: boolean
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localHex, setLocalHex] = useState(hex)

  useEffect(() => { setLocalHex(hex) }, [hex])

  return (
    <div className="flex-1 flex items-center gap-2 min-w-0">
      <button
        onClick={() => !readOnly && inputRef.current?.click()}
        className={`relative w-6 h-6 rounded-md ring-1 ring-border/80 shrink-0 transition-all ${
          readOnly ? "cursor-default" : "cursor-pointer hover:ring-primary/70 hover:scale-110"
        }`}
        style={{ backgroundColor: hex }}
        aria-label={readOnly ? undefined : "Cambiar color"}
        disabled={readOnly}
      >
        {!readOnly && (
          <input
            ref={inputRef}
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        )}
      </button>

      <input
        type="text"
        value={localHex}
        readOnly={readOnly}
        onChange={(e) => {
          const v = e.target.value
          setLocalHex(v)
          if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase())
        }}
        onBlur={(e) => { if (!/^#[0-9a-f]{6}$/i.test(e.target.value)) setLocalHex(hex) }}
        className="w-[4.5rem] text-[11px] font-mono text-muted-foreground bg-transparent border-0 focus:outline-none focus:text-foreground uppercase tracking-wider truncate"
        maxLength={7}
      />

    </div>
  )
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function LivePreview({
  logo, teamName, palette, mode, onModeChange,
}: {
  logo: string | null
  teamName: string
  palette: BrandPalette
  mode: "dark" | "light"
  onModeChange: (m: "dark" | "light") => void
}) {
  const p = palette[mode]

  return (
    <div className="space-y-3 sticky top-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vista previa</span>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "dark" ? <MoonIcon className="w-3 h-3" /> : <SunIcon className="w-3 h-3" />}
              {m === "dark" ? "Oscuro" : "Claro"}
            </button>
          ))}
        </div>
      </div>

      {/* Frame */}
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ borderColor: p.border, backgroundColor: p.background }}
      >
        <div className="flex" style={{ minHeight: 340 }}>
          {/* Mini sidebar */}
          <div
            className="flex flex-col gap-3 shrink-0"
            style={{
              width: 152,
              padding: "16px 10px",
              backgroundColor: p.card,
              borderRight: `1px solid ${p.border}`,
            }}
          >
            {/* Brand mark */}
            <div className="flex items-center gap-2 mb-1">
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  className="w-7 h-7 rounded-lg object-contain shrink-0"
                  style={{ backgroundColor: p.background, padding: 2 }}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: p.primary, color: "#fff" }}
                >
                  {teamName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-semibold truncate" style={{ color: p.foreground }}>
                {teamName}
              </span>
            </div>

            {/* Nav items */}
            {[
              { label: "Sesiones",   active: true },
              { label: "Progreso",   active: false },
              { label: "Ejercicios", active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]"
                style={
                  active
                    ? { backgroundColor: `${p.primary}1a`, color: p.primary, fontWeight: 600 }
                    : { color: p.foreground, opacity: 0.45 }
                }
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: active ? p.primary : p.foreground, opacity: active ? 1 : 0.4 }}
                />
                {label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-5 space-y-4">
            <p className="text-sm font-semibold" style={{ color: p.foreground }}>
              Sesiones
            </p>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {[["24", "Este mes"], ["8", "Esta semana"]].map(([val, lbl]) => (
                <div
                  key={lbl}
                  style={{
                    backgroundColor: p.card,
                    border: `1px solid ${p.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <p className="text-[10px] mb-0.5" style={{ color: p.foreground, opacity: 0.5 }}>{lbl}</p>
                  <p className="text-xl font-bold" style={{ color: p.primary }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Primary button */}
            <button
              style={{
                backgroundColor: p.primary,
                color: "#fff",
                borderRadius: 7,
                padding: "7px 16px",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "default",
                display: "block",
              }}
            >
              Nueva sesión
            </button>

            {/* Accent badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                backgroundColor: `${p.accent}18`,
                color: p.accent,
                borderRadius: 99,
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              <span style={{ width: 5, height: 5, backgroundColor: p.accent, borderRadius: "50%", display: "inline-block" }} />
              En progreso
            </div>

            {/* Secondary surface */}
            <div
              style={{
                backgroundColor: p.secondary,
                border: `1px solid ${p.border}`,
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <p className="text-[10px]" style={{ color: p.foreground, opacity: 0.6 }}>Próxima sesión</p>
              <p className="text-xs font-medium" style={{ color: p.foreground }}>Martes 14 mayo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
