"use client"

import { ExerciseDetailSheet, type ExerciseDetail } from "@/components/exercise-detail-sheet"
import { ExerciseFinderBar, FinderEmptyResults, useExerciseFinder } from "@/components/exercise-finder"
import { YouTubePlayer, YouTubeThumb } from "@/components/youtube-player"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { isShortsUrl, parseYoutubeId, youtubeWatchUrl } from "@atleta/db/youtube"
import {
  AlertTriangleIcon,
  BookmarkIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardPasteIcon,
  FlameIcon,
  GlobeIcon,
  LoaderIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
  VideoIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

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
  carry: "Cargada", rotation: "Rotación", isometric: "Isométrico", mobility: "Movilidad", core: "Core",
}

const ALL_PATTERNS = ["push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility", "core"] as const
type Orientation = "horizontal" | "vertical"

// Pestañas de la colección; la búsqueda y los filtros viven en @/components/exercise-finder
type CollectionView = "todos" | "propios" | "guardados"

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
  youtubeVideoId?: string | null
  youtubeTitle?: string | null
  videoOrientation?: Orientation
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
  youtubeVideoId: string | null
  youtubeTitle: string | null
  videoOrientation: Orientation
  isPublic: boolean
  ownerType: "user" | "team"
  muscles: MuscleEntry[]
  equipment: string[]
}

const EMPTY_FORM: FormState = {
  name: "", description: "", difficulty: null, movementPatterns: [],
  suitableFor: null, contraindications: "",
  youtubeVideoId: null, youtubeTitle: null, videoOrientation: "horizontal",
  isPublic: true, ownerType: "user", muscles: [], equipment: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveBodyZone(muscles: { bodyZone: "upper" | "lower" | "core"; role: string }[]) {
  const zones = new Set(muscles.filter((m) => m.role === "primary").map((m) => m.bodyZone))
  if (zones.size === 0) return null
  if (zones.size === 1) return [...zones][0] as "upper" | "lower" | "core"
  return "full_body" as const
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EjerciciosPage() {
  const { teamId } = useParams<{ teamId: string }>()
  // "Todos" por defecto: los guardados también cuentan para llegar a un ejercicio en ≤3 toques
  const [view, setView] = useState<CollectionView>("todos")

  const { data: exercises, refetch } = trpc.exercises.listAllOwned.useQuery()
  const { data: saved, refetch: refetchSaved } = trpc.exercises.listSaved.useQuery()
  const { data: teams } = trpc.teams.list.useQuery()
  const { data: muscleGroups } = trpc.exercises.listMuscleGroups.useQuery()
  const { data: equipmentList } = trpc.exercises.listEquipment.useQuery()

  const [form, setForm] = useState<FormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [detailExercise, setDetailExercise] = useState<ExerciseDetail | null>(null)

  const currentTeam = teams?.find((t) => t.team.id === teamId)
  const isCoach = currentTeam?.role === "coach"

  const createMutation = trpc.exercises.create.useMutation({ onSuccess: () => { refetch(); setForm(null) } })
  const updateMutation = trpc.exercises.update.useMutation({ onSuccess: () => { refetch(); setForm(null) } })
  const deleteMutation = trpc.exercises.delete.useMutation({ onSuccess: () => { refetch(); setDeleteTarget(null) } })
  const unsaveMutation = trpc.exercises.unsaveExercise.useMutation({ onSuccess: () => refetchSaved() })

  const personal = exercises?.filter((ex) => ex.ownerUserId !== null) ?? []
  const teamExercises = exercises?.filter((ex) => ex.ownerTeamId === teamId) ?? []
  const savedList = saved ?? []

  const ownedIds = new Set([...personal, ...teamExercises].map((ex) => ex.id))
  const savedOnly = savedList.filter((ex) => !ownedIds.has(ex.id))

  const pool: EnrichedExercise[] =
    view === "propios"   ? [...personal, ...teamExercises] :
    view === "guardados" ? savedList :
                           [...personal, ...teamExercises, ...savedOnly]

  // Un solo buscador para las tres pestañas: los filtros no se pierden al cambiar de vista
  const finder = useExerciseFinder(pool)
  const results = finder.results

  const personalResults = results.filter((ex) => ex.ownerUserId !== null)
  const teamResults = results.filter((ex) => ex.ownerTeamId === teamId)
  const savedResults = view === "guardados" ? results : results.filter((ex) => !ownedIds.has(ex.id))

  const deleteHandler = (ex: EnrichedExercise) => setDeleteTarget({ id: ex.id, name: ex.name })

  function openCreate() { setForm({ ...EMPTY_FORM, ownerType: "user" }) }

  function openEdit(ex: Exercise) {
    setForm({
      id: ex.id,
      name: ex.name,
      description: ex.description ?? "",
      difficulty: ex.difficulty ?? null,
      movementPatterns: ex.movementPatterns ?? [],
      suitableFor: ex.suitableFor ?? null,
      contraindications: ex.contraindications ?? "",
      youtubeVideoId: ex.youtubeVideoId ?? null,
      youtubeTitle: ex.youtubeTitle ?? null,
      videoOrientation: ex.videoOrientation ?? "horizontal",
      isPublic: ex.isPublic,
      ownerType: ex.ownerTeamId ? "team" : "user",
      muscles: ex.muscles.map((m) => ({ muscleId: m.muscleId, role: m.role as "primary" | "secondary" })),
      equipment: ex.equipment.map((e) => e.equipmentId),
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    const patterns = form.movementPatterns as ("push" | "pull" | "squat" | "hinge" | "carry" | "rotation" | "isometric" | "mobility")[]

    if (form.id) {
      updateMutation.mutate({
        id: form.id,
        name: form.name,
        description: form.description || undefined,
        difficulty: form.difficulty ?? undefined,
        movementPatterns: patterns,
        suitableFor: form.suitableFor,
        youtubeVideoId: form.youtubeVideoId,   // null = quitar video
        youtubeTitle: form.youtubeTitle,
        videoOrientation: form.videoOrientation,
        isPublic: form.isPublic,
        muscles: form.muscles,
        equipment: form.equipment,
        contraindications: form.contraindications || null,
      })
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        difficulty: form.difficulty ?? undefined,
        movementPatterns: patterns,
        suitableFor: form.suitableFor,
        youtubeVideoId: form.youtubeVideoId ?? undefined,
        youtubeTitle: form.youtubeTitle ?? undefined,
        videoOrientation: form.videoOrientation,
        isPublic: form.isPublic,
        muscles: form.muscles,
        equipment: form.equipment,
        contraindications: form.contraindications || undefined,
        ownerType: form.ownerType,
        teamId: form.ownerType === "team" ? teamId : undefined,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Mis ejercicios</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 h-11 rounded-xl cursor-pointer font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      <CollectionTabs
        view={view}
        onChange={setView}
        counts={{
          todos: personal.length + teamExercises.length + savedOnly.length,
          propios: personal.length + teamExercises.length,
          guardados: savedList.length,
        }}
      />

      {pool.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">
            {view === "todos" && "Aún no tienes ejercicios. Crea uno o guarda ejercicios desde Explorar."}
            {view === "propios" && "Aún no has creado ejercicios."}
            {view === "guardados" && "No tienes ejercicios guardados. Explora el catálogo para guardar."}
          </p>
          {view !== "guardados" && (
            <button onClick={openCreate} className="text-sm text-primary font-medium hover:underline cursor-pointer">
              Crear ejercicio
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-4 min-w-0">
            {/* Buscador + botón Filtros; los filtros se eligen en un panel aparte */}
            <ExerciseFinderBar finder={finder} />

            {results.length === 0 ? (
              <FinderEmptyResults finder={finder} />
            ) : (
              <div className="space-y-6">
                {view !== "guardados" && (
                  <>
                    <Section title="Personales" exercises={personalResults} onEdit={openEdit} onDelete={deleteHandler} onOpen={setDetailExercise} />
                    <Section title={currentTeam?.team.name ?? "Equipo"} exercises={teamResults} onEdit={openEdit} onDelete={deleteHandler} onOpen={setDetailExercise} />
                  </>
                )}
                {view !== "propios" && savedResults.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Guardados <span className="tabular-nums">· {savedResults.length}</span>
                    </h2>
                    <div className="space-y-1.5">
                      {savedResults.map((ex) => (
                        <ExerciseCard
                          key={ex.id}
                          exercise={ex}
                          onEdit={() => {}}
                          onDelete={() => {}}
                          onOpen={setDetailExercise}
                          savedBadge
                          onUnsave={() => unsaveMutation.mutate({ exerciseId: ex.id })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sheet overlay */}
      {form && (
        <ExerciseSheet
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

      {/* Detail sheet (read-only, no bookmark) */}
      {detailExercise && (
        <ExerciseDetailSheet
          exercise={detailExercise}
          onClose={() => setDetailExercise(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
            <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="space-y-1.5">
                <p className="text-base font-semibold">Eliminar ejercicio</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">{deleteTarget.name}</span> dejará de estar disponible
                  para nuevas rutinas. El historial de entrenamientos se conserva.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 text-sm py-2.5 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
                  disabled={deleteMutation.isPending}
                  className="flex-1 text-sm bg-destructive text-destructive-foreground py-2.5 rounded-xl disabled:opacity-50 cursor-pointer font-medium transition-opacity"
                >
                  {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Exercise Sheet ────────────────────────────────────────────────────────────

type MuscleGroupData = { id: string; name: string; bodyZone: "upper" | "lower" | "core"; muscles: { id: string; name: string }[] }

function ExerciseSheet({
  form, setForm, onSubmit, isPending, isCoach, currentTeamName, muscleGroups, equipmentList,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>
  onSubmit: (e: React.FormEvent) => void
  isPending: boolean
  isCoach: boolean
  currentTeamName?: string
  muscleGroups: MuscleGroupData[]
  equipmentList: { id: string; name: string }[]
}) {
  const set = (patch: Partial<FormState>) => setForm((f) => f && { ...f, ...patch })
  const [visible, setVisible] = useState(false)
  const [aiHighlight, setAiHighlight] = useState(false)
  const [aiFilledSections, setAiFilledSections] = useState<string[]>([])

  const autofillMutation = trpc.exercises.autofill.useMutation({
    onSuccess: (data) => {
      const filled: string[] = []
      const patch: Partial<FormState> = {}

      if (data.difficulty) { patch.difficulty = data.difficulty }
      if (data.movementPatterns?.length) { patch.movementPatterns = data.movementPatterns; filled.push("patterns") }
      if (data.suitableFor !== undefined) { patch.suitableFor = data.suitableFor; filled.push("context") }
      if (data.muscles?.length) { patch.muscles = data.muscles; filled.push("muscles") }
      if (data.equipment?.length) { patch.equipment = data.equipment; filled.push("equipment") }

      set(patch)
      setAiFilledSections(filled)
      setAiHighlight(true)
      setTimeout(() => setAiHighlight(false), 2000)
    },
  })

  function handleAutofill() {
    if (!form.name.trim()) return
    autofillMutation.mutate({ name: form.name, description: form.description || undefined })
  }

  // Animate in on mount
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function close() {
    setVisible(false)
    setTimeout(() => setForm(null), 300)
  }

  // Muscle summary for collapsed header
  const muscleNameById = new Map(muscleGroups.flatMap((g) => g.muscles.map((m) => [m.id, m.name])))
  function muscleSummary() {
    if (form.muscles.length === 0) return null
    const names = form.muscles.slice(0, 2).map((m) => muscleNameById.get(m.muscleId) ?? "")
    return names.join(", ") + (form.muscles.length > 2 ? ` +${form.muscles.length - 2}` : "")
  }
  function equipmentSummary() {
    if (form.equipment.length === 0) return null
    const map = new Map(equipmentList.map((e) => [e.id, e.name]))
    const names = form.equipment.slice(0, 2).map((id) => map.get(id) ?? "")
    return names.join(", ") + (form.equipment.length > 2 ? ` +${form.equipment.length - 2}` : "")
  }
  function patternSummary() {
    if (form.movementPatterns.length === 0) return null
    return form.movementPatterns.slice(0, 2).map((p) => PATTERN_LABELS[p] ?? p).join(", ")
      + (form.movementPatterns.length > 2 ? ` +${form.movementPatterns.length - 2}` : "")
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Sheet — bottom on mobile, right side on md+ */}
      <div
        className={cn(
          "fixed z-50 bg-background flex flex-col",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 rounded-t-2xl max-h-[92dvh]",
          // Desktop: right panel
          "md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[480px] md:rounded-none md:rounded-l-2xl md:max-h-full md:h-full",
          "transition-transform duration-300 ease-out",
          visible
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-x-full md:translate-y-0",
        )}
      >
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">

          {/* Drag handle (mobile only) */}
          <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <p className="text-base font-semibold">{form.id ? "Editar ejercicio" : "Nuevo ejercicio"}</p>
            <button type="button" onClick={close} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-2">

            {/* ── Video de YouTube (lo primero: al pegarlo se sugiere el nombre) ── */}
            <div className="pb-4 border-b border-border">
              <YoutubeField form={form} set={set} />
            </div>

            {/* ── Nombre + descripción (siempre visible) ── */}
            <div className="space-y-3 pb-4 border-b border-border">
              <input
                required
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Nombre del ejercicio"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Descripción (opcional)"
                rows={2}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              {/* AI autofill */}
              <button
                type="button"
                onClick={handleAutofill}
                disabled={!form.name.trim() || autofillMutation.isPending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl border transition-colors cursor-pointer",
                  autofillMutation.isPending
                    ? "border-primary/30 text-primary/60 bg-primary/5 cursor-wait"
                    : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10",
                  !form.name.trim() && "opacity-40 pointer-events-none",
                )}
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                {autofillMutation.isPending ? "Analizando con IA..." : "Completar con IA"}
              </button>
              {autofillMutation.isError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XIcon className="w-3 h-3" /> Error al analizar el ejercicio
                </p>
              )}
              {/* Dificultad */}
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ difficulty: form.difficulty === d ? null : d })}
                    className={cn(
                      "flex-1 text-xs py-2 rounded-xl border transition-colors cursor-pointer",
                      form.difficulty === d ? `${DIFFICULTY_CONFIG[d].pill} font-medium` : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {DIFFICULTY_CONFIG[d].label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Propiedad (si es coach y nuevo ejercicio) ── */}
            {!form.id && isCoach && (
              <CollapsibleSection
                label="Propiedad"
                summary={form.ownerType === "team" && currentTeamName ? currentTeamName : "Personal"}
              >
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(["user", "team"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set({ ownerType: type })}
                        className={cn(
                          "flex-1 text-xs py-2 rounded-xl border transition-colors cursor-pointer",
                          form.ownerType === type ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {type === "user" ? "Personal" : "Del equipo"}
                      </button>
                    ))}
                  </div>
                  {form.ownerType === "team" && currentTeamName && (
                    <p className="text-xs text-muted-foreground px-1">
                      Se creará bajo <span className="text-foreground font-medium">{currentTeamName}</span>
                    </p>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* ── Visibilidad ── */}
            <CollapsibleSection
              label="Visibilidad"
              summary={form.isPublic ? "Público" : "Privado"}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set({ isPublic: true })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border transition-colors cursor-pointer",
                    form.isPublic ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <GlobeIcon className="w-3.5 h-3.5" /> Público
                </button>
                <button
                  type="button"
                  onClick={() => set({ isPublic: false })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border transition-colors cursor-pointer",
                    !form.isPublic ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LockIcon className="w-3.5 h-3.5" /> Privado
                </button>
              </div>
            </CollapsibleSection>

            {/* ── Músculos ── */}
            <CollapsibleSection
              label="Músculos"
              summary={muscleSummary()}
              badge={form.muscles.length > 0 ? form.muscles.length : undefined}
              forceOpen={aiFilledSections.includes("muscles")}
              highlight={aiHighlight && aiFilledSections.includes("muscles")}
            >
              <MuscleSelector value={form.muscles} onChange={(muscles) => set({ muscles })} muscleGroups={muscleGroups} />
            </CollapsibleSection>

            {/* ── Equipamiento ── */}
            <CollapsibleSection
              label="Equipamiento"
              summary={equipmentSummary()}
              badge={form.equipment.length > 0 ? form.equipment.length : undefined}
              forceOpen={aiFilledSections.includes("equipment")}
              highlight={aiHighlight && aiFilledSections.includes("equipment")}
            >
              <EquipmentSelector value={form.equipment} onChange={(equipment) => set({ equipment })} equipmentList={equipmentList} />
            </CollapsibleSection>

            {/* ── Patrones de movimiento ── */}
            <CollapsibleSection
              label="Patrones de movimiento"
              summary={patternSummary()}
              badge={form.movementPatterns.length > 0 ? form.movementPatterns.length : undefined}
              forceOpen={aiFilledSections.includes("patterns")}
              highlight={aiHighlight && aiFilledSections.includes("patterns")}
            >
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
                        "text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer",
                        active ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {PATTERN_LABELS[p]}
                    </button>
                  )
                })}
              </div>
            </CollapsibleSection>

            {/* ── Contexto ── */}
            <CollapsibleSection
              label="Contexto de uso"
              summary={form.suitableFor === "warmup" ? "Calentamiento" : form.suitableFor === "evaluation" ? "Evaluación" : form.contraindications ? "Con contraindicaciones" : null}
              forceOpen={aiFilledSections.includes("context")}
              highlight={aiHighlight && aiFilledSections.includes("context")}
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  {([
                    { value: null,         label: "General",        icon: null },
                    { value: "warmup",     label: "Calentamiento",  icon: <FlameIcon className="w-3.5 h-3.5" /> },
                    { value: "evaluation", label: "Evaluación",     icon: <ZapIcon className="w-3.5 h-3.5" /> },
                  ] as const).map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => set({ suitableFor: opt.value })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border transition-colors cursor-pointer",
                        form.suitableFor === opt.value ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={form.contraindications}
                  onChange={(e) => set({ contraindications: e.target.value })}
                  placeholder="Contraindicaciones (opcional)"
                  rows={2}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </CollapsibleSection>

          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-border bg-background shrink-0">
            <button
              type="button"
              onClick={close}
              className="flex-1 text-sm py-2.5 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="flex-1 text-sm bg-primary text-primary-foreground py-2.5 rounded-xl disabled:opacity-50 cursor-pointer font-medium"
            >
              {isPending ? "Guardando..." : form.id ? "Guardar cambios" : "Crear ejercicio"}
            </button>
          </div>

        </form>
      </div>
    </>
  )
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function CollapsibleSection({
  label, summary, badge, children, defaultOpen = false, forceOpen, highlight,
}: {
  label: string
  summary?: string | null
  badge?: number
  children: React.ReactNode
  defaultOpen?: boolean
  forceOpen?: boolean
  highlight?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => { if (forceOpen) setOpen(true) }, [forceOpen])

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-colors duration-500",
      highlight ? "border-primary/50 ring-1 ring-primary/30" : "border-border",
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer text-left"
      >
        <span className="flex-1 text-sm font-medium">{label}</span>
        {badge !== undefined && (
          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium tabular-nums">{badge}</span>
        )}
        {!open && summary && (
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{summary}</span>
        )}
        {open
          ? <ChevronDownIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Muscle Selector ───────────────────────────────────────────────────────────

function MuscleSelector({ value, onChange, muscleGroups }: {
  value: MuscleEntry[]
  onChange: (v: MuscleEntry[]) => void
  muscleGroups: MuscleGroupData[]
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const selectedIds = new Set(value.map((m) => m.muscleId))

  function toggleMuscle(muscleId: string) {
    if (selectedIds.has(muscleId)) onChange(value.filter((m) => m.muscleId !== muscleId))
    else onChange([...value, { muscleId, role: "primary" }])
  }

  function toggleRole(muscleId: string) {
    onChange(value.map((m) => m.muscleId === muscleId ? { ...m, role: m.role === "primary" ? "secondary" : "primary" } : m))
  }

  const muscleNameById = new Map(muscleGroups.flatMap((g) => g.muscles.map((m) => [m.id, m.name])))

  return (
    <div className="space-y-3">
      {/* Group accordion */}
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
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
                <span className="text-sm flex-1">{group.name}</span>
                {selectedInGroup > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{selectedInGroup}</span>
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
                          selected ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.name}{selected && entry && <span className="ml-1 opacity-60">{entry.role === "primary" ? " P" : " S"}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected chips with role toggle */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((entry) => (
            <div key={entry.muscleId} className="flex items-center gap-1 text-xs bg-card border border-border rounded-full pl-2.5 pr-1 py-0.5">
              <span>{muscleNameById.get(entry.muscleId)}</span>
              <button
                type="button"
                onClick={() => toggleRole(entry.muscleId)}
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors",
                  entry.role === "primary" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
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

function EquipmentSelector({ value, onChange, equipmentList }: {
  value: string[]
  onChange: (v: string[]) => void
  equipmentList: { id: string; name: string }[]
}) {
  const [filter, setFilter] = useState("")
  const selected = new Set(value)
  const filtered = filter.trim()
    ? equipmentList.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
    : equipmentList

  function toggle(id: string) {
    if (selected.has(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div className="space-y-2">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar equipamiento..."
        className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((eq) => {
          const active = selected.has(eq.id)
          return (
            <button
              key={eq.id}
              type="button"
              onClick={() => toggle(eq.id)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-full border transition-colors cursor-pointer",
                active ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {eq.name}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">Sin resultados</p>
        )}
      </div>
    </div>
  )
}

// ── YouTube Field ─────────────────────────────────────────────────────────────

type YoutubeStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; title: string | null; verified: boolean }
  | { kind: "error"; message: string }

const RESOLVE_ERRORS = {
  invalid_url: "Ese enlace no parece de YouTube. Copia la dirección del video y pégala aquí.",
  not_found: "No encontramos ese video. Puede ser privado o haber sido eliminado.",
  not_embeddable: "El autor de este video no permite verlo fuera de YouTube. Elige otro.",
} as const

function YoutubeField({ form, set }: { form: FormState; set: (patch: Partial<FormState>) => void }) {
  const resolve = trpc.exercises.resolveYoutube.useMutation()
  const [url, setUrl] = useState(form.youtubeVideoId ? youtubeWatchUrl(form.youtubeVideoId) : "")
  const [status, setStatus] = useState<YoutubeStatus>(
    form.youtubeVideoId ? { kind: "ok", title: form.youtubeTitle, verified: true } : { kind: "idle" },
  )
  // Al editar un ejercicio existente no se vuelve a resolver (respeta la orientación elegida)
  const skipInitial = useRef(!!form.youtubeVideoId)
  const latest = useRef("")
  const nameRef = useRef(form.name)
  nameRef.current = form.name

  useEffect(() => {
    if (skipInitial.current) { skipInitial.current = false; return }
    const value = url.trim()
    latest.current = value
    if (!value) return

    const id = parseYoutubeId(value)
    if (!id) {
      setStatus({ kind: "error", message: RESOLVE_ERRORS.invalid_url })
      return
    }

    // Vista previa inmediata; la verificación llega después
    set({ youtubeVideoId: id, ...(isShortsUrl(value) ? { videoOrientation: "vertical" as const } : {}) })
    setStatus({ kind: "checking" })

    const timer = setTimeout(async () => {
      try {
        const r = await resolve.mutateAsync({ url: value })
        if (latest.current !== value) return
        if (!r.ok) {
          set({ youtubeVideoId: null, youtubeTitle: null })
          setStatus({ kind: "error", message: RESOLVE_ERRORS[r.reason] })
          return
        }
        set({
          youtubeVideoId: r.videoId,
          youtubeTitle: r.title,
          videoOrientation: r.orientation,
          ...(!nameRef.current.trim() && r.title ? { name: r.title } : {}),
        })
        setStatus({ kind: "ok", title: r.title, verified: r.verified })
      } catch {
        if (latest.current === value) setStatus({ kind: "ok", title: null, verified: false })
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  function handleChange(value: string) {
    setUrl(value)
    if (!value.trim()) {
      latest.current = ""
      set({ youtubeVideoId: null, youtubeTitle: null })
      setStatus({ kind: "idle" })
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) handleChange(text)
    } catch { /* permiso denegado: el coach puede pegar a mano */ }
  }

  return (
    <div className="space-y-3">
      <label htmlFor="youtube-url" className="text-sm font-medium flex items-center gap-1.5">
        <VideoIcon className="w-4 h-4 text-primary" /> Video de YouTube
      </label>
      <div className="flex gap-2">
        <input
          id="youtube-url"
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          inputMode="url"
          autoComplete="off"
          placeholder="Pega aquí el enlace del video"
          className="flex-1 min-w-0 border border-border rounded-xl px-4 py-3 text-sm bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={paste}
          className="shrink-0 flex items-center gap-1.5 px-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ClipboardPasteIcon className="w-4 h-4" /> Pegar
        </button>
      </div>

      {status.kind === "checking" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <LoaderIcon className="w-3.5 h-3.5 animate-spin" /> Comprobando el video…
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {status.message}
        </p>
      )}

      {form.youtubeVideoId && status.kind !== "error" ? (
        <div className="space-y-2.5">
          <YouTubePlayer
            videoId={form.youtubeVideoId}
            title={form.youtubeTitle ?? form.name}
            orientation={form.videoOrientation}
            compact
          />
          {status.kind === "ok" && (
            <p className="text-xs flex items-start gap-1.5">
              {status.verified
                ? <CheckCircle2Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
                : <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />}
              <span className={status.verified ? "" : "text-muted-foreground"}>
                {status.verified ? (status.title ?? "Video verificado") : "No pudimos comprobar el video ahora; se guardará igual."}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Formato:</span>
            {(["horizontal", "vertical"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => set({ videoOrientation: o })}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer",
                  form.videoOrientation === o ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {o === "horizontal" ? "Horizontal" : "Vertical (Short)"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleChange("")}
              className="ml-auto text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5" /> Quitar
            </button>
          </div>
        </div>
      ) : status.kind === "idle" && (
        <p className="text-[11px] text-muted-foreground">
          Acepta enlaces normales, Shorts y youtu.be. El video no se sube: se reproduce desde YouTube.
        </p>
      )}
    </div>
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
  youtubeVideoId: string | null
  youtubeTitle: string | null
  videoOrientation: Orientation
  isPublic: boolean
  ownerUserId: string | null
  ownerTeamId: string | null
  editable: boolean
  authorName: string | null
  muscles: { muscleId: string; muscleName: string; role: "primary" | "secondary"; muscleGroupId: string; muscleGroupName: string; bodyZone: "upper" | "lower" | "core" }[]
  equipment: { equipmentId: string; equipmentName: string }[]
}

function Section({ title, exercises, onEdit, onDelete, onOpen }: {
  title: string
  exercises: EnrichedExercise[]
  onEdit: (ex: EnrichedExercise) => void
  onDelete: (ex: EnrichedExercise) => void
  onOpen: (ex: EnrichedExercise) => void
}) {
  if (exercises.length === 0) return null
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-1.5">
        {exercises.map((ex) => (
          <ExerciseCard key={ex.id} exercise={ex} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function ExerciseCard({ exercise: ex, onEdit, onDelete, onOpen, savedBadge, onUnsave }: {
  exercise: EnrichedExercise
  onEdit: (ex: EnrichedExercise) => void
  onDelete: (ex: EnrichedExercise) => void
  onOpen?: (ex: EnrichedExercise) => void
  savedBadge?: boolean
  onUnsave?: () => void
}) {
  const zone = deriveBodyZone(ex.muscles)
  const zoneConf = zone ? ZONE_CONFIG[zone] : null
  const primaryMuscles = ex.muscles.filter((m) => m.role === "primary")

  return (
    <div
      onClick={() => onOpen?.(ex)}
      className={cn("overflow-hidden border border-border rounded-xl hover:border-border/80 transition-colors", onOpen && "cursor-pointer")}
    >
      <div className="flex hover:bg-muted/10 transition-colors">
        <div className={cn("w-1 shrink-0", zoneConf?.bar ?? "bg-border")} />
        {ex.youtubeVideoId ? (
          <YouTubeThumb
            videoId={ex.youtubeVideoId}
            alt={ex.name}
            orientation={ex.videoOrientation}
            showPlay
            className="w-24 sm:w-28 aspect-video shrink-0 self-center ml-3 rounded-lg"
          />
        ) : (
          <div className="w-24 sm:w-28 aspect-video shrink-0 self-center ml-3 rounded-lg bg-muted/40 flex items-center justify-center">
            <VideoIcon className="w-4 h-4 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{ex.name}</p>
              {ex.authorName && (
                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 mt-0.5">
                  <UserIcon className="w-2.5 h-2.5 shrink-0" />{ex.authorName}
                </p>
              )}
            </div>
            <div className="flex items-center shrink-0 -mt-2 -mr-2" onClick={(e) => e.stopPropagation()}>
              {savedBadge ? (
                <button
                  onClick={onUnsave}
                  className="w-11 h-11 flex items-center justify-center text-primary hover:text-muted-foreground rounded-lg cursor-pointer transition-colors"
                  title="Quitar de guardados"
                  aria-label={`Quitar ${ex.name} de guardados`}
                >
                  <BookmarkIcon className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <>
                  {ex.isPublic
                    ? <GlobeIcon className="w-3.5 h-3.5 text-muted-foreground mx-1" aria-label="Público" />
                    : <LockIcon className="w-3.5 h-3.5 text-muted-foreground mx-1" aria-label="Privado" />
                  }
                  {ex.editable && (
                    <>
                      <button
                        onClick={() => onEdit(ex)}
                        className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                        aria-label={`Editar ${ex.name}`}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(ex)}
                        className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
                        aria-label={`Eliminar ${ex.name}`}
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {ex.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.description}</p>}
          {(primaryMuscles.length > 0 || ex.movementPatterns.length > 0 || ex.difficulty || ex.suitableFor) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {zoneConf && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", zoneConf.pill)}>{zoneConf.label}</span>
              )}
              {primaryMuscles.slice(0, 2).map((m) => (
                <span key={m.muscleId} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">{m.muscleName}</span>
              ))}
              {primaryMuscles.length > 2 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/30 text-muted-foreground">+{primaryMuscles.length - 2}</span>
              )}
              {ex.difficulty && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", DIFFICULTY_CONFIG[ex.difficulty].pill)}>
                  {DIFFICULTY_CONFIG[ex.difficulty].label}
                </span>
              )}
              {ex.movementPatterns.slice(0, 2).map((p) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">{PATTERN_LABELS[p] ?? p}</span>
              ))}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Buscador: componentes ─────────────────────────────────────────────────────

function CollectionTabs({ view, onChange, counts }: {
  view: CollectionView
  onChange: (v: CollectionView) => void
  counts: Record<CollectionView, number>
}) {
  const tabs: { key: CollectionView; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "propios", label: "Propios" },
    { key: "guardados", label: "Guardados" },
  ]
  return (
    <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border" role="tablist">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          onClick={() => onChange(key)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-sm h-11 rounded-lg transition-colors cursor-pointer font-medium",
            view === key
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full tabular-nums",
            view === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}>
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  )
}

