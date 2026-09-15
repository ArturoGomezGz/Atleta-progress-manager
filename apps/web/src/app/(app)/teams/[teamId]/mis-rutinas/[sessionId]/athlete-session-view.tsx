"use client"

import { YouTubePlayer, YouTubeThumb } from "@/components/youtube-player"
import { useSession } from "@/lib/auth"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { describeTarget, explainTempo, formatDuration, isTimeTarget, summarizeTargets } from "@/lib/workout-text"
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  InfoIcon,
  ListIcon,
  MessageSquareIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  RotateCcwIcon,
  TimerIcon,
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
  setType: string
  targetReps: number | null
  targetDurationSeconds: number | null
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
  description: string | null
  youtubeVideoId: string | null
  youtubeTitle: string | null
  videoOrientation: "horizontal" | "vertical"
  order: number
  tempo: string | null
  restSeconds: number | null
  notes: string | null
  blockName: string | null
  rounds: number
  roundNumber: number | null
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

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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

const totalSets = (exercises: Exercise[]) => exercises.reduce((s, ex) => s + ex.targets.length, 0)
const doneSets  = (exercises: Exercise[]) =>
  exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.sessionSetTargetId !== null).length, 0)
const doneFor   = (ex: Exercise) => ex.sets.filter((r) => r.sessionSetTargetId !== null).length

// Descanso usado cuando el ejercicio no trae uno propio definido por el entrenador.
const DEFAULT_REST_SECONDS = 90

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* no soportado */ }
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

  const backHref = `/teams/${teamId}/mis-rutinas`

  if (isLoading || !progress) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <div className="h-6 w-28 bg-muted/40 rounded animate-pulse" />
        <div className="h-10 w-56 bg-muted/40 rounded animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted/40 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  const typed = progress as unknown as Progress

  if (typed.status === "scheduled") {
    return (
      <ScheduledPreview
        sessionId={sessionId}
        progress={typed}
        backHref={backHref}
        onActivated={() => refetch()}
      />
    )
  }

  if (typed.status === "active") {
    return (
      <ActiveExecution
        sessionId={sessionId}
        userId={userId}
        progress={typed}
        rms={rms ?? {}}
        backHref={backHref}
        onUpdate={() => refetch()}
      />
    )
  }

  return <CompletedHistory progress={typed} backHref={backHref} />
}

// ─── Shared pieces ─────────────────────────────────────────────────────────────

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-3 py-2.5 -ml-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
    >
      <ArrowLeftIcon className="w-5 h-5" />
      {label}
    </Link>
  )
}

function VideoModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  if (!exercise.youtubeVideoId) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={`Video: ${exercise.exerciseName}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-lg font-semibold truncate">{exercise.exerciseName}</p>
        <button
          onClick={onClose}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-base font-semibold cursor-pointer"
        >
          <XIcon className="w-5 h-5" /> Cerrar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="max-w-3xl mx-auto space-y-4 [&_a]:text-white/80 [&_button]:text-white/90">
          <YouTubePlayer
            videoId={exercise.youtubeVideoId}
            title={exercise.exerciseName}
            orientation={exercise.videoOrientation}
            autoStart
            large
          />
          {exercise.description && <p className="text-base text-white/80 leading-relaxed">{exercise.description}</p>}
        </div>
      </div>
    </div>
  )
}

function NotesModal({ notes, onClose }: { notes: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Indicaciones de tu entrenador"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-amber-500/30 p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold flex items-center gap-2 text-lg">
            <MessageSquareIcon className="w-5 h-5 text-amber-600" /> Indicaciones de tu entrenador
          </p>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 cursor-pointer" aria-label="Cerrar">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-base leading-relaxed">{notes}</p>
      </div>
    </div>
  )
}

function ExerciseOverviewCard({
  exercise, index, onWatch, highlight,
}: {
  exercise: Exercise
  index: number
  onWatch: () => void
  highlight?: "current" | "done"
}) {
  const done = doneFor(exercise)
  const total = exercise.targets.length

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden",
      highlight === "current" ? "border-primary ring-2 ring-primary/30" : "border-border",
    )}>
      <div className="flex gap-3 p-3">
        {exercise.youtubeVideoId ? (
          <button onClick={onWatch} className="shrink-0 cursor-pointer rounded-xl overflow-hidden" aria-label={`Ver video de ${exercise.exerciseName}`}>
            <YouTubeThumb videoId={exercise.youtubeVideoId} alt={exercise.exerciseName} showPlay className="w-32 sm:w-40 aspect-video" />
          </button>
        ) : (
          <div className="shrink-0 w-32 sm:w-40 aspect-video rounded-xl bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
            {index + 1}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1 py-0.5">
          <p className="text-sm text-muted-foreground">Ejercicio {index + 1}</p>
          <p className="text-lg font-semibold leading-snug">{exercise.exerciseName}</p>
          <p className="text-base">{summarizeTargets(exercise.targets)}</p>
          {exercise.blockName && (
            <p className="text-sm text-primary flex items-center gap-1">
              <RepeatIcon className="w-4 h-4" /> {exercise.blockName}
              {exercise.roundNumber && ` · ronda ${exercise.roundNumber} de ${exercise.rounds}`}
            </p>
          )}
        </div>
      </div>

      {(exercise.notes || highlight === "done" || (done > 0 && done < total)) && (
        <div className="px-4 pb-3 space-y-2">
          {exercise.notes && (
            <p className="text-base text-muted-foreground flex gap-2">
              <MessageSquareIcon className="w-4 h-4 mt-1 shrink-0" />
              {exercise.notes}
            </p>
          )}
          {done > 0 && (
            <p className={cn("text-base font-medium flex items-center gap-2", done >= total ? "text-emerald-500" : "text-primary")}>
              <CheckCircleIcon className="w-5 h-5" />
              {done >= total ? "Terminado" : `${done} de ${total} series hechas`}
            </p>
          )}
        </div>
      )}

      {exercise.youtubeVideoId && (
        <button
          onClick={onWatch}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-t border-border text-base font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors"
        >
          <PlayIcon className="w-5 h-5" /> Ver cómo se hace
        </button>
      )}
    </div>
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
  const [video, setVideo] = useState<Exercise | null>(null)
  const total = totalSets(progress.exercises)

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-6 pb-40">
      <BackLink href={backHref} label="Mis rutinas" />

      <div className="space-y-2">
        <h1 className="text-3xl font-bold leading-tight">{sc(progress.routineName ?? "Rutina")}</h1>
        <p className="text-base text-muted-foreground flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          {progress.exercises.length} ejercicios · {total} series en total
        </p>
      </div>

      <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-base leading-relaxed">
        Antes de empezar, puedes tocar cada ejercicio para <strong>ver el video</strong> de cómo se hace.
        Cuando estés listo, pulsa <strong>Empezar rutina</strong>.
      </div>

      <div className="space-y-3">
        {progress.exercises.map((ex, i) => (
          <ExerciseOverviewCard key={ex.id} exercise={ex} index={i} onWatch={() => setVideo(ex)} />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-56 px-4 py-4 bg-background/95 backdrop-blur-sm border-t border-border z-30">
        <div className="max-w-xl mx-auto">
          <button
            onClick={() => activate.mutate({ id: sessionId })}
            disabled={activate.isPending}
            className="w-full flex items-center justify-center gap-3 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <PlayIcon className="w-6 h-6 fill-current" />
            {activate.isPending ? "Preparando…" : "Empezar rutina"}
          </button>
          {activate.isError && (
            <p className="text-base text-destructive text-center mt-2">No se pudo empezar. Inténtalo de nuevo.</p>
          )}
        </div>
      </div>

      {video && <VideoModal exercise={video} onClose={() => setVideo(null)} />}
    </div>
  )
}

// ─── Active execution ──────────────────────────────────────────────────────────

function ActiveExecution({
  sessionId, userId, progress, rms, backHref, onUpdate,
}: {
  sessionId: string
  userId: string
  progress: Progress
  rms: Record<string, string>
  backHref: string
  onUpdate: () => void
}) {
  const [rest, setRest] = useState<{ left: number; total: number; overtime: number | null } | null>(null)
  const [showOverview, setShowOverview] = useState(false)
  const [video, setVideo] = useState<Exercise | null>(null)
  // Se apaga por defecto en cada sesión de entrenamiento; si el atleta lo activa en un
  // descanso, se mantiene activo para los siguientes descansos de esta misma sesión.
  const [autoContinue, setAutoContinue] = useState(false)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoContinueRef = useRef(autoContinue)
  autoContinueRef.current = autoContinue

  function startRest(seconds: number) {
    if (restRef.current) clearInterval(restRef.current)
    setRest({ left: seconds, total: seconds, overtime: null })
    restRef.current = setInterval(() => {
      setRest((prev) => {
        if (!prev) return prev
        if (prev.overtime !== null) return { ...prev, overtime: prev.overtime + 1 }
        if (prev.left <= 1) {
          vibrate([200, 100, 200])
          if (autoContinueRef.current) {
            clearInterval(restRef.current!)
            return null
          }
          return { ...prev, left: 0, overtime: 0 }
        }
        return { ...prev, left: prev.left - 1 }
      })
    }, 1000)
  }

  function skipRest() {
    if (restRef.current) clearInterval(restRef.current)
    setRest(null)
  }

  useEffect(() => () => { if (restRef.current) clearInterval(restRef.current) }, [])

  const position = findCurrentPosition(progress.exercises)
  const total    = totalSets(progress.exercises)
  const done     = doneSets(progress.exercises)

  if (!position) return <AllDone progress={progress} backHref={backHref} doneSets={done} />

  if (rest) {
    return (
      <RestTimer
        seconds={rest.left}
        totalSeconds={rest.total}
        overtime={rest.overtime}
        upcoming={
          position.exercise.roundNumber
            ? `${position.exercise.exerciseName} · ronda ${position.exercise.roundNumber} de ${position.exercise.rounds}`
            : `${position.exercise.exerciseName} · serie ${position.target.setNumber} de ${position.exercise.targets.length}`
        }
        onSkip={skipRest}
        autoContinue={autoContinue}
        onToggleAutoContinue={setAutoContinue}
      />
    )
  }

  if (showOverview) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-32">
        <button
          onClick={() => setShowOverview(false)}
          className="inline-flex items-center gap-2 px-3 py-2.5 -ml-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
        >
          <ArrowLeftIcon className="w-5 h-5" /> Volver al ejercicio
        </button>
        <div>
          <h1 className="text-3xl font-bold">{sc(progress.routineName ?? "Rutina")}</h1>
          <p className="text-base text-muted-foreground mt-1">{done} de {total} series hechas</p>
        </div>
        <div className="space-y-3">
          {progress.exercises.map((ex, i) => (
            <ExerciseOverviewCard
              key={ex.id}
              exercise={ex}
              index={i}
              onWatch={() => setVideo(ex)}
              highlight={i === position.exerciseIdx ? "current" : doneFor(ex) >= ex.targets.length ? "done" : undefined}
            />
          ))}
        </div>
        {video && <VideoModal exercise={video} onClose={() => setVideo(null)} />}
      </div>
    )
  }

  const { exercise: curEx, target: curTarget, exerciseIdx } = position
  const rmLbs = rms[curEx.exerciseId] ?? null

  return (
    <SetExecution
      key={curTarget.id}
      sessionId={sessionId}
      userId={userId}
      exercise={curEx}
      target={curTarget}
      exerciseIdx={exerciseIdx}
      totalExercises={progress.exercises.length}
      totalSetsGlobal={total}
      doneSetsGlobal={done}
      defaultWeight={calcWeight(curTarget.targetPercent, rmLbs)}
      backHref={backHref}
      onShowOverview={() => setShowOverview(true)}
      onComplete={(isLastSet) => {
        onUpdate()
        vibrate(60)
        if (!isLastSet) startRest(curEx.restSeconds ?? DEFAULT_REST_SECONDS)
      }}
    />
  )
}

// ─── Set execution ─────────────────────────────────────────────────────────────

function SetExecution({
  sessionId, userId, exercise, target, exerciseIdx, totalExercises,
  totalSetsGlobal, doneSetsGlobal, defaultWeight, backHref, onComplete, onShowOverview,
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
  backHref: string
  onComplete: (isLastSet: boolean) => void
  onShowOverview: () => void
}) {
  const isTime = isTimeTarget(target)
  const freeReps = !isTime && target.targetReps == null
  const [reps, setReps] = useState(8)
  const [showNotes, setShowNotes] = useState(false)

  const recordSet = trpc.sessions.recordSet.useMutation({
    onSuccess: () => onComplete(doneSetsGlobal + 1 >= totalSetsGlobal),
  })

  const progressPct = totalSetsGlobal > 0 ? Math.round((doneSetsGlobal / totalSetsGlobal) * 100) : 0
  const tempoText = exercise.tempo ? explainTempo(exercise.tempo) : null

  function handleComplete() {
    recordSet.mutate({
      sessionId,
      athleteId: userId,
      sessionExerciseId: exercise.id,
      sessionSetTargetId: target.id,
      setNumber: target.setNumber,
      reps: isTime ? 0 : target.targetReps ?? reps,
      weightLbs: defaultWeight || "0",
    })
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] lg:min-h-screen">
      {/* ── Cabecera: progreso ── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="h-2 bg-muted/40" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3 px-4 py-2">
          <BackLink href={backHref} label="Salir" />
          <p className="text-base text-muted-foreground">
            Ejercicio <strong className="text-foreground">{exerciseIdx + 1}</strong> de {totalExercises}
          </p>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-5 space-y-5">
        <div className="space-y-1">
          {exercise.blockName && (
            <p className="text-base text-primary font-medium flex items-center gap-1.5">
              <RepeatIcon className="w-4 h-4" /> {exercise.blockName}
              {exercise.roundNumber
                ? ` · ronda ${exercise.roundNumber} de ${exercise.rounds}`
                : exercise.rounds > 1 && ` · ${exercise.rounds} vueltas`}
            </p>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold leading-tight">{exercise.exerciseName}</h1>
            {exercise.notes && (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="relative shrink-0 w-8 h-8 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 flex items-center justify-center cursor-pointer"
                aria-label="Ver indicaciones de tu entrenador"
              >
                <InfoIcon className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500" />
              </button>
            )}
          </div>
        </div>

        {exercise.youtubeVideoId ? (
          <YouTubePlayer
            videoId={exercise.youtubeVideoId}
            title={exercise.exerciseName}
            orientation={exercise.videoOrientation}
            large
            compact
          />
        ) : (
          <p className="text-base text-muted-foreground border border-dashed border-border rounded-2xl p-4">
            Este ejercicio no tiene video.
          </p>
        )}

        {/* Objetivo de la serie */}
        <div className="rounded-2xl border-2 border-primary/40 bg-card p-5 text-center space-y-3">
          <p className="text-xl font-semibold text-primary">
            Serie {target.setNumber} de {exercise.targets.length}
          </p>

          {isTime ? (
            <TimeCountdown seconds={target.targetDurationSeconds ?? 30} />
          ) : freeReps ? (
            <div className="space-y-2">
              <p className="text-base text-muted-foreground">Haz las que puedas y anota cuántas fueron:</p>
              <RepsStepper value={reps} onChange={setReps} />
            </div>
          ) : (
            <p>
              <span className="block text-7xl font-bold leading-none tabular-nums">{target.targetReps}</span>
              <span className="block text-2xl mt-1">{target.targetReps === 1 ? "repetición" : "repeticiones"}</span>
            </p>
          )}

          {defaultWeight && (
            <p className="text-xl">
              con <strong>{defaultWeight} lbs</strong>
              <span className="text-base text-muted-foreground"> ({target.targetPercent}% de tu máximo)</span>
            </p>
          )}
        </div>

        {/* Indicaciones */}
        {(tempoText || exercise.restSeconds) && (
          <div className="space-y-2 text-base">
            {tempoText && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <TimerIcon className="w-5 h-5 mt-0.5 shrink-0" /> <span><strong className="text-foreground">Ritmo:</strong> {tempoText}</span>
              </p>
            )}
            {exercise.restSeconds && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <PauseIcon className="w-5 h-5 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground">Descanso:</strong> {formatDuration(exercise.restSeconds)}{" "}
                  {exercise.blockName ? "antes del siguiente ejercicio" : "entre series"}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {showNotes && exercise.notes && <NotesModal notes={exercise.notes} onClose={() => setShowNotes(false)} />}

      {/* ── Acciones fijas ── */}
      <div className="sticky bottom-0 shrink-0 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 py-3 space-y-2">
          <button
            onClick={handleComplete}
            disabled={recordSet.isPending}
            className="w-full flex items-center justify-center gap-3 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {recordSet.isPending ? "Guardando…" : (<><CheckIcon className="w-7 h-7" strokeWidth={3} /> Terminé esta serie</>)}
          </button>
          {recordSet.isError && (
            <p className="text-base text-destructive text-center">No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.</p>
          )}
          <button
            onClick={onShowOverview}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
          >
            <ListIcon className="w-5 h-5" /> Ver toda la rutina
          </button>
        </div>
      </div>
    </div>
  )
}

function RepsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-16 h-16 rounded-2xl border-2 border-border flex items-center justify-center cursor-pointer active:scale-95"
        aria-label="Una menos"
      >
        <MinusIcon className="w-7 h-7" />
      </button>
      <span className="text-6xl font-bold tabular-nums w-24">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-16 h-16 rounded-2xl border-2 border-border flex items-center justify-center cursor-pointer active:scale-95"
        aria-label="Una más"
      >
        <PlusIcon className="w-7 h-7" />
      </button>
    </div>
  )
}

type CountdownPhase = "idle" | "prepare" | "running" | "paused" | "finished"

function TimeCountdown({ seconds }: { seconds: number }) {
  const [phase, setPhase] = useState<CountdownPhase>("idle")
  const [prepareLeft, setPrepareLeft] = useState(3)
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    if (phase !== "prepare") return
    vibrate(60)
    if (prepareLeft <= 1) {
      const id = setTimeout(() => {
        setPhase("running")
        vibrate(120)
      }, 1000)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setPrepareLeft((prev) => prev - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, prepareLeft])

  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          setPhase("finished")
          vibrate([300, 150, 300])
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  function handleStart() {
    setPrepareLeft(3)
    setPhase("prepare")
  }

  function handleTogglePause() {
    setPhase((p) => (p === "running" ? "paused" : "running"))
  }

  function handleReset() {
    setPhase("idle")
    setPrepareLeft(3)
    setLeft(seconds)
  }

  const isPreparing = phase === "prepare"
  const isRunning = phase === "running" || phase === "paused"
  const finished = phase === "finished"
  const started = phase !== "idle"

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-2xl py-5 transition-colors duration-700",
          isPreparing && "bg-destructive/10",
          isRunning && "bg-emerald-500/10",
          finished && "bg-destructive/10",
        )}
      >
        <span
          className={cn(
            "block text-7xl font-bold leading-none tabular-nums transition-colors duration-500",
            isPreparing && "text-destructive",
            isRunning && "text-emerald-500",
            finished && "text-destructive",
          )}
        >
          {isPreparing
            ? prepareLeft
            : Math.floor(left / 60) > 0
              ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
              : left}
        </span>
        <span className="block text-2xl mt-1">
          {isPreparing ? "prepárate…" : finished ? "¡Tiempo!" : "segundos"}
        </span>
      </div>
      <div className="flex justify-center gap-3">
        {phase === "idle" && (
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-secondary text-lg font-semibold cursor-pointer"
          >
            <PlayIcon className="w-5 h-5" /> Empezar a contar
          </button>
        )}
        {isRunning && (
          <button
            type="button"
            onClick={handleTogglePause}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-secondary text-lg font-semibold cursor-pointer"
          >
            {phase === "running" ? <><PauseIcon className="w-5 h-5" /> Pausar</> : <><PlayIcon className="w-5 h-5" /> Seguir</>}
          </button>
        )}
        {started && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-border text-lg cursor-pointer"
          >
            <RotateCcwIcon className="w-5 h-5" /> Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Rest timer ────────────────────────────────────────────────────────────────

function formatClock(totalSeconds: number): string {
  return totalSeconds >= 60 ? `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}` : String(totalSeconds)
}

function RestTimer({ seconds, totalSeconds, overtime, upcoming, onSkip, autoContinue, onToggleAutoContinue }: {
  seconds: number
  totalSeconds: number
  overtime: number | null
  upcoming: string
  onSkip: () => void
  autoContinue: boolean
  onToggleAutoContinue: (v: boolean) => void
}) {
  const isOvertime = overtime !== null
  const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0
  const circumference = 2 * Math.PI * 54

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] lg:min-h-screen items-center justify-center gap-8 px-6 py-8 text-center">
      <div className="space-y-2">
        <p className="text-3xl font-bold">{isOvertime ? "¡Descanso terminado!" : "¡Bien hecho! Descansa"}</p>
        <p className="text-lg text-muted-foreground">
          {isOvertime ? "Continúa cuando estés listo." : "Respira tranquilo antes de la siguiente serie."}
        </p>
      </div>

      <div className="relative w-56 h-56" role="timer" aria-live="polite">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke="currentColor" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isOvertime ? 0 : circumference * (1 - pct / 100)}
            className={cn("transition-all duration-1000", isOvertime ? "text-destructive" : "text-primary")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-6xl font-bold tabular-nums", isOvertime && "text-destructive")}>
            {formatClock(isOvertime ? overtime! : seconds)}
          </span>
          <span className={cn("text-lg", isOvertime ? "text-destructive" : "text-muted-foreground")}>
            {isOvertime ? "descanso extra" : seconds >= 60 ? "minutos" : "segundos"}
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-muted/40 px-5 py-3 text-lg">
        <span className="text-muted-foreground">Lo siguiente: </span>
        <strong>{upcoming}</strong>
      </div>

      <label className="flex items-center gap-2 text-base text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={autoContinue}
          onChange={(e) => onToggleAutoContinue(e.target.checked)}
          className="w-5 h-5 accent-primary cursor-pointer"
          aria-label="Continuar automáticamente al terminar el descanso"
        />
        Continuar automáticamente
      </label>

      <button
        onClick={onSkip}
        className={cn(
          "w-full max-w-sm min-h-16 rounded-2xl text-xl font-bold cursor-pointer active:scale-[0.98]",
          isOvertime ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {isOvertime ? "Siguiente" : "Ya descansé, continuar"}
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
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] lg:min-h-screen items-center justify-center gap-8 px-6 py-8 text-center">
      <div className="w-28 h-28 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
        <CheckCircleIcon className="w-14 h-14 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">¡Rutina terminada!</h1>
        <p className="text-xl text-muted-foreground">
          Hiciste {progress.exercises.length} ejercicios y {done} series. ¡Excelente trabajo!
        </p>
      </div>
      <Link
        href={backHref}
        className="w-full max-w-sm flex items-center justify-center gap-2 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl"
      >
        <ArrowLeftIcon className="w-6 h-6" /> Volver a mis rutinas
      </Link>
    </div>
  )
}

// ─── Completed history ─────────────────────────────────────────────────────────

function CompletedHistory({ progress, backHref }: { progress: Progress; backHref: string }) {
  const [video, setVideo] = useState<Exercise | null>(null)
  const isCancelled = progress.status === "cancelled"
  const validSets = progress.exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.status === "valid").length, 0)

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-6">
      <BackLink href={backHref} label="Mis rutinas" />

      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{sc(progress.routineName ?? "Rutina")}</h1>
        <p className="text-base text-muted-foreground">
          {sc(new Date(progress.startedAt).toLocaleString("es", { dateStyle: "full", timeStyle: "short" }))}
        </p>
      </div>

      {isCancelled ? (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-base">Esta rutina fue cancelada por tu entrenador.</div>
      ) : validSets > 0 && (
        <div className="flex items-center gap-3 p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-2xl">
          <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
          <p className="text-lg font-medium">{validSets} series completadas</p>
        </div>
      )}

      <div className="space-y-3">
        {progress.exercises.map((ex, i) => (
          <div key={ex.id} className="space-y-0">
            <ExerciseOverviewCard exercise={ex} index={i} onWatch={() => setVideo(ex)} />
            {ex.sets.length > 0 && (
              <div className="mx-3 border border-t-0 border-border rounded-b-2xl divide-y divide-border">
                {ex.sets.map((s) => {
                  const target = ex.targets.find((t) => t.id === s.sessionSetTargetId)
                  return (
                    <div key={s.id} className={cn("flex items-center gap-4 px-4 py-3 text-base", s.status === "invalid" && "opacity-50")}>
                      <span className="text-muted-foreground w-20 shrink-0">Serie {s.setNumber}</span>
                      <span className="font-semibold">
                        {target && isTimeTarget(target) ? describeTarget(target) : `${s.reps} repeticiones`}
                      </span>
                      {Number(s.weightLbs) > 0 && <span className="text-muted-foreground">{s.weightLbs} lbs</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {video && <VideoModal exercise={video} onClose={() => setVideo(null)} />}
    </div>
  )
}
