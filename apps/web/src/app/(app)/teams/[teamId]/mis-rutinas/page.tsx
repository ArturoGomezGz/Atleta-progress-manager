"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { DumbbellIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

type SessionStatus = "active" | "completed" | "cancelled"

const STATUS_CONFIG: Record<SessionStatus, { label: string; dot: string; badge: string }> = {
  active:    { label: "En curso",    dot: "bg-green-400 animate-pulse", badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  completed: { label: "Completada",  dot: "bg-emerald-400",             badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelada",   dot: "bg-rose-400",                badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
}

function SessionCard({
  teamId,
  session,
}: {
  teamId: string
  session: { id: string; routineName: string | null; startedAt: string; status: string }
}) {
  const cfg = STATUS_CONFIG[session.status as SessionStatus] ?? {
    dot: "bg-muted-foreground", badge: "bg-muted/20 text-muted-foreground border-border", label: session.status,
  }
  const isClickable = session.status !== "cancelled"

  return (
    <Link
      href={isClickable ? `/teams/${teamId}/mis-rutinas/${session.id}` : "#"}
      onClick={(e) => !isClickable && e.preventDefault()}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 border border-border rounded-xl bg-card/60 transition-all",
        isClickable ? "hover:border-primary/30 cursor-pointer" : "cursor-default opacity-60",
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{session.routineName ?? "Rutina"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <span className={cn("shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.badge)}>
        {cfg.label}
      </span>
    </Link>
  )
}

export default function MisRutinasPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: sessions, isLoading } = trpc.sessions.myList.useQuery({ teamId })

  const active    = sessions?.filter((s) => s.status === "active") ?? []
  const past      = sessions?.filter((s) => s.status !== "active") ?? []

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="h-7 w-36 bg-muted/40 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}
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
          <DumbbellIcon className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Tu coach aún no ha iniciado ninguna sesión contigo.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">En curso</p>
              </div>
              {active.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Historial</p>
              {past.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}
