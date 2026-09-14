"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import type { RoutineContent } from "@atleta/db/schema"
import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react"
import { useState } from "react"

type Goal    = "strength" | "hypertrophy" | "endurance" | "power" | "cardio" | "recovery"
type Level   = "beginner" | "intermediate" | "advanced"
type Format  = "traditional" | "circuit" | "mixed"
type Zone    = "upper" | "lower" | "core"
type Pattern = "push" | "pull" | "squat" | "hinge" | "carry" | "rotation" | "isometric" | "mobility" | "core"
type EquipmentMode = "any" | "bodyweight" | "pick"

export type AiRoutineResult = {
  content: RoutineContent
  summary: string
  createdExercises: { id: string; name: string }[]
}

const GOALS: [Goal, string][] = [
  ["strength", "Fuerza"], ["hypertrophy", "Hipertrofia"], ["endurance", "Resistencia"],
  ["power", "Potencia"], ["cardio", "Acondicionamiento"], ["recovery", "Recuperación"],
]
const LEVELS: [Level, string][] = [["beginner", "Principiante"], ["intermediate", "Intermedio"], ["advanced", "Avanzado"]]
const FORMATS: [Format, string][] = [["traditional", "Tradicional"], ["circuit", "Circuitos"], ["mixed", "Mixto"]]
const ZONES: [Zone, string][] = [["upper", "Tren superior"], ["lower", "Tren inferior"], ["core", "Core"]]
const PATTERNS: [Pattern, string][] = [
  ["push", "Empuje"], ["pull", "Tracción"], ["squat", "Sentadilla"], ["hinge", "Bisagra"],
  ["carry", "Acarreo"], ["rotation", "Rotación"], ["isometric", "Isométrico"], ["mobility", "Movilidad"], ["core", "Core"],
]
const DURATIONS = [30, 45, 60, 90]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer font-medium",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">{label}{hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}</p>
      {children}
    </div>
  )
}

export function AiRoutineGenerator({ teamId, replacesContent, onGenerated, onClose }: {
  teamId: string
  replacesContent: boolean
  onGenerated: (result: AiRoutineResult) => void
  onClose: () => void
}) {
  const [goal, setGoal]                 = useState<Goal | null>(null)
  const [duration, setDuration]         = useState(60)
  const [level, setLevel]               = useState<Level | null>(null)
  const [warmup, setWarmup]             = useState(true)
  const [cooldownChoice, setCooldown]   = useState<boolean | null>(null)
  const [hasKnownRM, setHasKnownRM]     = useState(false)
  const [format, setFormat]             = useState<Format | null>(null)
  const [zones, setZones]               = useState<Zone[]>([])
  const [patterns, setPatterns]         = useState<Pattern[]>([])
  const [equipmentMode, setEquipmentMode] = useState<EquipmentMode>("any")
  const [equipmentIds, setEquipmentIds] = useState<string[]>([])
  const [limitations, setLimitations]   = useState("")
  const [description, setDescription]   = useState("")

  const { data: equipmentCatalog } = trpc.exercises.listEquipment.useQuery(undefined, { enabled: equipmentMode === "pick" })
  const generate = trpc.routines.generateWithAI.useMutation({ onSuccess: onGenerated })

  const detail = [level, format, zones.length || patterns.length, equipmentMode !== "any", limitations.trim(), description.trim().length >= 30]
    .filter(Boolean).length
  const detailLabel = detail <= 1 ? "Básico" : detail <= 3 ? "Bueno" : "Muy completo"

  const cooldown = cooldownChoice ?? duration >= 45

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!goal) return
    generate.mutate({
      teamId,
      goal,
      durationMinutes: duration,
      level,
      includeWarmup: warmup,
      includeCooldown: cooldown,
      hasKnownRM,
      format,
      focusZones: zones.length ? zones : null,
      focusPatterns: patterns.length ? patterns : null,
      equipmentIds: equipmentMode === "any" ? null : equipmentMode === "bodyweight" ? [] : equipmentIds,
      limitations: limitations.trim() || null,
      description: description.trim() || null,
    })
  }

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"

  return (
    <form onSubmit={submit} className="border border-primary/30 rounded-xl bg-card/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-primary/20">
        <SparklesIcon className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold flex-1">Generar con IA <span className="text-[10px] font-medium text-primary border border-primary/30 rounded-full px-1.5 py-0.5 ml-1">Experimental</span></p>
        <button type="button" onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Cerrar">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Cuanto más contexto des, mejor será la propuesta. Solo el objetivo es obligatorio; lo que dejes vacío la IA lo decide con criterios conservadores.
        </p>

        <Field label="Objetivo principal">
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map(([v, l]) => <Chip key={v} active={goal === v} onClick={() => setGoal(v)}>{l}</Chip>)}
          </div>
        </Field>

        <Field label="Duración total" hint="incluye calentamiento y descansos">
          <div className="flex flex-wrap items-center gap-1.5">
            {DURATIONS.map((d) => <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d} min</Chip>)}
            <input
              type="number" min={10} max={180}
              value={duration}
              onChange={(e) => setDuration(Math.max(10, Math.min(180, Number(e.target.value) || 10)))}
              className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
              aria-label="Duración en minutos"
            />
          </div>
        </Field>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} className="accent-primary" />
            Incluir calentamiento
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={cooldown} onChange={(e) => setCooldown(e.target.checked)} className="accent-primary" />
            Incluir vuelta a la calma
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={hasKnownRM} onChange={(e) => setHasKnownRM(e.target.checked)} className="accent-primary" />
            Tienen RM registrados (permite cargas en % RM)
          </label>
        </div>

        <Field label="Nivel del grupo" hint="si no lo indicas, se asume intermedio con RPE">
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map(([v, l]) => <Chip key={v} active={level === v} onClick={() => setLevel(level === v ? null : v)}>{l}</Chip>)}
          </div>
        </Field>

        <Field label="Formato" hint="opcional">
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map(([v, l]) => <Chip key={v} active={format === v} onClick={() => setFormat(format === v ? null : v)}>{l}</Chip>)}
          </div>
        </Field>

        <Field label="Enfoque" hint="opcional, puedes elegir varios">
          <div className="flex flex-wrap gap-1.5">
            {ZONES.map(([v, l]) => <Chip key={v} active={zones.includes(v)} onClick={() => setZones(toggle(zones, v))}>{l}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PATTERNS.map(([v, l]) => <Chip key={v} active={patterns.includes(v)} onClick={() => setPatterns(toggle(patterns, v))}>{l}</Chip>)}
          </div>
        </Field>

        <Field label="Equipamiento disponible">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={equipmentMode === "any"} onClick={() => setEquipmentMode("any")}>Cualquiera</Chip>
            <Chip active={equipmentMode === "bodyweight"} onClick={() => setEquipmentMode("bodyweight")}>Solo peso corporal</Chip>
            <Chip active={equipmentMode === "pick"} onClick={() => setEquipmentMode("pick")}>Elegir</Chip>
          </div>
          {equipmentMode === "pick" && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(equipmentCatalog ?? []).map((eq) => (
                <Chip key={eq.id} active={equipmentIds.includes(eq.id)} onClick={() => setEquipmentIds(toggle(equipmentIds, eq.id))}>{eq.name}</Chip>
              ))}
            </div>
          )}
        </Field>

        <Field label="Limitaciones o lesiones" hint="opcional">
          <textarea rows={2} value={limitations} onChange={(e) => setLimitations(e.target.value)} maxLength={500} placeholder="Ej.: molestia en hombro derecho, evitar impacto" className={inputCls} />
        </Field>

        <Field label="Descripción" hint="lo que más mejora el resultado">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1500}
            placeholder="Ej.: grupo de 8 atletas en pretemporada, 2ª sesión de fuerza de la semana. Queremos priorizar sentadilla y peso muerto, con accesorios unilaterales. Tienen RM registrado en básicos."
            className={inputCls}
          />
        </Field>

        {generate.error && <p className="text-xs text-destructive">{generate.error.message}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground flex-1 min-w-[160px]">
            Detalle: <span className="font-semibold text-foreground">{detailLabel}</span>
            {replacesContent && " · reemplazará los ejercicios actuales (no se guarda hasta que pulses Guardar)"}
          </p>
          <button
            type="submit"
            disabled={!goal || generate.isPending || (equipmentMode === "pick" && equipmentIds.length === 0)}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors cursor-pointer"
          >
            {generate.isPending ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
            {generate.isPending ? "Generando… (hasta 1 min)" : "Generar propuesta"}
          </button>
        </div>
      </div>
    </form>
  )
}
