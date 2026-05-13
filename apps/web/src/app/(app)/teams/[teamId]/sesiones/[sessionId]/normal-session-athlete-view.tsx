"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  ArrowLeftIcon,
  BatteryLowIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  FrownIcon,
  MehIcon,
  SmileIcon,
  ZapIcon,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

type Props = { sessionId: string; teamId: string; userId: string }

export function NormalSessionAthleteView({ sessionId, teamId, userId }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  const { data: session, refetch } = trpc.sessions.get.useQuery({ id: sessionId })

  const completeNormal = trpc.sessions.completeNormal.useMutation({
    onSuccess: () => {
      setConfirming(false)
      refetch()
      setShowFeedback(true)
    },
  })

  if (!session) {
    return <div className="p-8 text-muted-foreground text-sm">Cargando sesión...</div>
  }

  const myAthleteSession = session.athletes.find((a) => a.athleteId === userId)
  const isMySessionActive = myAthleteSession?.status === "active"
  const isMySessionCompleted = myAthleteSession?.status === "completed"
  const isSessionActive = session.status === "active"

  const canComplete = isMySessionActive && isSessionActive

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

      {/* ── Back + header ── */}
      <div className="space-y-3">
        <Link
          href={`/teams/${teamId}/sesiones`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Mis sesiones
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-bold tracking-wider uppercase leading-tight"
              style={{ fontFamily: "var(--font-barlow-condensed)" }}
            >
              {/* routineName comes from the routine, via the session snapshot */}
              Sesión
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(session as any).scheduledDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="w-3 h-3" />
                  {formatDate((session as any).scheduledDate)}
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded-md px-1.5 py-0.5">
                Normal
              </span>
            </div>
          </div>

          {(isMySessionCompleted || feedbackDone) && (
            <div className="flex items-center gap-1.5 text-emerald-400 shrink-0">
              <CheckCircle2Icon className="w-5 h-5" />
              <span className="text-sm font-medium">Completada</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Exercises ── */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ejercicios · {session.exercises.length}
        </p>

        {session.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
            Esta sesión no tiene ejercicios.
          </p>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {session.exercises.map((ex, i) => (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <p className="text-sm font-medium flex-1">{ex.exerciseName}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Cancelled state ── */}
      {myAthleteSession?.status === "cancelled" && (
        <div className="py-6 border border-rose-500/20 bg-rose-500/5 rounded-xl text-center">
          <p className="text-sm text-rose-400 font-medium">Tu participación fue cancelada</p>
          <p className="text-xs text-muted-foreground mt-1">Contacta a tu entrenador si crees que es un error.</p>
        </div>
      )}

      {/* ── Complete button (if active) ── */}
      {canComplete && !showFeedback && !feedbackDone && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-background/95 backdrop-blur-sm border-t border-border sm:relative sm:bottom-auto sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:py-0">
          <button
            onClick={() => setConfirming(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-lg shadow-primary/20"
          >
            <CheckIcon className="w-4 h-4" />
            Marcar como completada
          </button>
        </div>
      )}

      {/* ── Bottom spacer for fixed button on mobile ── */}
      {canComplete && !showFeedback && !feedbackDone && (
        <div className="h-20 sm:hidden" />
      )}

      {/* ── Confirmation bottom sheet ── */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <div
            className="bg-popover border border-border rounded-t-2xl sm:rounded-xl shadow-2xl p-6 w-full sm:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-5">
              <CheckCircle2Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¿Completar sesión?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirma que realizaste todos los ejercicios.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 rounded-xl border text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => completeNormal.mutate({ sessionId })}
                disabled={completeNormal.isPending}
                className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {completeNormal.isPending ? "Guardando..." : "Completar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback form ── */}
      {showFeedback && !feedbackDone && (
        <FeedbackForm
          sessionId={sessionId}
          onDone={() => {
            setShowFeedback(false)
            setFeedbackDone(true)
          }}
          onSkip={() => {
            setShowFeedback(false)
            setFeedbackDone(true)
          }}
        />
      )}

      {/* ── Completed + feedback sent ── */}
      {(isMySessionCompleted || feedbackDone) && !showFeedback && (
        <div className="py-10 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2Icon className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">¡Buen trabajo!</p>
            <p className="text-sm text-muted-foreground mt-1">Sesión registrada correctamente.</p>
          </div>
          <Link
            href={`/teams/${teamId}/sesiones`}
            className="text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
          >
            Ver mis sesiones →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Feedback form ────────────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { value: 1, icon: BatteryLowIcon, label: "Agotado" },
  { value: 2, icon: FrownIcon,      label: "Mal" },
  { value: 3, icon: MehIcon,        label: "Regular" },
  { value: 4, icon: SmileIcon,      label: "Bien" },
  { value: 5, icon: ZapIcon,        label: "Excelente" },
]

function FeedbackForm({
  sessionId,
  onDone,
  onSkip,
}: {
  sessionId: string
  onDone: () => void
  onSkip: () => void
}) {
  const [effort, setEffort] = useState<number | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [notes, setNotes] = useState("")

  const submitFeedback = trpc.sessions.submitFeedback.useMutation({ onSuccess: onDone })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitFeedback.mutate({ sessionId, effort, mood, notes: notes.trim() || null })
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <div className="bg-muted/20 px-5 py-4 border-b border-border">
        <p
          className="text-base font-bold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          ¿Cómo estuvo?
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Opcional — ayuda a tu entrenador</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        {/* Esfuerzo */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Esfuerzo percibido
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEffort(effort === n ? null : n)}
                className={cn(
                  "flex-1 h-10 rounded-lg border text-sm font-semibold transition-all duration-150 cursor-pointer",
                  effort === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between px-0.5">
            <span className="text-[10px] text-muted-foreground">Ligero</span>
            <span className="text-[10px] text-muted-foreground">Máximo</span>
          </div>
        </div>

        {/* Sensación */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sensación general
          </p>
          <div className="flex gap-2">
            {MOOD_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMood(mood === value ? null : value)}
                title={label}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all duration-150 cursor-pointer",
                  mood === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium hidden sm:block">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Notas
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Algo que quieras comentar a tu entrenador?"
            maxLength={1000}
            rows={3}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-3 rounded-xl border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            Omitir
          </button>
          <button
            type="submit"
            disabled={submitFeedback.isPending}
            className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors cursor-pointer"
          >
            {submitFeedback.isPending ? "Enviando..." : "Enviar feedback"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}
