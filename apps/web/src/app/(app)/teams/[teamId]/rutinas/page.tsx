"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { use, useState } from "react"

type Tab = "asignaciones" | "grupos"

export default function RutinasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const [tab, setTab] = useState<Tab>("asignaciones")

  const { data: teams } = trpc.teams.list.useQuery()
  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <h1
        className="text-2xl font-bold tracking-wider uppercase"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
      >
        Rutinas
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["asignaciones", "grupos"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer -mb-px border-b-2",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "asignaciones" ? "Asignaciones" : "Grupos"}
          </button>
        ))}
      </div>

      {tab === "asignaciones" && (
        <AsignacionesTab teamId={teamId} isCoach={!!isCoach} />
      )}
      {tab === "grupos" && (
        <GruposTab teamId={teamId} isCoach={!!isCoach} />
      )}
    </div>
  )
}

// ─── Asignaciones tab ─────────────────────────────────────────────────────────

type AssignedSession = {
  id: string
  routineName: string | null
  scheduledDate: string
  status: string
  assignedToAthleteId: string | null
  athleteName: string | null
  assignedToGroupId: string | null
  groupName: string | null
}

const STATUS_CONFIG = {
  pending:     { label: "Pendiente",   dot: "bg-amber-400",  badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  in_progress: { label: "En curso",    dot: "bg-blue-400 animate-pulse", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  completed:   { label: "Completada",  dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  skipped:     { label: "Omitida",     dot: "bg-rose-400",   badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
} as const

function AssignedSessionCard({
  session,
  onCancel,
  isCoach,
}: {
  session: AssignedSession
  onCancel: (id: string) => void
  isCoach: boolean
}) {
  const config = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG] ?? {
    label: session.status, dot: "bg-muted-foreground", badge: "bg-muted/20 text-muted-foreground border-border",
  }
  const target = session.athleteName ?? session.groupName ?? "—"
  const isGroup = !!session.assignedToGroupId
  const isPending = session.status === "pending" || session.status === "in_progress"

  return (
    <div className="group flex items-center gap-3 p-4 border border-border rounded-xl hover:border-primary/20 bg-card/60 transition-all duration-200">
      <div className={cn("w-1 h-9 rounded-full shrink-0", config.dot)} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="font-semibold text-sm text-foreground truncate">
          {session.routineName ?? "Rutina eliminada"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isGroup && <UsersIcon className="w-3 h-3 shrink-0" />}
          <span className="truncate">{target}</span>
          <span className="text-border">·</span>
          <span className="shrink-0">
            {new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("es", {
              weekday: "short", day: "numeric", month: "short",
            })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", config.badge)}>
          {config.label}
        </span>
        {isCoach && isPending && (
          <button
            onClick={() => onCancel(session.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition-all cursor-pointer"
            title="Cancelar asignación"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function AsignacionesTab({ teamId, isCoach }: { teamId: string; isCoach: boolean }) {
  const [showAssign, setShowAssign] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const { data: sessions, refetch } = trpc.assignedSessions.list.useQuery({ teamId })
  const cancelSession = trpc.assignedSessions.cancel.useMutation({ onSuccess: refetch })

  const active = sessions?.filter((s) => s.status === "pending" || s.status === "in_progress") ?? []
  const past = sessions?.filter((s) => s.status === "completed" || s.status === "skipped") ?? []

  return (
    <div className="space-y-4">
      {isCoach && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3.5 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer shadow-lg shadow-primary/20"
          >
            <PlusIcon className="w-4 h-4" />
            Asignar rutina
          </button>
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Próximas</p>
          {active.map((s) => (
            <AssignedSessionCard
              key={s.id}
              session={s as AssignedSession}
              onCancel={(id) => cancelSession.mutate({ assignedSessionId: id })}
              isCoach={isCoach}
            />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronDownIcon className={cn("w-3.5 h-3.5 transition-transform", showPast && "rotate-180")} />
            Historial ({past.length})
          </button>
          {showPast && past.map((s) => (
            <AssignedSessionCard
              key={s.id}
              session={s as AssignedSession}
              onCancel={(id) => cancelSession.mutate({ assignedSessionId: id })}
              isCoach={isCoach}
            />
          ))}
        </section>
      )}

      {sessions?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Sin rutinas asignadas</p>
            {isCoach && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Asigna una rutina a un atleta o grupo para empezar.
              </p>
            )}
          </div>
          {isCoach && (
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer mt-1"
            >
              <PlusIcon className="w-4 h-4" />
              Asignar rutina
            </button>
          )}
        </div>
      )}

      {showAssign && (
        <AssignModal teamId={teamId} onClose={() => setShowAssign(false)} onSuccess={() => { refetch(); setShowAssign(false) }} />
      )}
    </div>
  )
}

// ─── Assign modal ─────────────────────────────────────────────────────────────

function AssignModal({ teamId, onClose, onSuccess }: { teamId: string; onClose: () => void; onSuccess: () => void }) {
  const [routineId, setRoutineId] = useState("")
  const [targetType, setTargetType] = useState<"athlete" | "group">("athlete")
  const [targetId, setTargetId] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [error, setError] = useState<string | null>(null)

  const { data: routines } = trpc.routines.list.useQuery({ teamId })
  const { data: members } = trpc.teams.members.useQuery({ teamId })
  const { data: groups } = trpc.groups.list.useQuery({ teamId })

  const assign = trpc.assignedSessions.create.useMutation({
    onSuccess,
    onError: (e) => setError(e.message),
  })

  const athletes = members?.filter((m) => m.role === "athlete") ?? []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!routineId) { setError("Selecciona una rutina"); return }
    if (!targetId) { setError(targetType === "athlete" ? "Selecciona un atleta" : "Selecciona un grupo"); return }
    if (!date) { setError("Selecciona una fecha"); return }

    assign.mutate({
      teamId,
      routineId,
      scheduledDate: date,
      assignedToAthleteId: targetType === "athlete" ? targetId : undefined,
      assignedToGroupId: targetType === "group" ? targetId : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-bold tracking-wider uppercase"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            Asignar rutina
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Routine */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rutina</label>
            <select
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
            >
              <option value="">Seleccionar...</option>
              {routines?.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Target type toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asignar a</label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["athlete", "group"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTargetType(t); setTargetId("") }}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium transition-colors cursor-pointer",
                    targetType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {t === "athlete" ? "Atleta" : "Grupo"}
                </button>
              ))}
            </div>
          </div>

          {/* Target selector */}
          <div className="space-y-1.5">
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
            >
              <option value="">
                {targetType === "athlete" ? "Seleccionar atleta..." : "Seleccionar grupo..."}
              </option>
              {targetType === "athlete"
                ? athletes.map((m) => <option key={m.userId} value={m.userId}>{m.userName}</option>)
                : groups?.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)
              }
            </select>
            {targetType === "athlete" && athletes.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin atletas en el equipo.</p>
            )}
            {targetType === "group" && (!groups || groups.length === 0) && (
              <p className="text-xs text-muted-foreground">Sin grupos creados. Crea uno en la pestaña Grupos.</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-sm py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={assign.isPending}
              className="flex-1 bg-primary text-primary-foreground text-sm py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {assign.isPending ? "Asignando..." : "Asignar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Grupos tab ───────────────────────────────────────────────────────────────

type Group = { id: string; name: string; members: { athleteId: string; name: string; email: string }[] }

function GruposTab({ teamId, isCoach }: { teamId: string; isCoach: boolean }) {
  const [creating, setCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const { data: groups, refetch } = trpc.groups.list.useQuery({ teamId })
  const { data: members } = trpc.teams.members.useQuery({ teamId })

  const createGroup = trpc.groups.create.useMutation({
    onSuccess: () => { refetch(); setCreating(false); setNewGroupName("") },
  })
  const deleteGroup = trpc.groups.delete.useMutation({ onSuccess: refetch })
  const addMember = trpc.groups.addMember.useMutation({ onSuccess: refetch })
  const removeMember = trpc.groups.removeMember.useMutation({ onSuccess: refetch })

  const athletes = members?.filter((m) => m.role === "athlete") ?? []

  return (
    <div className="space-y-4">
      {isCoach && (
        <div className="flex justify-end">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-sm border border-border px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              Nuevo grupo
            </button>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (newGroupName.trim()) createGroup.mutate({ teamId, name: newGroupName.trim() }) }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nombre del grupo"
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="submit" disabled={createGroup.isPending} className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer">
                Crear
              </button>
              <button type="button" onClick={() => setCreating(false)} className="text-sm border border-border px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
                Cancelar
              </button>
            </form>
          )}
        </div>
      )}

      <div className="space-y-2">
        {groups?.map((g) => {
          const isExpanded = expanded === g.id
          const isAddingHere = addingTo === g.id
          const groupAthleteIds = new Set(g.members.map((m) => m.athleteId))
          const availableAthletes = athletes.filter((a) => !groupAthleteIds.has(a.userId))

          return (
            <div key={g.id} className="border border-border rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <button
                  onClick={() => setExpanded(isExpanded ? null : g.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left"
                >
                  <ChevronRightIcon className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-90")} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{g.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{g.members.length} {g.members.length === 1 ? "atleta" : "atletas"}</span>
                  </div>
                </button>
                {isCoach && (
                  <button
                    onClick={() => deleteGroup.mutate({ groupId: g.id })}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Eliminar grupo"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Members list */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/10 divide-y divide-border">
                  {g.members.map((m) => (
                    <div key={m.athleteId} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                        {m.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      {isCoach && (
                        <button
                          onClick={() => removeMember.mutate({ groupId: g.id, athleteId: m.athleteId })}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}

                  {g.members.length === 0 && (
                    <p className="text-xs text-muted-foreground px-5 py-3">Sin atletas en este grupo.</p>
                  )}

                  {isCoach && (
                    <div className="px-5 py-3">
                      {!isAddingHere ? (
                        <button
                          onClick={() => setAddingTo(isAddingHere ? null : g.id)}
                          disabled={availableAthletes.length === 0}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          {availableAthletes.length === 0 ? "Todos los atletas están en el grupo" : "Agregar atleta"}
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addMember.mutate({ groupId: g.id, athleteId: e.target.value })
                                setAddingTo(null)
                              }
                            }}
                            className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                          >
                            <option value="">Seleccionar atleta...</option>
                            {availableAthletes.map((a) => (
                              <option key={a.userId} value={a.userId}>{a.userName}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setAddingTo(null)}
                            className="text-xs text-muted-foreground hover:text-foreground border border-border px-2 py-1.5 rounded-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {groups?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin grupos todavía</p>
              {isCoach && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los grupos te permiten asignar rutinas a varios atletas a la vez.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
