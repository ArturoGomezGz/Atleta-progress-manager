"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { getRoutineTypeConfig } from "@/lib/routine-types"
import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { use, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]

function NewSessionForm({ teamId }: { teamId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get("category") as "evaluation" | "training" | null

  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())
  const [startMode, setStartMode] = useState<"now" | "scheduled">("now")
  const [scheduledDate, setScheduledDate] = useState(tomorrow)

  const { data: routines } = trpc.routines.list.useQuery({ teamId, ...(category ? { category } : {}) })
  const { data: members }  = trpc.teams.members.useQuery({ teamId })
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => router.push(`/teams/${teamId}/sesiones/${session.id}`),
  })

  const athletes = members?.filter((m) => m.role === "athlete") ?? []

  // Group routines by category
  const grouped = (routines ?? []).reduce<Record<string, typeof routines>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category]!.push(r)
    return acc
  }, {})
  const groupEntries = Object.entries(grouped)

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
  const selectedRoutine = routines?.find((r) => r.id === selectedRoutineId)

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
        {/* Plantilla */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Plantilla</h2>

          {routines?.length === 0 && (
            <p className="text-sm text-muted-foreground">Este equipo no tiene plantillas. Crea una primero.</p>
          )}

          {groupEntries.map(([cat, items]) => {
            const cfg  = getRoutineTypeConfig(cat)
            const Icon = cfg.icon
            return (
              <div key={cat} className="space-y-1.5">
                {/* Category header — only shown when there are multiple groups */}
                {groupEntries.length > 1 && (
                  <div className="flex items-center gap-2 px-1">
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.text)} />
                    <span className={cn("text-[11px] font-semibold uppercase tracking-widest", cfg.text)}>
                      {cfg.label}
                    </span>
                  </div>
                )}
                {items!.map((r) => {
                  const isSelected = selectedRoutineId === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoutineId(r.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer",
                        isSelected
                          ? cn("ring-1", cfg.ring, "bg-card")
                          : "border-border bg-card/50 hover:border-border/80 hover:bg-card/80",
                      )}
                    >
                      {/* Left color bar */}
                      <div className={cn("w-0.5 h-7 rounded-full shrink-0", isSelected ? cfg.leftBar : "bg-border")} />
                      <span className="flex-1 text-sm font-medium truncate">{sc(r.name)}</span>
                      {/* Type badge — shown when there's only one group (no header) */}
                      {groupEntries.length === 1 && (
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", cfg.bg, cfg.text, cfg.border)}>
                          {cfg.label}
                        </span>
                      )}
                      {/* Selection indicator */}
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                        isSelected ? cn("border-current", cfg.text) : "border-border",
                      )}>
                        {isSelected && <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Selected summary */}
          {selectedRoutine && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
              getRoutineTypeConfig(selectedRoutine.category).bg,
            )}>
              {(() => { const cfg = getRoutineTypeConfig(selectedRoutine.category); const Icon = cfg.icon; return <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.text)} /> })()}
              <span className="text-muted-foreground">Seleccionada:</span>
              <span className="font-medium text-foreground truncate">{sc(selectedRoutine.name)}</span>
            </div>
          )}
        </section>

        {/* Atletas */}
        <section className="space-y-3">
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
                    checked
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card/50 hover:bg-card/80",
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

        {/* Cuándo */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cuándo</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStartMode("now")}
              className={cn(
                "flex-1 py-2.5 text-sm rounded-xl border transition-colors cursor-pointer font-medium",
                startMode === "now"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              Ahora
            </button>
            <button
              type="button"
              onClick={() => setStartMode("scheduled")}
              className={cn(
                "flex-1 py-2.5 text-sm rounded-xl border transition-colors cursor-pointer font-medium",
                startMode === "scheduled"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              Programar fecha
            </button>
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
