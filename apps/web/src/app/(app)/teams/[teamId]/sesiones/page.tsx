"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { PlusIcon } from "lucide-react"
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
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sesiones</h1>
        {isCoach && (
          <Link
            href={`/teams/${teamId}/sesiones/new`}
            className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
          >
            <PlusIcon className="w-4 h-4" />
            Comenzar rutina
          </Link>
        )}
      </div>

      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activas</p>
          {active.map((s) => (
            <SessionCard key={s.id} teamId={teamId} session={s} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Historial</p>
          {past.map((s) => (
            <SessionCard key={s.id} teamId={teamId} session={s} />
          ))}
        </section>
      )}

      {sessions?.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12 border rounded-lg">
          Sin sesiones todavía.{isCoach ? " Comienza una rutina." : ""}
        </p>
      )}
    </div>
  )
}

function SessionCard({
  teamId,
  session,
}: {
  teamId: string
  session: { id: string; status: string; startedAt: string; routineName: string }
}) {
  const statusLabel: Record<string, string> = {
    active: "Activa",
    completed: "Completada",
    cancelled: "Cancelada",
  }

  return (
    <Link
      href={`/teams/${teamId}/sesiones/${session.id}`}
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div>
        <p className="font-medium text-sm">{session.routineName}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <span
        className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full border",
          session.status === "active" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
          session.status === "completed" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
          session.status === "cancelled" && "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
        )}
      >
        {statusLabel[session.status] ?? session.status}
      </span>
    </Link>
  )
}
