"use client"

// Vista de detalle de un enlace de rutina compartida: el mismo lugar donde el
// entrenador comparte, revisa asistencia y desactiva — se llega aquí desde la
// tarjeta "Enlace activo" en Sesiones, o justo después de generarlo.

import { CopyButton, Stat } from "@/components/share-routine"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { ChevronLeftIcon, Link2Icon, Share2Icon, UserIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const STATUS_LABEL: Record<string, { label: string; badge: string; dot: string }> = {
  active:    { label: "Entrenando",  dot: "bg-green-400 animate-pulse",  badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  completed: { label: "Terminó",     dot: "bg-emerald-400",              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  claimed:   { label: "Se registró", dot: "bg-primary",                  badge: "bg-primary/10 text-primary border-primary/20" },
}

export function ShareLinkView({ teamId, routineId }: { teamId: string; routineId: string }) {
  const router = useRouter()
  const backHref = `/teams/${teamId}/rutinas`

  const { data: attendance, refetch, isLoading } = trpc.share.attendance.useQuery(
    { routineId },
    { refetchInterval: 8000 },
  )
  const revokeLink = trpc.share.revokeLink.useMutation({
    onSuccess: () => router.push(backHref),
  })
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <div className="h-6 w-28 bg-muted/40 rounded animate-pulse" />
        <div className="h-24 bg-muted/40 rounded-2xl animate-pulse" />
        <div className="h-40 bg-muted/40 rounded-2xl animate-pulse" />
      </div>
    )
  }

  // El enlace se desactivó (por este entrenador u otro) mientras la página estaba abierta
  if (!attendance) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <BackLink href={backHref} />
        <div className="border border-border rounded-2xl p-8 text-center space-y-2">
          <p className="text-base font-semibold">Este enlace ya no está activo</p>
          <p className="text-sm text-muted-foreground">Genera uno nuevo desde la plantilla si quieres seguir compartiéndola.</p>
        </div>
      </div>
    )
  }

  const url = `${window.location.origin}/r/${attendance.code}`
  const started = attendance.workouts.length
  const completed = attendance.workouts.filter((w) => w.status !== "active").length
  const claimed = attendance.workouts.filter((w) => w.claimedByName != null).length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <div>
        <BackLink href={backHref} />
        <div className="flex items-center gap-2 mt-2">
          <Link2Icon className="w-5 h-5 text-primary shrink-0" />
          <h1
            className="text-2xl font-bold tracking-wider uppercase truncate"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            {sc(attendance.routineName)}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Enlace activo desde {new Date(attendance.createdAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      {/* ── Compartir ── */}
      <section className="space-y-3 border border-border rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Compartir</h2>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Código</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 text-2xl font-bold tracking-[0.2em] text-center py-3 rounded-xl bg-muted/40 border border-border">
              {attendance.code}
            </p>
            <CopyButton value={attendance.code} label="Copiar código" />
          </div>
          <p className="text-xs text-muted-foreground">
            También pueden entrar a <strong>{window.location.host}/r</strong> y escribir el código.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Enlace</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm truncate px-3 py-2.5 rounded-xl bg-muted/40 border border-border">{url}</p>
            <CopyButton value={url} label="Copiar enlace" />
          </div>
        </div>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Te comparto esta rutina para entrenar: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 min-h-12 rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer"
        >
          <Share2Icon className="w-4 h-4" /> Enviar por WhatsApp
        </a>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Empezaron" value={started} />
          <Stat label="Terminaron" value={completed} />
          <Stat label="Se registraron" value={claimed} />
        </div>
      </section>

      {/* ── Asistencia ── */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Asistencia</h2>
        {attendance.workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-xl px-4 py-6 text-center">
            Nadie ha entrado todavía. Comparte el enlace o el código.
          </p>
        ) : (
          <div className="space-y-2">
            {attendance.workouts.map((w) => {
              const cfg = w.claimedByName ? STATUS_LABEL.claimed : STATUS_LABEL[w.status] ?? STATUS_LABEL.active
              return (
                <div key={w.id} className="flex items-center gap-3 px-3.5 py-3 border border-border rounded-xl bg-card/60">
                  <div className={cn("w-1 h-8 rounded-full shrink-0", cfg.dot)} />
                  <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.claimedByName ?? "Invitado"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(w.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                      {" · "}{w.doneSets} de {w.totalSets} series
                    </p>
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border shrink-0", cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Desactivar ── */}
      <section>
        {confirmRevoke ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm">
              El enlace dejará de funcionar para quien no lo haya abierto todavía. Los entrenamientos ya hechos se conservan.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRevoke(false)}
                className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => revokeLink.mutate({ routineId })}
                disabled={revokeLink.isPending}
                className="text-xs px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-medium cursor-pointer disabled:opacity-50"
              >
                {revokeLink.isPending ? "Desactivando…" : "Desactivar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRevoke(true)}
            className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors cursor-pointer py-2"
          >
            Desactivar enlace
          </button>
        )}
      </section>
    </div>
  )
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
    >
      <ChevronLeftIcon className="w-3.5 h-3.5" />
      Sesiones
    </Link>
  )
}
