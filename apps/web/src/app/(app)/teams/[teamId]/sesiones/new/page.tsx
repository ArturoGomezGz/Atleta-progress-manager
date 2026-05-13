"use client"

import { trpc } from "@/lib/trpc/client"
import { CalendarIcon, ClipboardListIcon, ZapIcon } from "lucide-react"
import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type SessionType = "normal" | "evaluation"

export default function NewSessionPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const [sessionType, setSessionType] = useState<SessionType>("normal")
  const [scheduledDate, setScheduledDate] = useState("")
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())

  const { data: routines } = trpc.routines.list.useQuery({ teamId })
  const { data: members } = trpc.teams.members.useQuery({ teamId })

  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => {
      if (sessionType === "evaluation") {
        router.push(`/teams/${teamId}/sesiones/${session.id}`)
      } else {
        router.push(`/teams/${teamId}/sesiones`)
      }
    },
  })

  const athletes = members?.filter((m) => m.role === "athlete") ?? []

  function toggleAthlete(id: string) {
    setSelectedAthleteIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    if (selectedAthleteIds.size === athletes.length) {
      setSelectedAthleteIds(new Set())
    } else {
      setSelectedAthleteIds(new Set(athletes.map((a) => a.userId)))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoutineId || selectedAthleteIds.size === 0) return
    createSession.mutate({
      routineId: selectedRoutineId,
      teamId,
      athleteIds: Array.from(selectedAthleteIds),
      sessionType,
      scheduledDate: scheduledDate || undefined,
    })
  }

  const canSubmit = !!selectedRoutineId && selectedAthleteIds.size > 0 && !createSession.isPending

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div>
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Nueva sesión
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Asigna una rutina a tus atletas
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── Tipo de sesión ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tipo de sesión
          </p>
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              active={sessionType === "normal"}
              onClick={() => setSessionType("normal")}
              icon={<CalendarIcon className="w-4 h-4" />}
              label="Normal"
              description="El atleta ejecuta y marca como completada"
            />
            <TypeCard
              active={sessionType === "evaluation"}
              onClick={() => setSessionType("evaluation")}
              icon={<ZapIcon className="w-4 h-4" />}
              label="Evaluación"
              description="Registro de series con peso y repeticiones"
            />
          </div>
        </section>

        {/* ── Fecha programada (solo sesiones normales) ── */}
        {sessionType === "normal" && (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fecha programada
            </p>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full h-11 border border-border rounded-xl px-4 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. El atleta verá en qué día debe realizar esta sesión.
            </p>
          </section>
        )}

        {/* ── Plantilla ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Plantilla
          </p>
          {routines?.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
              Este equipo no tiene plantillas. Crea una primero.
            </p>
          )}
          <div className="space-y-2">
            {routines?.map((r) => (
              <label
                key={r.id}
                className={cn(
                  "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all duration-150",
                  selectedRoutineId === r.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-card"
                )}
              >
                <input
                  type="radio"
                  name="routine"
                  value={r.id}
                  checked={selectedRoutineId === r.id}
                  onChange={() => setSelectedRoutineId(r.id)}
                  className="accent-primary"
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ClipboardListIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{r.name}</span>
                </div>
                {r.type === "circuit" && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded-md px-1.5 py-0.5 shrink-0">
                    Circuito
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>

        {/* ── Atletas ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Atletas
            </p>
            {athletes.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {selectedAthleteIds.size === athletes.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            )}
          </div>
          {athletes.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
              No hay atletas en este equipo.
            </p>
          )}
          <div className="space-y-2">
            {athletes.map((a) => (
              <label
                key={a.userId}
                className={cn(
                  "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all duration-150",
                  selectedAthleteIds.has(a.userId)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-card"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedAthleteIds.has(a.userId)}
                  onChange={() => toggleAthlete(a.userId)}
                  className="accent-primary"
                />
                <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-primary uppercase">
                    {a.userName?.charAt(0) ?? "?"}
                  </span>
                </div>
                <span className="text-sm font-medium">{a.userName}</span>
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors cursor-pointer shadow-lg shadow-primary/20"
        >
          {createSession.isPending
            ? "Creando..."
            : sessionType === "normal"
            ? "Asignar sesión"
            : "Comenzar rutina"}
        </button>
      </form>
    </div>
  )
}

function TypeCard({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-1.5 p-4 border rounded-xl text-left transition-all duration-150 cursor-pointer w-full",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-card"
      )}
    >
      {active && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
      )}
      <div className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </div>
      <p className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </p>
      <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
    </button>
  )
}
