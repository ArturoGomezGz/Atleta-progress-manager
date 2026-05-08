"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { ChevronRightIcon, PlusIcon, ZapIcon } from "lucide-react"
import Link from "next/link"
import { use } from "react"

export default function SesionesPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: sessions } = trpc.sessions.list.useQuery({ teamId })

  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  const active = sessions?.filter((s) => s.status === "active") ?? []
  const past = sessions?.filter((s) => s.status !== "active") ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Sesiones
        </h1>
        {isCoach && (
          <Link
            href={`/teams/${teamId}/sesiones/new`}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3.5 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer shadow-lg shadow-primary/20"
          >
            <PlusIcon className="w-4 h-4" />
            Comenzar rutina
          </Link>
        )}
      </div>

      {active.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">En curso</p>
          </div>
          {active.map((s) => (
            <SessionCard key={s.id} teamId={teamId} session={s} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Historial</p>
          {past.map((s) => (
            <SessionCard key={s.id} teamId={teamId} session={s} />
          ))}
        </section>
      )}

      {sessions?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
            <ZapIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Sin sesiones todavía</p>
            {isCoach && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Comienza una rutina para registrar el rendimiento del equipo.
              </p>
            )}
          </div>
          {isCoach && (
            <Link
              href={`/teams/${teamId}/sesiones/new`}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer mt-1"
            >
              <PlusIcon className="w-4 h-4" />
              Comenzar rutina
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_CONFIG = {
  active: {
    label: "Activa",
    dot: "bg-green-400",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  completed: {
    label: "Completada",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelada",
    dot: "bg-rose-400",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
} as const

function SessionCard({
  teamId,
  session,
}: {
  teamId: string
  session: { id: string; status: string; startedAt: string; routineName: string }
}) {
  const config = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG] ?? {
    label: session.status,
    dot: "bg-muted-foreground",
    badge: "bg-muted/20 text-muted-foreground border-border",
  }

  return (
    <Link
      href={`/teams/${teamId}/sesiones/${session.id}`}
      className="group flex items-center gap-3 p-4 border border-border rounded-xl hover:border-primary/30 hover:bg-card bg-card/60 transition-all duration-200 cursor-pointer"
    >
      {/* Status accent bar */}
      <div className={cn("w-1 h-9 rounded-full shrink-0", config.dot)} />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors duration-200 truncate">
          {session.routineName}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", config.badge)}>
          {config.label}
        </span>
        <ChevronRightIcon className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
    </Link>
  )
}
