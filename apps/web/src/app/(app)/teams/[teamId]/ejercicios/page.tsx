"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FlameIcon,
  GlobeIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  VideoIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
import { useParams } from "next/navigation"
import { useRef, useState } from "react"

// ── Config ────────────────────────────────────────────────────────────────────

const ZONE_CONFIG = {
  upper:     { bar: "bg-teal-500",   label: "Superior",  pill: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  lower:     { bar: "bg-red-500",    label: "Inferior",  pill: "bg-red-500/10 text-red-600 border-red-500/20" },
  core:      { bar: "bg-amber-500",  label: "Core",      pill: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  full_body: { bar: "bg-violet-500", label: "Full body", pill: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
} as const

const DIFFICULTY_CONFIG = {
  beginner:     { label: "Principiante", pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  intermediate: { label: "Intermedio",   pill: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  advanced:     { label: "Avanzado",     pill: "bg-red-500/10 text-red-600 border-red-500/20" },
} as const

const PATTERN_LABELS: Record<string, string> = {
  push: "Empuje", pull: "Jalón", squat: "Sentadilla", hinge: "Bisagra",
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad",
}

const ALL_PATTERNS = ["push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility"] as const

// ── Types ─────────────────────────────────────────────────────────────────────

type MuscleEntry = { muscleId: string; role: "primary" | "secondary" }

type Exercise = {
  id: string
  name: string
  description: string | null
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  suitableFor: "warmup" | "evaluation" | null
  contraindications: string | null
  videoUrl?: string | null
  isPublic: boolean
  ownerUserId: string | null
  ownerTeamId: string | null
  editable: boolean
  muscles: { muscleId: string; muscleName: string; role: string; muscleGroupId: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core" }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

type FormState = {
  id?: string
  name: string
  description: string
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  suitableFor: "warmup" | "evaluation" | null
  contraindications: string
  videoUrl: string | null
  isPublic: boolean
  ownerType: "user" | "team"
  muscles: MuscleEntry[]
  equipment: string[]
}

const EMPTY_FORM: FormState = {
  name: "", description: "", difficulty: null, movementPatterns: [],
  suitableFor: null, contraindications: "", videoUrl: null,
  isPublic: false, ownerType: "user", muscles: [], equipment: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveBodyZone(muscles: { bodyZone: "upper" | "lower" | "core" }[]) {
  const zones = new Set(muscles.map((m) => m.bodyZone))
  if (zones.size === 0) return null
  if (zones.size === 1) return [...zones][0] as "upper" | "lower" | "core"
  return "full_body" as const
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EjerciciosPage() {
  const { teamId } = useParams<{ teamId: string }>()

  const { data: exercises, refetch } = trpc.exercises.listAllOwned.useQuery()
  const { data: teams } = trpc.teams.list.useQuery()
  const { data: muscleGroups } = trpc.exercises.listMuscleGroups.useQuery()
  const { data: equipmentList } = trpc.exercises.listEquipment.useQuery()

  const [form, setForm] = useState<FormState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const currentTeam = teams?.find((t) => t.team.id === teamId)
  const isCoach = currentTeam?.role === "coach"

  const createMutation = trpc.exercises.create.useMutation({ onSuccess: () => { refetch(); setForm(null) } })
  const updateMutation = trpc.exercises.update.useMutation({ onSuccess: () => { refetch(); setForm(null) } })
  const deleteMutation = trpc.exercises.delete.useMutation({ onSuccess: () => { refetch(); setDeleteConfirm(null) } })

  const personal = exercises?.filter((ex) => ex.ownerUserId !== null) ?? []
  const teamExercises = exercises?.filter((ex) => ex.ownerTeamId === teamId) ?? []

  function openCreate() {
    setForm({ ...EMPTY_FORM, ownerType: "user" })
  }

  function openEdit(ex: Exercise) {
    setForm({
      id: ex.id,
      name: ex.name,
      description: ex.description ?? "",
      difficulty: ex.difficulty ?? null,
      movementPatterns: ex.movementPatterns ?? [],
      suitableFor: ex.suitableFor ?? null,
      contraindications: ex.contraindications ?? "",
      videoUrl: ex.videoUrl ?? null,
      isPublic: ex.isPublic,
      ownerType: ex.ownerTeamId ? "team" : "user",
      muscles: ex.muscles.map((m) => ({ muscleId: m.muscleId, role: m.role as "primary" | "secondary" })),
      equipment: ex.equipment.map((e) => e.equipmentId),
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    const payload = {
      name: form.name,
      description: form.description || undefined,
      difficulty: form.difficulty ?? undefined,
      movementPatterns: form.movementPatterns as ("push" | "pull" | "squat" | "hinge" | "carry" | "rotation" | "isometric" | "mobility")[],
      suitableFor: form.suitableFor,
      contraindications: form.contraindications || undefined,
      videoUrl: form.videoUrl ?? undefined,
      isPublic: form.isPublic,
      muscles: form.muscles,
      equipment: form.equipment,
    }

    if (form.id) {
      updateMutation.mutate({ id: form.id, ...payload })
    } else {
      createMutation.mutate({
        ...payload,
        ownerType: form.ownerType,
        teamId: form.ownerType === "team" ? teamId : undefined,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ejercicios</h1>
        {!form && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo ejercicio
          </button>
        )}
      </div>

      {/* Form */}
      {form && (
        <ExerciseForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          isPending={isPending}
          isCoach={isCoach}
          currentTeamName={currentTeam?.team.name}
          muscleGroups={muscleGroups ?? []}
          equipmentList={equipmentList ?? []}
        />
      )}

      {/* Personal */}
      <Section
        title="Personales"
        exercises={personal}
        onEdit={openEdit}
        onDelete={setDeleteConfirm}
        deleteConfirm={deleteConfirm}
        onDeleteConfirm={(id) => deleteMutation.mutate({ id })}
        onDeleteCancel={() => setDeleteConfirm(null)}
        isDeleting={deleteMutation.isPending}
      />

      {/* Team */}
      {currentTeam && (
        <Section
          title={currentTeam.team.name}
          exercises={teamExercises}
          onEdit={openEdit}
          onDelete={setDeleteConfirm}
          deleteConfirm={deleteConfirm}
          onDeleteConfirm={(id) => deleteMutation.mutate({ id })}
          onDeleteCancel={() => setDeleteConfirm(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Exercise Form ─────────────────────────────────────────────────────────────

function ExerciseForm({
  form, setForm, onSubmit, isPending, isCoach, currentTeamName, muscleGroups, equipmentList,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  isCoach: boolean
  currentTeamName?: string
  muscleGroups: { id: string; name: string; bodyZone: "upper" | "lower" | "core"; muscles: { id: string; name: string }[] }[]
  equipmentList: { id: string; name: string }[]
}) {
  const set = (patch: Partial<FormState>) => setForm((f) => f && { ...f, ...patch })

  return (
    <form onSubmit={onSubmit} className="border border-border rounded-xl bg-card/60 overflow-hidden">

      {/* Form header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold">{form.id ? "Editar ejercicio" : "Nuevo ejercicio"}</p>
        <button type="button" onClick={() => setForm(null)} className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* ── Info básica ── */}
        <section className="space-y-3">
          <SectionLabel>Info básica</SectionLabel>
          <input
            autoFocus required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Nombre del ejercicio"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Descripción (opcional)"
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          {/* Difficulty */}
          <div className="flex gap-2">
            {(["beginner", "intermediate", "advanced"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set({ difficulty: form.difficulty === d ? null : d })}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-lg border transition-colors cursor-pointer",
                  form.difficulty === d
                    ? `${DIFFICULTY_CONFIG[d].pill} font-medium`
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {DIFFICULTY_CONFIG[d].label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Owner / Visibilidad ── */}
        <section className="space-y-3">
          <SectionLabel>Propiedad y visibilidad</SectionLabel>
          {!form.id && isCoach && (
            <div className="flex gap-2">
              {(["user", "team"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set({ ownerType: type })}
                  className={cn(
                    "flex-1 text-xs py-1.5 rounded-lg border transition-colors cursor-pointer",
                    form.ownerType === type
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {type === "user" ? "Personal" : "Del equipo"}
                </button>
              ))}
            </div>
          )}
          {!form.id && isCoach && form.ownerType === "team" && currentTeamName && (
            <p className="text-xs text-muted-foreground px-1">
              Se creará bajo <span className="text-foreground font-medium">{currentTeamName}</span>
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set({ isPublic: true })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border transition-colors cursor-pointer",
                form.isPublic ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <GlobeIcon className="w-3.5 h-3.5" /> Público
            </button>
            <button
              type="button"
              onClick={() => set({ isPublic: false })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border transition-colors cursor-pointer",
                !form.isPublic ? "bg-muted/60 border-border text-foreground font-medium" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <LockIcon className="w-3.5 h-3.5" /> Privado
            </button>
          </div>
        </section>

        {/* ── Músculos ── */}
        {muscleGroups.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Músculos</SectionLabel>
            <MuscleSelector
              value={form.muscles}
              onChange={(muscles) => set({ muscles })}
              muscleGroups={muscleGroups}
            />
          </section>
        )}

        {/* ── Equipamiento ── */}
        {equipmentList.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Equipamiento</SectionLabel>
            <EquipmentSelector
              value={form.equipment}
              onChange={(equipment) => set({ equipment })}
              equipmentList={equipmentList}
            />
          </section>
        )}

        {/* ── Patrones de movimiento ── */}
        <section className="space-y-3">
          <SectionLabel>Patrones de movimiento</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PATTERNS.map((p) => {
              const active = form.movementPatterns.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => set({
                    movementPatterns: active
                      ? form.movementPatterns.filter((x) => x !== p)
                      : [...form.movementPatterns, p],
                  })}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
                    active
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PATTERN_LABELS[p]}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Contexto ── */}
        <section className="space-y-3">
          <SectionLabel>Contexto de uso</SectionLabel>
          <div className="flex gap-2">
            <ToggleChip
              active={form.suitableFor === null}
              onClick={() => set({ suitableFor: null })}
            >
              General
            </ToggleChip>
            <ToggleChip
              active={form.suitableFor === "warmup"}
              onClick={() => set({ suitableFor: form.suitableFor === "warmup" ? null : "warmup" })}
              icon={<FlameIcon className="w-3.5 h-3.5" />}
            >
              Calentamiento
            </ToggleChip>
            <ToggleChip
              active={form.suitableFor === "evaluation"}
              onClick={() => set({ suitableFor: form.suitableFor === "evaluation" ? null : "evaluation" })}
              icon={<ZapIcon className="w-3.5 h-3.5" />}
            >
              Evaluación
            </ToggleChip>
          </div>
          <textarea
            value={form.contraindications}
            onChange={(e) => set({ contraindications: e.target.value })}
            placeholder="Contraindicaciones (opcional) — ej. lesión de rodilla, embarazo"
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </section>

        {/* ── Video ── */}
        <section className="space-y-3">
          <SectionLabel>Video de demostración</SectionLabel>
          <VideoUploader
            videoId={form.videoUrl}
            onChange={(id) => set({ videoUrl: id })}
          />
        </section>

      </div>

      {/* Form footer */}
      <div className="flex gap-2 justify-end px-5 py-4 border-t border-border bg-muted/10">
        <button
          type="button"
          onClick={() => setForm(null)}
          className="text-xs px-3 py-1.5 border border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !form.name.trim()}
          className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "Guardando..." : form.id ? "Guardar cambios" : "Crear ejercicio"}
        </button>
      </div>
    </form>
  )
}

// ── Muscle Selector ───────────────────────────────────────────────────────────

function MuscleSelector({
  value, onChange, muscleGroups,
}: {
  value: MuscleEntry[]
  onChange: (v: MuscleEntry[]) => void
  muscleGroups: { id: string; name: string; bodyZone: "upper" | "lower" | "core"; muscles: { id: string; name: string }[] }[]
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const selectedIds = new Set(value.map((m) => m.muscleId))

  function toggleMuscle(muscleId: string) {
    if (selectedIds.has(muscleId)) {
      onChange(value.filter((m) => m.muscleId !== muscleId))
    } else {
      onChange([...value, { muscleId, role: "primary" }])
    }
  }

  function toggleRole(muscleId: string) {
    onChange(value.map((m) =>
      m.muscleId === muscleId ? { ...m, role: m.role === "primary" ? "secondary" : "primary" } : m,
    ))
  }

  const muscleNameById = new Map(
    muscleGroups.flatMap((g) => g.muscles.map((m) => [m.id, m.name])),
  )

  return (
    <div className="space-y-2">
      {/* Accordion */}
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {muscleGroups.map((group) => {
          const zoneConf = ZONE_CONFIG[group.bodyZone]
          const isOpen = openGroupId === group.id
          const selectedInGroup = group.muscles.filter((m) => selectedIds.has(m.id)).length

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer text-left"
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", zoneConf.bar)} />
                <span className="text-sm font-medium flex-1">{group.name}</span>
                {selectedInGroup > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                    {selectedInGroup}
                  </span>
                )}
                {isOpen
                  ? <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                }
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 bg-muted/10">
                  {group.muscles.map((m) => {
                    const selected = selectedIds.has(m.id)
                    const entry = value.find((v) => v.muscleId === m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMuscle(m.id)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
                          selected
                            ? "bg-primary/10 border-primary text-primary font-medium"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.name}
                        {selected && entry && (
                          <span className="ml-1 opacity-60">{entry.role === "primary" ? "P" : "S"}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected summary with role toggle */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((entry) => (
            <div
              key={entry.muscleId}
              className="flex items-center gap-1 text-xs bg-card border border-border rounded-full pl-2.5 pr-1 py-0.5"
            >
              <span className="text-foreground">{muscleNameById.get(entry.muscleId)}</span>
              <button
                type="button"
                onClick={() => toggleRole(entry.muscleId)}
                title="Cambiar a primario/secundario"
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors",
                  entry.role === "primary"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {entry.role === "primary" ? "P" : "S"}
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((m) => m.muscleId !== entry.muscleId))}
                className="p-0.5 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Equipment Selector ────────────────────────────────────────────────────────

function EquipmentSelector({
  value, onChange, equipmentList,
}: {
  value: string[]
  onChange: (v: string[]) => void
  equipmentList: { id: string; name: string }[]
}) {
  const selected = new Set(value)

  function toggle(id: string) {
    if (selected.has(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {equipmentList.map((eq) => {
        const active = selected.has(eq.id)
        return (
          <button
            key={eq.id}
            type="button"
            onClick={() => toggle(eq.id)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
              active
                ? "bg-primary/10 border-primary text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {eq.name}
          </button>
        )
      })}
    </div>
  )
}

// ── Video Uploader ────────────────────────────────────────────────────────────

const CF_SUBDOMAIN = process.env.NEXT_PUBLIC_CF_ACCOUNT_HASH // optional, for thumbnail preview

function VideoUploader({ videoId, onChange }: { videoId: string | null; onChange: (id: string | null) => void }) {
  const getUploadUrl = trpc.exercises.getVideoUploadUrl.useMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/")) return
    setUploading(true)
    setProgress(0)
    try {
      const { uploadUrl, uid } = await getUploadUrl.mutateAsync()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => xhr.status < 400 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error("Network error"))
        xhr.open("POST", uploadUrl)
        const fd = new FormData()
        fd.append("file", file)
        xhr.send(fd)
      })

      onChange(uid)
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  if (videoId) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <iframe
            src={`https://iframe.videodelivery.net/${videoId}`}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer transition-colors"
        >
          <XIcon className="w-3.5 h-3.5" /> Quitar video
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {uploading ? (
        <div className="border border-border rounded-lg px-4 py-5 space-y-2">
          <p className="text-xs text-muted-foreground">Subiendo video... {progress}%</p>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-dashed border-border rounded-lg px-4 py-5 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <UploadIcon className="w-4 h-4" />
            <VideoIcon className="w-4 h-4" />
          </div>
          <p className="text-xs">Subir video o grabar desde cámara</p>
          <p className="text-[10px] text-muted-foreground/60">MP4, MOV, WebM — máx. 5 min</p>
        </button>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
}

function ToggleChip({
  active, onClick, icon, children,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border transition-colors cursor-pointer",
        active ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {children}
    </button>
  )
}

// ── Section + Card ────────────────────────────────────────────────────────────

type EnrichedExercise = {
  id: string
  name: string
  description: string | null
  difficulty: "beginner" | "intermediate" | "advanced" | null
  movementPatterns: string[]
  suitableFor: "warmup" | "evaluation" | null
  contraindications: string | null
  videoUrl: string | null
  isPublic: boolean
  ownerUserId: string | null
  ownerTeamId: string | null
  editable: boolean
  muscles: { muscleId: string; muscleName: string; role: "primary" | "secondary"; muscleGroupId: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core" }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

function Section({
  title, exercises, onEdit, onDelete, deleteConfirm, onDeleteConfirm, onDeleteCancel, isDeleting,
}: {
  title: string
  exercises: EnrichedExercise[]
  onEdit: (ex: EnrichedExercise) => void
  onDelete: (id: string) => void
  deleteConfirm: string | null
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
  isDeleting: boolean
}) {
  if (exercises.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-1.5">
        {exercises.map((ex) =>
          deleteConfirm === ex.id ? (
            <div key={ex.id} className="flex items-center justify-between border rounded-xl px-4 py-3 bg-destructive/5 border-destructive/30">
              <p className="text-sm text-destructive">¿Eliminar <span className="font-medium">{ex.name}</span>?</p>
              <div className="flex gap-2">
                <button onClick={onDeleteCancel} className="text-xs px-2.5 py-1 border border-border rounded-lg cursor-pointer">Cancelar</button>
                <button onClick={() => onDeleteConfirm(ex.id)} disabled={isDeleting} className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 cursor-pointer">Eliminar</button>
              </div>
            </div>
          ) : (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ),
        )}
      </div>
    </div>
  )
}

function ExerciseCard({ exercise: ex, onEdit, onDelete }: {
  exercise: EnrichedExercise
  onEdit: (ex: EnrichedExercise) => void
  onDelete: (id: string) => void
}) {
  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <div className="overflow-hidden border border-border rounded-xl hover:border-border/80 transition-colors">
    <div className="flex hover:bg-muted/10 transition-colors">
      {/* Zone color bar */}
      <div className={cn("w-1 shrink-0", zoneConf?.bar ?? "bg-border")} />

      <div className="flex-1 min-w-0 px-4 py-3">
        {/* Name + visibility */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{ex.name}</p>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {ex.isPublic
              ? <GlobeIcon className="w-3.5 h-3.5 text-muted-foreground" />
              : <LockIcon className="w-3.5 h-3.5 text-muted-foreground" />
            }
            {ex.editable && (
              <>
                <button onClick={() => onEdit(ex)} className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer">
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(ex.id)} className="p-1 text-muted-foreground hover:text-destructive rounded cursor-pointer">
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {ex.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.description}</p>
        )}

        {/* Pills row */}
        {(primaryMuscles.length > 0 || ex.movementPatterns.length > 0 || ex.difficulty || ex.suitableFor) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {/* Zone pill */}
            {zoneConf && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", zoneConf.pill)}>
                {zoneConf.label}
              </span>
            )}
            {/* Primary muscles (max 2) */}
            {primaryMuscles.slice(0, 2).map((m) => (
              <span key={m.muscleId} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">
                {m.muscleName}
              </span>
            ))}
            {primaryMuscles.length > 2 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">
                +{primaryMuscles.length - 2}
              </span>
            )}
            {/* Difficulty */}
            {ex.difficulty && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", DIFFICULTY_CONFIG[ex.difficulty].pill)}>
                {DIFFICULTY_CONFIG[ex.difficulty].label}
              </span>
            )}
            {/* Movement patterns (max 2) */}
            {ex.movementPatterns.slice(0, 2).map((p) => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                {PATTERN_LABELS[p] ?? p}
              </span>
            ))}
            {/* Context badge */}
            {ex.suitableFor === "warmup" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-600 flex items-center gap-0.5">
                <FlameIcon className="w-2.5 h-2.5" /> Calentamiento
              </span>
            )}
            {ex.suitableFor === "evaluation" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary flex items-center gap-0.5">
                <ZapIcon className="w-2.5 h-2.5" /> Evaluación
              </span>
            )}
            {/* Video badge */}
            {ex.videoUrl && (
              <button
                onClick={() => setVideoOpen((v) => !v)}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground flex items-center gap-0.5 cursor-pointer hover:text-foreground transition-colors"
              >
                <PlayIcon className="w-2.5 h-2.5" /> Video
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Inline video player */}
    {ex.videoUrl && videoOpen && (
      <div className="border-t border-border bg-black aspect-video">
        <iframe
          src={`https://iframe.videodelivery.net/${ex.videoUrl}`}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    )}
    </div>
  )
}
