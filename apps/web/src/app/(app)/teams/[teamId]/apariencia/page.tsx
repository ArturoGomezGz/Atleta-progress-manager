"use client"

import { generatePalette, hexToRgb, rgbToHsl } from "@/lib/brand-palette"
import { trpc } from "@/lib/trpc/client"
import { CheckCircle2Icon, MoonIcon, RotateCcwIcon, SaveIcon, SunIcon, UploadIcon } from "lucide-react"
import { use, useCallback, useEffect, useRef, useState } from "react"

// ─── Client-side color extraction ────────────────────────────────────────────

async function extractDominantColor(src: string): Promise<string> {
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
    img.src = src
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AparienciaPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const [logo, setLogo] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState<string | null>(null)
  const [originalColor, setOriginalColor] = useState<string | null>(null)
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
    if (!initialized && branding?.logoDataUrl) {
      setInitialized(true)
      setLogo(branding.logoDataUrl)
      const saved = branding.brandPalette as { color: string } | null
      if (saved?.color) {
        setBrandColor(saved.color)
        setOriginalColor(saved.color)
      }
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
    const color = await extractDominantColor(dataUrl)
    setBrandColor(color)
    setOriginalColor(color)
    setSaved(false)
    setIsProcessing(false)
  }

  async function handleSave() {
    if (!brandColor) return
    setIsSaving(true)
    await updateBranding.mutateAsync({ teamId, logoDataUrl: logo ?? undefined, brandColor })
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

  const palette = brandColor ? generatePalette(brandColor) : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold font-heading tracking-wide">Apariencia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {palette ? "Tu marca está lista. Ajusta lo que quieras." : "Sube el logo de tu equipo para generar los colores automáticamente."}
        </p>
      </div>

      {!logo && !isProcessing ? (
        <LogoUploadZone onFile={handleFile} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: logo + color + actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              {logo && (
                <img src={logo} alt="Logo" className="w-12 h-12 rounded-xl object-cover overflow-hidden shrink-0" />
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
                      onClick={() => { setLogo(null); setBrandColor(null); setOriginalColor(null); setSaved(false) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cambiar logo
                    </button>
                  )}
                </div>
              )}
            </div>

            {brandColor && !isProcessing && isCoach && (
              <>
                <ColorEditor
                  color={brandColor}
                  onChange={(c) => { setBrandColor(c); setSaved(false) }}
                />

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

                  {originalColor && brandColor !== originalColor && (
                    <button
                      onClick={() => { setBrandColor(originalColor); setSaved(false) }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <RotateCcwIcon className="w-3.5 h-3.5" />
                      Restablecer
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: live preview */}
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) onFile(f)
  }, [onFile])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-5 py-20 rounded-2xl cursor-pointer border-2 border-dashed transition-all duration-200 ${
        isDragging ? "border-primary bg-primary/5 scale-[1.005]" : "border-border hover:border-primary/50 hover:bg-primary/[0.02]"
      }`}
    >
      <input
        ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
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

// ─── Single color editor ──────────────────────────────────────────────────────

function ColorEditor({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localHex, setLocalHex] = useState(color)

  useEffect(() => { setLocalHex(color) }, [color])

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">Color principal</span>
      <button
        onClick={() => inputRef.current?.click()}
        className="relative w-7 h-7 rounded-md ring-1 ring-border/80 hover:ring-primary/70 cursor-pointer transition-all shrink-0 hover:scale-110"
        style={{ backgroundColor: color }}
      >
        <input
          ref={inputRef} type="color" value={color}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </button>
      <input
        type="text"
        value={localHex}
        onChange={(e) => {
          const v = e.target.value; setLocalHex(v)
          if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase())
        }}
        onBlur={(e) => { if (!/^#[0-9a-f]{6}$/i.test(e.target.value)) setLocalHex(color) }}
        className="w-[4.5rem] text-[11px] font-mono text-muted-foreground bg-transparent border-0 focus:outline-none focus:text-foreground uppercase tracking-wider"
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
  palette: ReturnType<typeof generatePalette>
  mode: "dark" | "light"
  onModeChange: (m: "dark" | "light") => void
}) {
  const p = palette[mode]

  return (
    <div className="space-y-3 sticky top-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vista previa</span>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {(["dark", "light"] as const).map((m) => (
            <button key={m} onClick={() => onModeChange(m)}
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

      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: p.border, backgroundColor: p.background }}>
        <div className="flex" style={{ minHeight: 340 }}>
          {/* Mini sidebar */}
          <div className="flex flex-col gap-3 shrink-0"
            style={{ width: 152, padding: "16px 10px", backgroundColor: p.card, borderRight: `1px solid ${p.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              {logo ? (
                <img src={logo} alt="" className="w-7 h-7 rounded-lg object-cover overflow-hidden shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: p.primary, color: "#fff" }}>
                  {teamName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-semibold truncate" style={{ color: p.foreground }}>{teamName}</span>
            </div>
            {[{ label: "Sesiones", active: true }, { label: "Progreso", active: false }, { label: "Ejercicios", active: false }].map(({ label, active }) => (
              <div key={label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]"
                style={active ? { backgroundColor: `${p.primary}1a`, color: p.primary, fontWeight: 600 } : { color: p.foreground, opacity: 0.45 }}>
                <div className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: active ? p.primary : p.foreground, opacity: active ? 1 : 0.4 }} />
                {label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-5 space-y-4">
            <p className="text-sm font-semibold" style={{ color: p.foreground }}>Sesiones</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[["24", "Este mes"], ["8", "Esta semana"]].map(([val, lbl]) => (
                <div key={lbl} style={{ backgroundColor: p.card, border: `1px solid ${p.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: p.foreground, opacity: 0.5 }}>{lbl}</p>
                  <p className="text-xl font-bold" style={{ color: p.primary }}>{val}</p>
                </div>
              ))}
            </div>
            <button style={{ backgroundColor: p.primary, color: "#fff", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, border: "none", cursor: "default", display: "block" }}>
              Nueva sesión
            </button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, backgroundColor: `${p.accent}18`, color: p.accent, borderRadius: 99, padding: "3px 10px", fontSize: 10, fontWeight: 500 }}>
              <span style={{ width: 5, height: 5, backgroundColor: p.accent, borderRadius: "50%", display: "inline-block" }} />
              En progreso
            </div>
            <div style={{ backgroundColor: p.secondary, border: `1px solid ${p.border}`, borderRadius: 8, padding: "8px 12px" }}>
              <p className="text-[10px]" style={{ color: p.foreground, opacity: 0.6 }}>Próxima sesión</p>
              <p className="text-xs font-medium" style={{ color: p.foreground }}>Martes 14 mayo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
