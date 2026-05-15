"use client"

import { HlsVideoPlayer } from "@/components/hls-video-player"
import { useSession } from "@/lib/auth"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  DumbbellIcon,
  PlayIcon,
  TimerIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

type Target = {
  id: string
  sessionExerciseId: string
  setNumber: number
  targetReps: number | null
  targetPercent: string | null
}

type SetRec = {
  id: string
  sessionExerciseId: string
  sessionSetTargetId: string | null
  setNumber: number
  reps: number
  weightLbs: string
  status: "valid" | "invalid"
}

type Exercise = {
  id: string
  exerciseId: string
  exerciseName: string
  videoUrl: string | null
  order: number
  tempo: string | null
  restSeconds: number | null
  notes: string | null
  targets: Target[]
  sets: SetRec[]
}

type Progress = {
  id: string
  status: string
  startedAt: string
  routineName: string | null
  exercises: Exercise[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcWeight(targetPercent: string | null, rmLbs: string | null | undefined): string {
  if (!targetPercent || !rmLbs) return ""
  const raw = Number(rmLbs) * Number(targetPercent) / 100
  return (Math.ceil(raw * 2) / 2).toFixed(1)
}

function findCurrentPosition(exercises: Exercise[]) {
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei]
    for (const target of ex.targets) {
      const done = ex.sets.some((s) => s.sessionSetTargetId === target.id)
      if (!done) return { exercise: ex, target, exerciseIdx: ei }
    }
  }
  return null
}

function totalSets(exercises: Exercise[]) {
  return exercises.reduce((s, ex) => s + ex.targets.length, 0)
}

function doneSets(exercises: Exercise[]) {
  return exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.sessionSetTargetId !== null).length, 0)
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function AthleteSessionView({ sessionId }: { sessionId: string }) {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: authSession } = useSession()
  const userId = authSession?.user.id ?? ""

  const { data: progress, refetch, isLoading } = trpc.sessions.myProgress.useQuery(
    { sessionId },
    { refetchInterval: (q) => q.state.data?.status === "active" ? 8000 : false },
  )

  const { data: rms } = trpc.sessions.athleteRms.useQuery(
    { sessionId, athleteId: userId },
    { enabled: !!userId && (progress?.status === "active" || progress?.status === "completed") },
  )

  const { data: prefs } = trpc.preferences.get.useQuery(undefined, {
    enabled: progress?.status === "active",
  })

  const backHref = `/teams/${teamId}/mis-rutinas`

  if (isLoading || !progress) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div className="h-5 w-24 bg-muted/40 rounded animate-pulse" />
        <div className="h-8 w-48 bg-muted/40 rounded animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (progress.status === "scheduled") {
    return (
      <ScheduledPreview
        sessionId={sessionId}
        progress={progress}
        backHref={backHref}
        onActivated={() => refetch()}
      />
    )
  }

  if (progress.status === "active") {
    return (
      <ActiveExecution
        sessionId={sessionId}
        userId={userId}
        progress={progress}
        rms={rms ?? {}}
        restTimerEnabled={prefs?.restTimerEnabled ?? false}
        restTimerSeconds={prefs?.restTimerSeconds ?? 90}
        backHref={backHref}
        onUpdate={() => refetch()}
      />
    )
  }

  return (
    <CompletedHistory
      progress={progress}
      backHref={backHref}
    />
  )
}

// ─── Scheduled preview ─────────────────────────────────────────────────────────

function ScheduledPreview({
  sessionId, progress, backHref, onActivated,
}: {
  sessionId: string
  progress: Progress
  backHref: string
  onActivated: () => void
}) {
  const activate = trpc.sessions.activate.useMutation({ onSuccess: onActivated })

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-6 pb-32">
      <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeftIcon className="w-4 h-4" />
        Mis rutinas
      </Link>

      <div>
        <h1
          className="text-3xl font-bold tracking-wider uppercase leading-tight"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          {progress.routineName ?? "Rutina"}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-sm text-muted-foreground">Sesión programada</p>
        </div>
      </div>

      {/* Exercise preview list */}
      {progress.exercises.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Ejercicios — {progress.exercises.length} en total
          </p>
          <div className="space-y-2">
            {progress.exercises.map((ex, i) => (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-card/60">
                <span className="text-xs font-bold text-muted-foreground/50 w-5 shrink-0"
                  style={{ fontFamily: "var(--font-barlow-condensed)" }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ex.exerciseName}</p>
                  {ex.tempo && <p className="text-xs text-muted-foreground mt-0.5">Tempo {ex.tempo}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ex.targets.length} series
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => activate.mutate({ id: sessionId })}
            disabled={activate.isPending}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-primary text-primary-foreground font-bold text-lg tracking-wide cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-transform"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            <PlayIcon className="w-5 h-5" />
            {activate.isPending ? "Iniciando…" : "COMENZAR RUTINA"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Active execution ──────────────────────────────────────────────────────────

function ActiveExecution({
  sessionId, userId, progress, rms, restTimerEnabled, restTimerSeconds, backHref, onUpdate,
}: {
  sessionId: string
  userId: string
  progress: Progress
  rms: Record<string, string>
  restTimerEnabled: boolean
  restTimerSeconds: number
  backHref: string
  onUpdate: () => void
}) {
  const [restLeft, setRestLeft] = useState<number | null>(null)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startRest(seconds: number) {
    setRestLeft(seconds)
    restRef.current = setInterval(() => {
      setRestLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(restRef.current!)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (restRef.current) clearInterval(restRef.current)
    setRestLeft(null)
  }

  useEffect(() => () => { if (restRef.current) clearInterval(restRef.current) }, [])

  const position = findCurrentPosition(progress.exercises)
  const total    = totalSets(progress.exercises)
  const done     = doneSets(progress.exercises)

  if (!position) {
    return (
      <AllDone
        progress={progress}
        backHref={backHref}
        doneSets={done}
      />
    )
  }

  if (restLeft !== null) {
    return (
      <RestTimer
        seconds={restLeft}
        totalSeconds={restTimerSeconds}
        onSkip={skipRest}
      />
    )
  }

  const { exercise: curEx, target: curTarget, exerciseIdx } = position
  const rmLbs = rms[curEx.exerciseId] ?? null
  const calcedWeight = calcWeight(curTarget.targetPercent, rmLbs)

  return (
    <SetExecution
      sessionId={sessionId}
      userId={userId}
      exercise={curEx}
      target={curTarget}
      exerciseIdx={exerciseIdx}
      totalExercises={progress.exercises.length}
      totalSetsGlobal={total}
      doneSetsGlobal={done}
      defaultWeight={calcedWeight}
      rmLbs={rmLbs}
      backHref={backHref}
      onComplete={() => {
        onUpdate()
        if (restTimerEnabled && curEx.restSeconds) startRest(curEx.restSeconds)
        else if (restTimerEnabled) startRest(restTimerSeconds)
      }}
    />
  )
}

// ─── Set execution ─────────────────────────────────────────────────────────────

function SetExecution({
  sessionId, userId, exercise, target, exerciseIdx, totalExercises,
  totalSetsGlobal, doneSetsGlobal, defaultWeight, rmLbs, backHref, onComplete,
}: {
  sessionId: string
  userId: string
  exercise: Exercise
  target: Target
  exerciseIdx: number
  totalExercises: number
  totalSetsGlobal: number
  doneSetsGlobal: number
  defaultWeight: string
  rmLbs: string | null
  backHref: string
  onComplete: () => void
}) {
  const [showVideo, setShowVideo] = useState(false)

  const recordSet = trpc.sessions.recordSet.useMutation({
    onSuccess: () => onComplete(),
  })

  const progressPct = totalSetsGlobal > 0 ? Math.round((doneSetsGlobal / totalSetsGlobal) * 100) : 0

  function handleComplete() {
    recordSet.mutate({
      sessionId,
      athleteId: userId,
      sessionExerciseId: exercise.id,
      sessionSetTargetId: target.id,
      setNumber: target.setNumber,
      reps: target.targetReps ?? 0,
      weightLbs: defaultWeight || "0",
    })
  }

  const setLabel   = `SERIE ${target.setNumber} DE ${exercise.targets.length}`
  const hasVideo   = !!exercise.videoUrl
  const hasPercent = !!target.targetPercent

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* ── Progress bar + minimal header ── */}
      <div className="shrink-0 border-b border-border">
        <div className="h-1 bg-muted/30">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={backHref} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl cursor-pointer">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <p className="text-xs text-muted-foreground">
            Ejercicio {exerciseIdx + 1} de {totalExercises}
          </p>
        </div>
      </div>

      {/* ── Main execution area ── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">

          {/* Exercise name + video button */}
          <div className="flex items-center gap-3 w-full max-w-sm">
            <h2
              className="flex-1 text-2xl font-bold tracking-wide uppercase leading-tight"
              style={{ fontFamily: "var(--font-barlow-condensed)" }}
            >
              {exercise.exerciseName}
            </h2>
            {hasVideo && (
              <button
                onClick={() => setShowVideo(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
                aria-label="Ver video del ejercicio"
              >
                <VideoIcon className="w-4 h-4" />
                <span className="text-xs font-medium">Video</span>
              </button>
            )}
          </div>

          {/* Set label */}
          <p
            className="text-primary font-bold tracking-widest text-lg"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            {setLabel}
          </p>

          {/* Target values cards */}
          <div className="flex gap-4 w-full max-w-sm">
            <div className="flex-1 flex flex-col items-center justify-center gap-1 py-6 rounded-2xl bg-card border border-border">
              <span
                className="text-5xl font-bold text-foreground leading-none"
                style={{ fontFamily: "var(--font-barlow-condensed)" }}
              >
                {target.targetReps ?? "—"}
              </span>
              <span className="text-sm text-muted-foreground mt-1">reps</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-1 py-6 rounded-2xl bg-card border border-border">
              <span
                className="text-5xl font-bold text-foreground leading-none"
                style={{ fontFamily: "var(--font-barlow-condensed)" }}
              >
                {defaultWeight || "—"}
              </span>
              <span className="text-sm text-muted-foreground mt-1">lbs</span>
              {hasPercent && rmLbs && (
                <span className="text-xs text-primary/70">{target.targetPercent}% RM</span>
              )}
            </div>
          </div>

          {/* Secondary info */}
          {(exercise.tempo || exercise.restSeconds) && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {exercise.tempo && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TimerIcon className="w-3.5 h-3.5" />
                  Tempo {exercise.tempo}
                </span>
              )}
              {exercise.restSeconds && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TimerIcon className="w-3.5 h-3.5" />
                  Descanso {exercise.restSeconds}s
                </span>
              )}
            </div>
          )}
          {exercise.notes && (
            <p className="text-sm text-muted-foreground text-center max-w-xs">{exercise.notes}</p>
          )}
        </div>

        {/* ── Bottom action area ── */}
        <div className="shrink-0 px-4 pb-6">
          <button
            onClick={handleComplete}
            disabled={recordSet.isPending}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-6 rounded-2xl font-bold text-xl tracking-wide cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50",
              "bg-primary text-primary-foreground",
            )}
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            {recordSet.isPending ? (
              <span className="text-lg">Guardando…</span>
            ) : (
              <>
                <CheckCircleIcon className="w-6 h-6" />
                SERIE COMPLETADA
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Video modal ── */}
      {showVideo && exercise.videoUrl && (
        <VideoModal
          name={exercise.exerciseName}
          videoUrl={exercise.videoUrl}
          onClose={() => setShowVideo(false)}
        />
      )}
    </div>
  )
}

// ─── Rest timer ────────────────────────────────────────────────────────────────

function RestTimer({ seconds, totalSeconds, onSkip }: {
  seconds: number
  totalSeconds: number
  onSkip: () => void
}) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const pct  = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0
  const circumference = 2 * Math.PI * 54

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] items-center justify-center gap-8 px-6">
      <p
        className="text-muted-foreground text-lg font-semibold tracking-widest uppercase"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
      >
        Descansando
      </p>

      {/* Circular countdown */}
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke="currentColor" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            className="text-primary transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-4xl font-bold"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : secs}
          </span>
        </div>
      </div>

      <button
        onClick={onSkip}
        className="px-8 py-4 rounded-2xl border border-border text-base font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
      >
        Saltar descanso
      </button>
    </div>
  )
}

// ─── All done ──────────────────────────────────────────────────────────────────

function AllDone({ progress, backHref, doneSets: done }: {
  progress: Progress
  backHref: string
  doneSets: number
}) {
  const completeSession = trpc.sessions.completeMySession.useMutation()

  useEffect(() => {
    completeSession.mutate({ sessionId: progress.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.id])

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] items-center justify-center gap-8 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
        <CheckCircleIcon className="w-10 h-10 text-primary" />
      </div>

      <div>
        <h2
          className="text-4xl font-bold tracking-wide uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          ¡Rutina completada!
        </h2>
        <p className="text-muted-foreground mt-2">
          {progress.exercises.length} ejercicios · {done} series registradas
        </p>
      </div>

      <Link
        href={backHref}
        className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg tracking-wide cursor-pointer"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
      >
        <ArrowLeftIcon className="w-5 h-5" />
        VOLVER A MIS RUTINAS
      </Link>
    </div>
  )
}

// ─── Completed history ─────────────────────────────────────────────────────────

function CompletedHistory({ progress, backHref }: { progress: Progress; backHref: string }) {
  const isCancelled = progress.status === "cancelled"
  const validSets   = progress.exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.status === "valid").length, 0)

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeftIcon className="w-4 h-4" />
        Mis rutinas
      </Link>

      <div>
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          {progress.routineName ?? "Rutina"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(progress.startedAt).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      {!isCancelled && validSets > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 border border-emerald-500/30 bg-emerald-500/[0.06] rounded-xl">
          <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400 font-medium">{validSets} series completadas</p>
        </div>
      )}

      <div className="space-y-3">
        {progress.exercises.map((ex) => (
          <div key={ex.id} className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/10 border-b border-border flex items-center gap-3">
              <DumbbellIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="font-semibold text-sm">{ex.exerciseName}</p>
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                {ex.sets.filter((s) => s.status === "valid").length}/{ex.targets.length}
              </span>
            </div>

            {ex.sets.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground italic">Sin series registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {ex.sets.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 text-sm",
                      s.status === "invalid" && "opacity-40",
                    )}
                  >
                    <span className="text-xs text-muted-foreground w-14 shrink-0">Serie {s.setNumber}</span>
                    <span className="font-semibold">{s.reps} reps</span>
                    {Number(s.weightLbs) > 0 && (
                      <span className="text-muted-foreground">{s.weightLbs} lbs</span>
                    )}
                    {s.status === "invalid" && (
                      <span className="ml-auto text-[10px] text-rose-400/70 font-medium shrink-0">Inválida</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Video modal ───────────────────────────────────────────────────────────────

function VideoModal({ name, videoUrl, onClose }: {
  name: string
  videoUrl: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Video 9:16 — ocupa el máximo alto disponible */}
      <div
        className="relative h-[90dvh] w-auto overflow-hidden rounded-lg"
        style={{ aspectRatio: "9 / 16" }}
        onClick={(e) => e.stopPropagation()}
      >
        <HlsVideoPlayer videoId={videoUrl} className="w-full h-full" />

        {/* Botón cerrar — encima del player (z-30 > z-20 del flash) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors cursor-pointer"
          aria-label="Cerrar video"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Nombre del ejercicio — sutil, debajo del video */}
      <p
        className="mt-3 text-xs text-white/40 uppercase tracking-widest"
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {name}
      </p>
    </div>
  )
}
