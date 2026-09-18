"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon, Link2Icon, PlusIcon, SearchIcon, UserIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { use, useEffect, useMemo, useRef, useState, Suspense } from "react"

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

type ActiveShare = {
  routineId: string
  code: string
  routineName: string
  createdAt: string
  stats: { started: number; completed: number; claimed: number }
}

function ShareLinkCard({ teamId, share }: { teamId: string; share: ActiveShare }) {
  return (
    <Link
      href={`/teams/${teamId}/rutinas/enlace/${share.routineId}`}
      className="group flex items-center gap-3 p-3.5 border border-dashed border-primary/30 rounded-xl hover:border-primary/60 bg-primary/5 transition-all duration-200 cursor-pointer"
    >
      <Link2Icon className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
          {sc(share.routineName)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {share.stats.started === 0
            ? "Nadie ha entrado todavía"
            : `${share.stats.started} ${share.stats.started === 1 ? "empezó" : "empezaron"} · ${share.stats.completed} ${share.stats.completed === 1 ? "terminó" : "terminaron"}`}
        </p>
      </div>
      <span className="text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 bg-primary/10 text-primary border-primary/20">
        Enlace activo
      </span>
    </Link>
  )
}

type AthleteOption = { userId: string; userName: string | null; selfAthlete: boolean }

function AthleteFilter({
  athletes,
  value,
  onChange,
}: {
  athletes: AthleteOption[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera: el panel es un popover, no un modal
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const selected = athletes.find((a) => a.userId === value) ?? null
  const filtered = search
    ? athletes.filter((a) => (a.userName ?? "").toLowerCase().includes(search.toLowerCase()))
    : athletes

  function select(id: string | null) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer font-medium max-w-[60vw]",
            selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <UserIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{selected ? (selected.userName ?? "Atleta") : "Todos los atletas"}</span>
          <ChevronDownIcon className={cn("w-3.5 h-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        </button>

        {selected && (
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Quitar filtro de atleta"
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1.5 w-64 max-w-[80vw] rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
        >
          {athletes.length > 6 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <SearchIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar atleta"
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => select(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <CheckIcon className={cn("w-3.5 h-3.5 shrink-0", value === null ? "text-primary" : "opacity-0")} />
              <span className="flex-1 truncate">Todos los atletas</span>
            </button>

            {filtered.map((a) => (
              <button
                key={a.userId}
                type="button"
                role="option"
                aria-selected={value === a.userId}
                onClick={() => select(a.userId)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <CheckIcon className={cn("w-3.5 h-3.5 shrink-0", value === a.userId ? "text-primary" : "opacity-0")} />
                <span className="flex-1 truncate">
                  {a.userName ?? "Atleta"}{a.selfAthlete && " (Tú)"}
                </span>
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">Sin atletas que coincidan.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SesionesContent({ teamId }: { teamId: string }) {
  const [histFilter, setHistFilter] = useState<"all" | "evaluation" | "training">("all")
  const [athleteFilter, setAthleteFilter] = useState<string | null>(null)

  const { data: teams } = trpc.teams.list.useQuery()
  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  // El filtro por atleta es una herramienta del entrenador: un atleta ya solo se ve a sí mismo
  const { data: members } = trpc.teams.members.useQuery({ teamId }, { enabled: !!isCoach })
  const athletes = useMemo(
    () => (members ?? []).filter((m) => m.role === "athlete" || m.selfAthlete),
    [members],
  )

  // Si el atleta filtrado deja de estar en el equipo, el filtro dejaría la vista vacía sin explicación
  useEffect(() => {
    if (athleteFilter && members && !athletes.some((a) => a.userId === athleteFilter)) {
      setAthleteFilter(null)
    }
  }, [athleteFilter, members, athletes])

  const athleteId = athleteFilter ?? undefined
  const { data: evalSessions }     = trpc.sessions.list.useQuery({ teamId, category: "evaluation", athleteId })
  const { data: trainingSessions } = trpc.sessions.list.useQuery({ teamId, category: "training", athleteId })
  // Un enlace sin revocar es, para el entrenador, una sesión abierta más.
  // Un enlace no pertenece a ningún atleta, así que al filtrar por uno se oculta.
  const { data: activeShares } = trpc.share.listForTeam.useQuery(
    { teamId },
    { enabled: !!isCoach, refetchInterval: 15000 },
  )
  const shares = athleteFilter ? [] : (activeShares ?? [])

  const selectedAthleteName = athletes.find((a) => a.userId === athleteFilter)?.userName ?? null

  const allSessions: SessionItem[] = [
    ...(evalSessions ?? []).map((s) => ({ ...s, routineCategory: "evaluation" as const })),
    ...(trainingSessions ?? []).map((s) => ({ ...s, routineCategory: "training" as const })),
  ]

  const scheduled = allSessions.filter((s) => s.status === "scheduled")
  const active     = allSessions.filter((s) => s.status === "active")
  const history    = allSessions
    .filter((s) => s.status !== "active" && s.status !== "scheduled")
    .filter((s) => histFilter === "all" || s.routineCategory === histFilter)
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

      {/* Filtro por atleta (solo entrenador) */}
      {isCoach && athletes.length > 0 && (
        <AthleteFilter athletes={athletes} value={athleteFilter} onChange={setAthleteFilter} />
      )}

      {/* Active + Scheduled + Enlaces */}
      {(active.length > 0 || scheduled.length > 0 || shares.length > 0) && (
        <div className="space-y-4">
          {(active.length > 0 || shares.length > 0) && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">En curso</p>
              </div>
              {active.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
              {shares.map((sh) => <ShareLinkCard key={sh.routineId} teamId={teamId} share={sh} />)}
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

      {active.length === 0 && scheduled.length === 0 && shares.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed border-border rounded-xl gap-2 text-center">
          <p className="text-sm text-muted-foreground break-words">
            {selectedAthleteName
              ? `${selectedAthleteName} no tiene sesiones activas o programadas.`
              : "Sin sesiones activas o programadas."}
          </p>
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

        <div className="space-y-2">
          {history.slice(0, 20).map((s) => (
            <SessionCard key={s.id} teamId={teamId} session={s} />
          ))}
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {histFilter !== "all" || athleteFilter
                ? "Sin resultados."
                : "Sin sesiones en el historial."}
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
