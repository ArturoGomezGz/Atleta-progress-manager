"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  DumbbellIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react"
import Link from "next/link"
import { use, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type Tab = "evaluaciones" | "entrenamientos"

function RutinasContent({ teamId }: { teamId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = (searchParams.get("tab") as Tab) ?? "evaluaciones"

  const { data: teams } = trpc.teams.list.useQuery()
  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  function setTab(t: Tab) {
    router.replace(`/teams/${teamId}/rutinas?tab=${t}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <h1
        className="text-2xl font-bold tracking-wider uppercase"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
      >
        Rutinas
      </h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {(["evaluaciones", "entrenamientos"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer -mb-px border-b-2 shrink-0 capitalize",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "evaluaciones"  && <EvaluacionesTab  teamId={teamId} isCoach={!!isCoach} />}
      {tab === "entrenamientos" && <EntrenamientosTab teamId={teamId} isCoach={!!isCoach} />}
    </div>
  )
}

export default function RutinasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  return (
    <Suspense>
      <RutinasContent teamId={teamId} />
    </Suspense>
  )
}

// ─── Evaluaciones tab ─────────────────────────────────────────────────────────

function EvaluacionesTab({ teamId, isCoach }: { teamId: string; isCoach: boolean }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [routineName, setRoutineName] = useState("")
  const [action, setAction] = useState<RoutineAction | null>(null)

  const { data: routines, refetch } = trpc.routines.list.useQuery({ teamId, category: "evaluation" })
  const { data: sessions } = trpc.sessions.list.useQuery({ teamId, category: "evaluation" })

  const createRoutine = trpc.routines.create.useMutation({
    onSuccess: (r) => {
      setRoutineName("")
      setCreating(false)
      router.push(`/teams/${teamId}/plantillas/${r.id}`)
    },
  })
  const renameRoutine = trpc.routines.rename.useMutation({ onSuccess: () => { refetch(); setAction(null) } })
  const deleteRoutine = trpc.routines.delete.useMutation({ onSuccess: () => { refetch(); setAction(null) } })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!routineName.trim()) return
    createRoutine.mutate({ teamId, name: routineName.trim(), category: "evaluation" })
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (action?.type !== "rename" || !action.name.trim()) return
    renameRoutine.mutate({ id: action.id, name: action.name.trim() })
  }

  const active = sessions?.filter((s) => s.status === "active") ?? []
  const past   = sessions?.filter((s) => s.status !== "active") ?? []

  return (
    <div className="space-y-5">
      {/* Templates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Plantillas</p>
          {isCoach && (
            !creating ? (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Nueva plantilla
              </button>
            ) : (
              <form onSubmit={handleCreate} className="flex gap-2 flex-1 ml-4">
                <input
                  autoFocus
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="Nombre de la evaluación"
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={createRoutine.isPending}
                  className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer font-medium"
                >
                  {createRoutine.isPending ? "…" : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-sm border border-border px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            )
          )}
        </div>

        <div className="space-y-2">
          {routines?.map((r) => {
            const isRenaming = action?.type === "rename" && action.id === r.id
            const isDeleting = action?.type === "delete" && action.id === r.id

            if (isDeleting) return (
              <div key={r.id} className="flex items-center justify-between p-4 border border-destructive/30 rounded-xl bg-destructive/5">
                <p className="text-sm text-destructive">¿Eliminar <span className="font-medium">{r.name}</span>?</p>
                <div className="flex gap-2">
                  <button onClick={() => setAction(null)} className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
                  <button onClick={() => deleteRoutine.mutate({ id: r.id })} disabled={deleteRoutine.isPending} className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 cursor-pointer">Eliminar</button>
                </div>
              </div>
            )

            if (isRenaming) return (
              <form key={r.id} onSubmit={handleRename} className="flex gap-2 p-2 border border-border rounded-xl bg-muted/10">
                <input
                  autoFocus
                  value={action.name}
                  onChange={(e) => setAction({ ...action, name: e.target.value })}
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <button type="submit" disabled={renameRoutine.isPending || !action.name.trim()} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 cursor-pointer">
                  {renameRoutine.isPending ? "…" : "Guardar"}
                </button>
                <button type="button" onClick={() => setAction(null)} className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
              </form>
            )

            return (
              <div key={r.id} className="group flex items-center border border-border rounded-xl hover:border-primary/20 bg-card/60 transition-colors">
                <Link href={`/teams/${teamId}/plantillas/${r.id}`} className="flex-1 flex items-center gap-3 px-4 py-3.5">
                  <ZapIcon className="w-4 h-4 text-amber-400/70 shrink-0" />
                  <span className="font-medium text-sm flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </span>
                </Link>
                {isCoach && (
                  <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setAction({ type: "rename", id: r.id, name: r.name })} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setAction({ type: "delete", id: r.id, name: r.name })} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer">
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {routines?.length === 0 && !creating && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <ZapIcon className="w-5 h-5 text-amber-400/70" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sin plantillas de evaluación</p>
                {isCoach && <p className="text-xs text-muted-foreground mt-0.5">Crea una para registrar el rendimiento del equipo.</p>}
              </div>
              {isCoach && (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer mt-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  Nueva plantilla
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Live sessions */}
      {sessions && sessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sesiones</p>
            {isCoach && (
              <Link
                href={`/teams/${teamId}/sesiones/new?category=evaluation`}
                className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Nueva sesión
              </Link>
            )}
          </div>

          {active.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">En curso</p>
              </div>
              {active.map((s) => <EvalSessionCard key={s.id} teamId={teamId} session={s} />)}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Historial</p>
              {past.slice(0, 5).map((s) => <EvalSessionCard key={s.id} teamId={teamId} session={s} />)}
            </div>
          )}
        </section>
      )}

      {isCoach && (!sessions || sessions.length === 0) && (
        <div className="flex justify-end">
          <Link
            href={`/teams/${teamId}/sesiones/new?category=evaluation`}
            className="flex items-center gap-1.5 text-sm border border-border px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva sesión de evaluación
          </Link>
        </div>
      )}
    </div>
  )
}

const EVAL_STATUS_CONFIG = {
  active:    { dot: "bg-green-400",   badge: "bg-green-500/10 text-green-400 border-green-500/20",     label: "Activa" },
  completed: { dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Completada" },
  cancelled: { dot: "bg-rose-400",    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",         label: "Cancelada" },
} as const

function EvalSessionCard({ teamId, session }: { teamId: string; session: { id: string; status: string; startedAt: string; routineName: string } }) {
  const config = EVAL_STATUS_CONFIG[session.status as keyof typeof EVAL_STATUS_CONFIG] ?? {
    dot: "bg-muted-foreground", badge: "bg-muted/20 text-muted-foreground border-border", label: session.status,
  }
  return (
    <Link
      href={`/teams/${teamId}/sesiones/${session.id}`}
      className="group flex items-center gap-3 p-3.5 border border-border rounded-xl hover:border-primary/30 bg-card/60 transition-all duration-200 cursor-pointer"
    >
      <div className={cn("w-1 h-8 rounded-full shrink-0", config.dot)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">{session.routineName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border shrink-0", config.badge)}>{config.label}</span>
    </Link>
  )
}

// ─── Entrenamientos tab ───────────────────────────────────────────────────────

type RoutineAction =
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string; name: string }

function EntrenamientosTab({ teamId, isCoach }: { teamId: string; isCoach: boolean }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [routineName, setRoutineName] = useState("")
  const [action, setAction] = useState<RoutineAction | null>(null)

  const { data: routines, refetch } = trpc.routines.list.useQuery({ teamId, category: "training" })
  const { data: sessions }          = trpc.sessions.list.useQuery({ teamId, category: "training" })

  const createRoutine = trpc.routines.create.useMutation({
    onSuccess: (r) => {
      setRoutineName("")
      setCreating(false)
      router.push(`/teams/${teamId}/plantillas/${r.id}`)
    },
  })
  const renameRoutine = trpc.routines.rename.useMutation({ onSuccess: () => { refetch(); setAction(null) } })
  const deleteRoutine = trpc.routines.delete.useMutation({ onSuccess: () => { refetch(); setAction(null) } })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!routineName.trim()) return
    createRoutine.mutate({ teamId, name: routineName.trim(), category: "training" })
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (action?.type !== "rename" || !action.name.trim()) return
    renameRoutine.mutate({ id: action.id, name: action.name.trim() })
  }

  const active = sessions?.filter((s) => s.status === "active") ?? []
  const past   = sessions?.filter((s) => s.status !== "active") ?? []

  return (
    <div className="space-y-5">
      {/* Templates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Plantillas</p>
          {isCoach && (
            !creating ? (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Nueva plantilla
              </button>
            ) : (
              <form onSubmit={handleCreate} className="flex gap-2 flex-1 ml-4">
                <input
                  autoFocus
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="Nombre de la rutina"
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
                <button type="submit" disabled={createRoutine.isPending} className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer font-medium">
                  {createRoutine.isPending ? "…" : "Crear"}
                </button>
                <button type="button" onClick={() => setCreating(false)} className="text-sm border border-border px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
                  Cancelar
                </button>
              </form>
            )
          )}
        </div>

        <div className="space-y-2">
          {routines?.map((r) => {
            const isRenaming = action?.type === "rename" && action.id === r.id
            const isDeleting = action?.type === "delete" && action.id === r.id

            if (isDeleting) return (
              <div key={r.id} className="flex items-center justify-between p-4 border border-destructive/30 rounded-xl bg-destructive/5">
                <p className="text-sm text-destructive">¿Eliminar <span className="font-medium">{r.name}</span>?</p>
                <div className="flex gap-2">
                  <button onClick={() => setAction(null)} className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
                  <button onClick={() => deleteRoutine.mutate({ id: r.id })} disabled={deleteRoutine.isPending} className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 cursor-pointer">Eliminar</button>
                </div>
              </div>
            )

            if (isRenaming) return (
              <form key={r.id} onSubmit={handleRename} className="flex gap-2 p-2 border border-border rounded-xl bg-muted/10">
                <input
                  autoFocus
                  value={action.name}
                  onChange={(e) => setAction({ ...action, name: e.target.value })}
                  className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
                <button type="submit" disabled={renameRoutine.isPending || !action.name.trim()} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 cursor-pointer">
                  {renameRoutine.isPending ? "…" : "Guardar"}
                </button>
                <button type="button" onClick={() => setAction(null)} className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
              </form>
            )

            return (
              <div key={r.id} className="group flex items-center border border-border rounded-xl hover:border-primary/20 bg-card/60 transition-colors">
                <Link href={`/teams/${teamId}/plantillas/${r.id}`} className="flex-1 flex items-center gap-3 px-4 py-3.5">
                  <DumbbellIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </span>
                </Link>
                {isCoach && (
                  <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setAction({ type: "rename", id: r.id, name: r.name })} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setAction({ type: "delete", id: r.id, name: r.name })} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer">
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {routines?.length === 0 && !creating && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                <DumbbellIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sin plantillas de entrenamiento</p>
                {isCoach && <p className="text-xs text-muted-foreground mt-0.5">Crea una para empezar a trabajar con el equipo.</p>}
              </div>
              {isCoach && (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer mt-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  Nueva plantilla
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Sessions */}
      {sessions && sessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sesiones</p>
            {isCoach && (
              <Link
                href={`/teams/${teamId}/sesiones/new?category=training`}
                className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Nueva sesión
              </Link>
            )}
          </div>

          {active.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">En curso</p>
              </div>
              {active.map((s) => <EvalSessionCard key={s.id} teamId={teamId} session={s} />)}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Historial</p>
              {past.slice(0, 5).map((s) => <EvalSessionCard key={s.id} teamId={teamId} session={s} />)}
            </div>
          )}
        </section>
      )}

      {isCoach && (!sessions || sessions.length === 0) && (
        <div className="flex justify-end">
          <Link
            href={`/teams/${teamId}/sesiones/new?category=training`}
            className="flex items-center gap-1.5 text-sm border border-border px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva sesión de entrenamiento
          </Link>
        </div>
      )}
    </div>
  )
}
