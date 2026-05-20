"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { getRoutineTypeConfig } from "@/lib/routine-types"
import { ChevronLeftIcon, InfoIcon, SearchIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { use, useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { RoutineContent } from "@atleta/db/schema"

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]

// ─── Template preview bottom sheet ───────────────────────────────────────────

function TemplatePreviewSheet({
  routineId,
  onClose,
  onSelect,
}: {
  routineId: string
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const { data, isLoading } = trpc.routines.get.useQuery({ id: routineId })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  function handleSelect() {
    onSelect(routineId)
    handleClose()
  }

  const cfg = data ? getRoutineTypeConfig(data.category) : null
  const Icon = cfg?.icon

  const exercises = data
    ? (data.content as RoutineContent).items.flatMap((item) =>
        item.type === "exercise"
          ? [{ id: item.id, exerciseId: item.exerciseId, sets: item.sets }]
          : item.exercises.map((e) => ({ id: e.id, exerciseId: e.exerciseId, sets: e.sets }))
      )
    : []

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-250",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-popover border-t border-border rounded-t-2xl",
          "transition-transform duration-250 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {cfg && Icon && <Icon className={cn("w-4 h-4 shrink-0", cfg.text)} />}
              <h2 className="font-semibold text-base truncate">
                {data ? sc(data.name) : "Cargando…"}
              </h2>
            </div>
            {cfg && (
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1 inline-block", cfg.bg, cfg.text, cfg.border)}>
                {cfg.label}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto max-h-[45vh] px-5 py-3 space-y-1">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && exercises.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Esta plantilla no tiene ejercicios aún.</p>
          )}

          {exercises.map((ex, idx) => {
            const name = data?.exerciseNames?.[ex.exerciseId] ?? "Ejercicio"
            const setCount = ex.sets.length
            const firstSet = ex.sets[0]
            const hint = (() => {
              if (!firstSet) return null
              if (firstSet.setType === "time" && firstSet.targetDurationSeconds)
                return `${firstSet.targetDurationSeconds}s`
              if (firstSet.targetReps) return `${firstSet.targetReps} reps`
              return null
            })()

            return (
              <div key={ex.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <span className="text-xs font-medium text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
                <span className="text-sm flex-1 truncate">{sc(name)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
                  <span className="text-xs font-medium text-foreground">{setCount} serie{setCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={handleSelect}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Seleccionar esta plantilla
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

function NewSessionForm({ teamId }: { teamId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get("category") as "evaluation" | "training" | null

  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())
  const [startMode, setStartMode] = useState<"now" | "scheduled">("now")
  const [scheduledDate, setScheduledDate] = useState(tomorrow)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "evaluation" | "training">(category ?? "all")
  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data: routines } = trpc.routines.list.useQuery({ teamId })
  const { data: members }  = trpc.teams.members.useQuery({ teamId })
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => router.push(`/teams/${teamId}/sesiones/${session.id}`),
  })

  const athletes = members?.filter((m) => m.role === "athlete") ?? []

  const filtered = (routines ?? []).filter((r) => {
    if (typeFilter !== "all" && r.category !== typeFilter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selectedRoutine = routines?.find((r) => r.id === selectedRoutineId)

  function toggleAthlete(id: string) {
    setSelectedAthleteIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    setSelectedAthleteIds(
      selectedAthleteIds.size === athletes.length ? new Set() : new Set(athletes.map((a) => a.userId))
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoutineId || selectedAthleteIds.size === 0) return
    createSession.mutate({
      routineId: selectedRoutineId,
      teamId,
      athleteIds: Array.from(selectedAthleteIds),
      ...(startMode === "scheduled" ? { scheduledDate } : {}),
    })
  }

  const canSubmit = !!selectedRoutineId && selectedAthleteIds.size > 0 && !createSession.isPending

  // Determine which type filters to show
  const availableCategories = [...new Set((routines ?? []).map((r) => r.category))]

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      {/* Header */}
      <div>
        <Link
          href={`/teams/${teamId}/rutinas`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Sesiones
        </Link>
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Nueva sesión
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* ── Plantilla ── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Plantilla</h2>

          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plantilla..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type filter chips — only show if multiple categories exist */}
          {availableCategories.length > 1 && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer font-medium",
                  typeFilter === "all"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Todas
              </button>
              {availableCategories.map((cat) => {
                const cfg  = getRoutineTypeConfig(cat)
                const Icon = cfg.icon
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTypeFilter(cat as "evaluation" | "training")}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer font-medium",
                      typeFilter === cat
                        ? cn(cfg.bg, cfg.text, cfg.border)
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Template list — fixed height with internal scroll */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {search ? `Sin resultados para "${search}"` : "Sin plantillas disponibles."}
                  </p>
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="text-xs text-primary hover:underline mt-1 cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
              )}

              {filtered.map((r) => {
                const cfg      = getRoutineTypeConfig(r.category)
                const Icon     = cfg.icon
                const isSelected = selectedRoutineId === r.id

                return (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-150",
                      isSelected ? "bg-card" : "bg-card/40 hover:bg-card/70",
                    )}
                  >
                    {/* Color bar */}
                    <div className={cn("w-0.5 h-6 rounded-full shrink-0", isSelected ? cfg.leftBar : "bg-border")} />

                    {/* Type icon */}
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.text)} />

                    {/* Name — click to select */}
                    <button
                      type="button"
                      onClick={() => setSelectedRoutineId(r.id)}
                      className="flex-1 text-left text-sm font-medium truncate cursor-pointer"
                    >
                      {sc(r.name)}
                    </button>

                    {/* Info button */}
                    <button
                      type="button"
                      onClick={() => setPreviewId(r.id)}
                      className="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer shrink-0"
                      aria-label="Ver contenido de la plantilla"
                    >
                      <InfoIcon className="w-3.5 h-3.5" />
                    </button>

                    {/* Radio indicator */}
                    <button
                      type="button"
                      onClick={() => setSelectedRoutineId(r.id)}
                      className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer",
                        isSelected ? cn("border-current", cfg.text) : "border-border",
                      )}
                    >
                      {isSelected && <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected summary */}
          {selectedRoutine && (
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs", getRoutineTypeConfig(selectedRoutine.category).bg)}>
              {(() => {
                const cfg = getRoutineTypeConfig(selectedRoutine.category)
                const Icon = cfg.icon
                return <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.text)} />
              })()}
              <span className="text-muted-foreground">Seleccionada:</span>
              <span className="font-medium text-foreground truncate">{sc(selectedRoutine.name)}</span>
              <button
                type="button"
                onClick={() => setSelectedRoutineId(null)}
                className="ml-auto text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
        </section>

        {/* ── Atletas ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Atletas</h2>
            {athletes.length > 0 && (
              <button type="button" onClick={handleSelectAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {selectedAthleteIds.size === athletes.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            )}
          </div>
          {athletes.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay atletas en este equipo.</p>
          )}
          <div className="space-y-1.5">
            {athletes.map((a) => {
              const checked = selectedAthleteIds.has(a.userId)
              return (
                <button
                  key={a.userId}
                  type="button"
                  onClick={() => toggleAthlete(a.userId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer",
                    checked ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card/50 hover:bg-card/80",
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                    checked ? "border-primary bg-primary" : "border-border",
                  )}>
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm flex-1">{a.userName}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Cuándo ── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cuándo</h2>
          <div className="flex gap-2">
            {(["now", "scheduled"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStartMode(mode)}
                className={cn(
                  "flex-1 py-2.5 text-sm rounded-xl border transition-colors cursor-pointer font-medium",
                  startMode === mode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {mode === "now" ? "Ahora" : "Programar fecha"}
              </button>
            ))}
          </div>
          {startMode === "scheduled" && (
            <input
              type="date"
              value={scheduledDate}
              min={tomorrow}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </section>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors cursor-pointer"
        >
          {createSession.isPending
            ? "Creando..."
            : startMode === "scheduled"
            ? "Programar sesión"
            : "Comenzar sesión"}
        </button>
      </form>

      {/* Preview bottom sheet */}
      {previewId && (
        <TemplatePreviewSheet
          routineId={previewId}
          onClose={() => setPreviewId(null)}
          onSelect={(id) => setSelectedRoutineId(id)}
        />
      )}
    </div>
  )
}

export default function NewSessionPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  return (
    <Suspense>
      <NewSessionForm teamId={teamId} />
    </Suspense>
  )
}
