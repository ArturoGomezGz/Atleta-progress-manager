"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { CalendarIcon, CheckCircleIcon, ChevronRightIcon, CompassIcon, DumbbellIcon, PlayIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

type Session = {
  id: string
  routineName: string | null
  startedAt: string
  scheduledDate: string | null
  status: string
  routineCategory: string | null
}

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function dateLabel(session: Session) {
  if (session.scheduledDate) {
    const d = new Date(session.scheduledDate + "T12:00:00")
    const today = new Date()
    const tomorrow = new Date(Date.now() + 86400000)
    if (d.toDateString() === today.toDateString()) return "Hoy"
    if (d.toDateString() === tomorrow.toDateString()) return "Mañana"
    return sc(d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }))
  }
  return sc(new Date(session.startedAt).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }))
}

function SessionCard({ teamId, session }: { teamId: string; session: Session }) {
  const isCancelled = session.status === "cancelled"
  const action =
    session.status === "active"    ? { label: "Continuar",  icon: PlayIcon,        tone: "bg-primary text-primary-foreground" } :
    session.status === "scheduled" ? { label: "Empezar",    icon: PlayIcon,        tone: "bg-primary text-primary-foreground" } :
    session.status === "completed" ? { label: "Ver resumen", icon: CheckCircleIcon, tone: "bg-muted text-foreground" } :
                                     { label: "Cancelada",  icon: null,            tone: "bg-muted text-muted-foreground" }
  const Icon = action.icon

  const content = (
    <>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-lg font-semibold leading-snug">{sc(session.routineName ?? "Rutina")}</p>
        <p className="text-base text-muted-foreground flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 shrink-0" />
          {dateLabel(session)}
        </p>
      </div>
      <span className={cn("shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl text-base font-semibold", action.tone)}>
        {Icon && <Icon className="w-5 h-5" />}
        {action.label}
        {!isCancelled && <ChevronRightIcon className="w-4 h-4 -mr-1 opacity-70" />}
      </span>
    </>
  )

  const cardClass = "flex items-center gap-4 p-4 sm:p-5 border border-border rounded-2xl bg-card"

  if (isCancelled) return <div className={cn(cardClass, "opacity-60")}>{content}</div>

  return (
    <Link href={`/teams/${teamId}/mis-rutinas/${session.id}`} className={cn(cardClass, "hover:border-primary/50 active:scale-[0.99] transition-all")}>
      {content}
    </Link>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default function MisRutinasPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: sessions, isLoading } = trpc.sessions.myList.useQuery({ teamId })

  const active    = sessions?.filter((s) => s.status === "active") ?? []
  const scheduled = (sessions?.filter((s) => s.status === "scheduled" && s.routineCategory === "training") ?? [])
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
  const past      = sessions?.filter((s) => s.status === "completed" || s.status === "cancelled") ?? []

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <div className="h-9 w-48 bg-muted/40 rounded animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted/40 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Mis rutinas</h1>
        <p className="text-base text-muted-foreground">Toca una rutina para ver los ejercicios y sus videos.</p>
      </div>

      {active.length > 0 && (
        <Section title="En curso">
          {active.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
        </Section>
      )}

      {scheduled.length > 0 && (
        <Section title="Para hacer">
          {scheduled.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
        </Section>
      )}

      {scheduled.length === 0 && active.length === 0 && (
        <Section title="Para hacer">
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed border-border rounded-2xl px-6">
            <DumbbellIcon className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-lg">No tienes rutinas pendientes.</p>
            <Link
              href={`/teams/${teamId}/explorar`}
              className="inline-flex items-center gap-2 mt-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 transition-colors"
            >
              <CompassIcon className="w-5 h-5" /> Puedes explorar ejercicios
            </Link>
          </div>
        </Section>
      )}

      {past.length > 0 && (
        <Section title="Terminadas">
          {past.map((s) => <SessionCard key={s.id} teamId={teamId} session={s} />)}
        </Section>
      )}
    </div>
  )
}
