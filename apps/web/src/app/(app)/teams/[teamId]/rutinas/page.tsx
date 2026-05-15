"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { PlusIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { use, useState, Suspense } from "react"

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

const STATUS_CONFIG = {
  scheduled: { dot: "bg-amber-400",              badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",       label: "Programada" },
  active:    { dot: "bg-green-400 animate-pulse", badge: "bg-green-500/10 text-green-400 border-green-500/20",       label: "En curso" },
  completed: { dot: "bg-emerald-400",             badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Completada" },
  cancelled: { dot: "bg-rose-400",                badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",          label: "Cancelada" },
} as const

type SessionItem = {
  id: string
  status: string
  startedAt: string
  scheduledDate: string | null
  routineName: string
  routineCategory?: string | null
}

function SessionCard({ teamId, session }: { teamId: string; session: SessionItem }) {
  const config = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG] ?? {
    dot: "bg-muted-foreground", badge: "bg-muted/20 text-muted-foreground border-border", label: session.status,
  }
  const dateLabel = session.status === "scheduled" && session.scheduledDate
    ? new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("es", { dateStyle: "medium" })
    : new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })

  return (
    <Link
      href={`/teams/${teamId}/sesiones/${session.id}`}
      className="group flex items-center gap-3 p-3.5 border border-border rounded-xl hover:border-primary/30 bg-card/60 transition-all duration-200 cursor-pointer"
    >
      <div className={cn("w-1 h-8 rounded-full shrink-0", config.dot)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
          {session.routineName ? sc(session.routineName) : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>
      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border shrink-0", config.badge)}>
        {config.label}
      </span>
    </Link>
  )
}

function SesionesContent({ teamId }: { teamId: string }) {
  const [histSearch, setHistSearch] = useState("")
  const [histFilter, setHistFilter] = useState<"all" | "evaluation" | "training">("all")

  const { data: teams } = trpc.teams.list.useQuery()
  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  const { data: evalSessions }     = trpc.sessions.list.useQuery({ teamId, category: "evaluation" })
  const { data: trainingSessions } = trpc.sessions.list.useQuery({ teamId, category: "training" })

  const allSessions: SessionItem[] = [
    ...(evalSessions ?? []).map((s) => ({ ...s, routineCategory: "evaluation" as const })),
    ...(trainingSessions ?? []).map((s) => ({ ...s, routineCategory: "training" as const })),
  ]

  const scheduled = allSessions.filter((s) => s.status === "scheduled")
  const active     = allSessions.filter((s) => s.status === "active")
  const history    = allSessions
    .filter((s) => s.status !== "active" && s.status !== "scheduled")
    .filter((s) => {
      if (histFilter !== "all" && s.routineCategory !== histFilter) return false
      if (histSearch && !s.routineName.toLowerCase().includes(histSearch.toLowerCase())) return false
      return true
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Sesiones
        </h1>
        {isCoach && (
          <Link
            href={`/teams/${teamId}/sesiones/new`}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3.5 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva
          </Link>
        )}
      </div>

      {/* Active + Scheduled */}
      {(active.length > 0 || scheduled.length > 0) && (
        <div className="space-y-4">
          {active.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">En curso</p>
              </div>
              {active.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
            </section>
          )}

          {scheduled.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Programadas</p>
              </div>
              {scheduled.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
            </section>
          )}
        </div>
      )}

      {active.length === 0 && scheduled.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-xl gap-2 text-center">
          <p className="text-sm text-muted-foreground">Sin sesiones activas o programadas.</p>
          {isCoach && (
            <Link
              href={`/teams/${teamId}/sesiones/new`}
              className="text-xs text-primary hover:underline cursor-pointer mt-1"
            >
              Crear una sesión
            </Link>
          )}
        </div>
      )}

      {/* History */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Historial</p>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
              placeholder="Buscar sesión..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "training", "evaluation"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHistFilter(f)}
                className={cn(
                  "px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer font-medium whitespace-nowrap",
                  histFilter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? "Todas" : f === "training" ? "Entrenamiento" : "Evaluación"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {history.slice(0, 20).map((s) => (
            <SessionCard key={s.id} teamId={teamId} session={s} />
          ))}
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {histSearch || histFilter !== "all" ? "Sin resultados." : "Sin sesiones en el historial."}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export default function RutinasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  return (
    <Suspense>
      <SesionesContent teamId={teamId} />
    </Suspense>
  )
}
