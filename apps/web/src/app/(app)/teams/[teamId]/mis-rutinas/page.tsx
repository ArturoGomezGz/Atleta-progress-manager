"use client"

import { trpc } from "@/lib/trpc/client"
import { CalendarIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

type SessionStatus = "pending" | "in_progress" | "completed" | "skipped"

const STATUS_CONFIG: Record<SessionStatus, { label: string; cls: string }> = {
  pending:     { label: "Pendiente",   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  in_progress: { label: "En progreso", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed:   { label: "Completada",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  skipped:     { label: "Saltada",     cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
}

interface SessionCardProps {
  teamId: string
  session: {
    id: string
    routineName: string | null
    scheduledDate: string
    status: SessionStatus
    groupName: string | null
  }
}

function SessionCard({ teamId, session: s }: SessionCardProps) {
  const cfg = STATUS_CONFIG[s.status]
  const isClickable = s.status === "pending" || s.status === "in_progress"
  return (
    <Link
      href={isClickable ? `/teams/${teamId}/mis-rutinas/${s.id}` : "#"}
      onClick={(e) => !isClickable && e.preventDefault()}
      className={`flex items-center gap-3 px-4 py-3.5 border border-border rounded-xl bg-card/60 transition-all ${isClickable ? "hover:border-primary/30 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{s.routineName ?? "Rutina"}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {new Date(s.scheduledDate + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
          {s.groupName && ` · ${s.groupName}`}
        </div>
      </div>
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
        {cfg.label}
      </span>
      {isClickable && <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
    </Link>
  )
}

export default function MisRutinasPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: sessions, isLoading } = trpc.assignedSessions.myList.useQuery({ teamId })

  const todayStr = new Date().toISOString().split("T")[0]
  const todaySessions    = sessions?.filter((s) => s.scheduledDate === todayStr) ?? []
  const upcomingSessions = sessions?.filter((s) => s.scheduledDate > todayStr) ?? []
  const pastSessions     = sessions?.filter((s) => s.scheduledDate < todayStr) ?? []

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="h-7 w-36 bg-muted/40 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const isEmpty = !sessions || sessions.length === 0

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <h1
        className="text-2xl font-bold tracking-wider uppercase"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
      >
        Mis Rutinas
      </h1>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <CalendarIcon className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Tu coach aún no te ha asignado ninguna rutina.</p>
        </div>
      ) : (
        <>
          {todaySessions.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Hoy</p>
              {todaySessions.map((s) => (
                <SessionCard key={s.id} teamId={teamId} session={s} />
              ))}
            </section>
          )}
          {upcomingSessions.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Próximas</p>
              {upcomingSessions.map((s) => (
                <SessionCard key={s.id} teamId={teamId} session={s} />
              ))}
            </section>
          )}
          {pastSessions.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pasadas</p>
              {pastSessions.map((s) => (
                <SessionCard key={s.id} teamId={teamId} session={s} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
