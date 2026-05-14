"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { ArrowLeftIcon, CheckIcon, ClockIcon, TimerIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

// ─── Countdown timer ──────────────────────────────────────────────────────────

function CountdownTimer({
  seconds,
  onComplete,
}: {
  seconds: number
  onComplete: () => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning]     = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          onComplete()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [running])

  const pct      = ((seconds - remaining) / seconds) * 100
  const mins     = Math.floor(remaining / 60)
  const secs     = remaining % 60
  const display  = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${remaining}s`
  const isDone   = remaining === 0

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {/* Ring */}
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
            className={cn("transition-all duration-1000", isDone ? "text-emerald-400" : "text-primary")}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold tabular-nums", isDone ? "text-emerald-400" : "text-foreground")}>
            {isDone ? <CheckIcon className="w-6 h-6" /> : display}
          </span>
        </div>
      </div>

      {isDone ? (
        <p className="text-xs text-emerald-400 font-medium">Completado</p>
      ) : running ? (
        <button
          onClick={() => { setRunning(false); setRemaining(seconds) }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Reiniciar
        </button>
      ) : remaining === seconds ? (
        <button
          onClick={() => setRunning(true)}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <ClockIcon className="w-3.5 h-3.5" />
          Iniciar
        </button>
      ) : (
        <button
          onClick={() => setRunning(true)}
          className="text-xs bg-primary/20 text-primary px-3.5 py-1.5 rounded-lg font-medium hover:bg-primary/30 transition-colors cursor-pointer"
        >
          Continuar
        </button>
      )}
    </div>
  )
}

// ─── Set button (reps mode) ───────────────────────────────────────────────────

function SetButton({
  setNumber,
  targetReps,
  completed,
  disabled,
  onToggle,
}: {
  setNumber: number
  targetReps: number | null
  completed: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 transition-all cursor-pointer disabled:opacity-50",
        completed
          ? "bg-primary/20 border-primary text-primary"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      <span className="text-sm font-bold leading-none">{setNumber}</span>
      {targetReps != null && (
        <span className="text-[9px] mt-0.5 leading-none">{targetReps}×</span>
      )}
    </button>
  )
}

// ─── Weight suggestion ────────────────────────────────────────────────────────

function WeightHint({ loadType, loadValue, rmLbs }: { loadType: string | null; loadValue: string | null; rmLbs: string | null }) {
  if (loadType === "percent_rm" && loadValue && rmLbs) {
    const lbs = (parseFloat(rmLbs) * parseFloat(loadValue) / 100).toFixed(1)
    return <span className="text-[10px] text-primary/70 ml-1">≈ {lbs} lbs</span>
  }
  if (loadType === "fixed_kg" && loadValue) {
    return <span className="text-[10px] text-muted-foreground ml-1">{loadValue} lbs</span>
  }
  if (loadType === "rpe" && loadValue) {
    return <span className="text-[10px] text-muted-foreground ml-1">RPE {loadValue}</span>
  }
  return null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionExecutionPage() {
  const { teamId, assignedSessionId } = useParams<{ teamId: string; assignedSessionId: string }>()
  const router = useRouter()
  const [executionId, setExecutionId]   = useState<string | null>(null)
  const startInitiated                  = useRef(false)

  const { data: sessions }  = trpc.assignedSessions.myList.useQuery({ teamId })
  const session             = sessions?.find((s) => s.id === assignedSessionId)

  const start = trpc.athleteSessions.start.useMutation({
    onSuccess: (exec) => setExecutionId(exec.id),
  })

  const { data: progress, refetch: refetchProgress } = trpc.athleteSessions.progress.useQuery(
    { executionId: executionId! },
    { enabled: !!executionId },
  )

  const completeSet = trpc.athleteSessions.completeSet.useMutation({ onSuccess: () => refetchProgress() })
  const undoSet     = trpc.athleteSessions.undoSet.useMutation({ onSuccess: () => refetchProgress() })
  const complete    = trpc.athleteSessions.complete.useMutation({ onSuccess: () => router.push(`/teams/${teamId}/mis-rutinas`) })
  const skip        = trpc.athleteSessions.skip.useMutation({ onSuccess: () => router.push(`/teams/${teamId}/mis-rutinas`) })

  useEffect(() => {
    if (!session || startInitiated.current) return
    if (session.status === "completed" || session.status === "skipped") return
    startInitiated.current = true
    start.mutate({ assignedSessionId })
  }, [session?.id])

  function handleToggleSet(routineExerciseId: string, setNumber: number, completed: boolean) {
    if (!executionId) return
    if (completed) undoSet.mutate({ executionId, routineExerciseId, setNumber })
    else completeSet.mutate({ executionId, routineExerciseId, setNumber })
  }

  function handleTimedComplete(routineExerciseId: string, setNumber: number) {
    if (!executionId) return
    completeSet.mutate({ executionId, routineExerciseId, setNumber })
  }

  const backLink = (
    <Link
      href={`/teams/${teamId}/mis-rutinas`}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      Mis rutinas
    </Link>
  )

  // Loading
  if (!session || (!executionId && session.status !== "completed" && session.status !== "skipped")) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {backLink}
        <div className="space-y-3">
          <div className="h-7 w-48 bg-muted/40 rounded animate-pulse" />
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  // Completed
  if (session.status === "completed") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {backLink}
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-wider uppercase" style={{ fontFamily: "var(--font-barlow-condensed)" }}>
              {session.routineName ?? "Rutina"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Sesión completada</p>
          </div>
        </div>
      </div>
    )
  }

  // Skipped
  if (session.status === "skipped") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {backLink}
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-muted-foreground text-sm">Esta sesión fue saltada.</p>
        </div>
      </div>
    )
  }

  const isCircuit    = progress?.routineType === "circuit"
  const circuitRounds = progress?.circuitRounds ?? null

  const totalSets    = progress?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0
  const completedSets = progress?.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0) ?? 0

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 space-y-6">
      {backLink}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-wider uppercase" style={{ fontFamily: "var(--font-barlow-condensed)" }}>
            {session.routineName ?? "Rutina"}
          </h1>
          {isCircuit && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
              Circuito
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Progress bar */}
      {totalSets > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progreso</span>
            <span>{completedSets} / {totalSets} series</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {!progress ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      ) : isCircuit ? (
        <CircuitView
          exercises={progress.exercises}
          circuitRounds={circuitRounds}
          onToggleSet={handleToggleSet}
          onTimedComplete={handleTimedComplete}
          isPending={completeSet.isPending || undoSet.isPending}
        />
      ) : (
        <SequentialView
          exercises={progress.exercises}
          onToggleSet={handleToggleSet}
          onTimedComplete={handleTimedComplete}
          isPending={completeSet.isPending || undoSet.isPending}
        />
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56 p-4 bg-background/90 backdrop-blur-sm border-t border-border flex gap-3">
        <button
          onClick={() => skip.mutate({ assignedSessionId })}
          disabled={skip.isPending || complete.isPending}
          className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
        >
          Saltar
        </button>
        <button
          onClick={() => complete.mutate({ executionId: executionId! })}
          disabled={complete.isPending || skip.isPending}
          className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {complete.isPending ? "Guardando…" : "Completar sesión"}
        </button>
      </div>
    </div>
  )
}

// ─── Sequential view ──────────────────────────────────────────────────────────

type ProgressSet = {
  setNumber: number
  setType: "reps" | "time" | "distance" | "amrap"
  targetReps?: number
  targetDurationSeconds?: number
  targetDistanceMeters?: number
  loadType?: "fixed_kg" | "percent_rm" | "rpe"
  loadValue?: number
  completed: boolean
}

type ProgressExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  order: number
  tempo: string | null
  restSeconds: number | null
  goal: string | null
  notes: string | null
  athleteRmLbs: string | null
  sets: ProgressSet[]
}

function SequentialView({
  exercises,
  onToggleSet,
  onTimedComplete,
  isPending,
}: {
  exercises: ProgressExercise[]
  onToggleSet: (routineExerciseId: string, setNumber: number, completed: boolean) => void
  onTimedComplete: (routineExerciseId: string, setNumber: number) => void
  isPending: boolean
}) {
  return (
    <div className="space-y-3">
      {exercises.map((ex) => {
        const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed)
        return (
          <div
            key={ex.id}
            className={cn(
              "border rounded-xl p-4 transition-all",
              allDone ? "border-primary/30 bg-primary/5" : "border-border bg-card/60",
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground">{ex.exerciseName}</h3>
                {(ex.tempo || ex.restSeconds) && (
                  <div className="flex items-center gap-3 mt-1">
                    {ex.tempo && <span className="text-[11px] text-muted-foreground">Tempo {ex.tempo}</span>}
                    {ex.restSeconds && (
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <TimerIcon className="w-3 h-3" />
                        {ex.restSeconds}s descanso
                      </span>
                    )}
                  </div>
                )}
                {ex.notes && <p className="text-[11px] text-muted-foreground/80 mt-1 italic">{ex.notes}</p>}
              </div>
              {allDone && <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
            </div>

            {ex.sets.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 italic">Sin series definidas</p>
            ) : (
              <div className="space-y-3">
                {ex.sets.map((set) => {
                  const isTime = set.setType === "time"
                  if (isTime) {
                    return (
                      <div key={set.setNumber} className={cn(
                        "border rounded-xl p-3 transition-all",
                        set.completed ? "border-primary/30 bg-primary/5" : "border-border",
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Serie {set.setNumber}</span>
                          {set.completed && <CheckIcon className="w-4 h-4 text-primary" />}
                        </div>
                        {set.completed ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400">Completada</span>
                            <button
                              onClick={() => onToggleSet(ex.id, set.setNumber, true)}
                              disabled={isPending}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              Deshacer
                            </button>
                          </div>
                        ) : (
                          <CountdownTimer
                            seconds={set.targetDurationSeconds ?? 60}
                            onComplete={() => onTimedComplete(ex.id, set.setNumber)}
                          />
                        )}
                      </div>
                    )
                  }
                  // Reps mode
                  return (
                    <div key={set.setNumber} className="flex items-center gap-2">
                      <SetButton
                        setNumber={set.setNumber}
                        targetReps={set.targetReps ?? null}
                        completed={set.completed}
                        disabled={isPending}
                        onToggle={() => onToggleSet(ex.id, set.setNumber, set.completed)}
                      />
                      <WeightHint loadType={set.loadType ?? null} loadValue={set.loadValue != null ? String(set.loadValue) : null} rmLbs={ex.athleteRmLbs} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Circuit view ─────────────────────────────────────────────────────────────

function CircuitView({
  exercises,
  circuitRounds,
  onToggleSet,
  onTimedComplete,
  isPending,
}: {
  exercises: ProgressExercise[]
  circuitRounds: number | null
  onToggleSet: (routineExerciseId: string, setNumber: number, completed: boolean) => void
  onTimedComplete: (routineExerciseId: string, setNumber: number) => void
  isPending: boolean
}) {
  const maxRound = Math.max(
    circuitRounds ?? 1,
    ...exercises.map((ex) => ex.sets.length),
  )

  return (
    <div className="space-y-4">
      {Array.from({ length: maxRound }, (_, roundIdx) => {
        const round = roundIdx + 1
        const roundSets = exercises.map((ex) => ({
          ex,
          set: ex.sets.find((s) => s.setNumber === round) ?? null,
        }))
        const allDone = roundSets.every(({ set }) => !set || set.completed)

        return (
          <div key={round} className={cn(
            "border rounded-xl overflow-hidden transition-all",
            allDone ? "border-primary/30" : "border-border",
          )}>
            <div className={cn(
              "px-4 py-2.5 flex items-center gap-2 border-b",
              allDone ? "border-primary/20 bg-primary/5" : "border-border bg-muted/10",
            )}>
              <span
                className="text-sm font-bold tracking-wider uppercase"
                style={{ fontFamily: "var(--font-barlow-condensed)" }}
              >
                Ronda {round}
              </span>
              {allDone && <CheckIcon className="w-4 h-4 text-primary ml-auto" />}
            </div>

            <div className="divide-y divide-border">
              {roundSets.map(({ ex, set }) => {
                if (!set) return null
                const isTime = set.setType === "time"
                return (
                  <div key={ex.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ex.exerciseName}</p>
                        {ex.notes && <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">{ex.notes}</p>}
                      </div>

                      {isTime ? (
                        set.completed ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <CheckIcon className="w-3.5 h-3.5" />
                              {set.targetDurationSeconds}s
                            </span>
                            <button
                              onClick={() => onToggleSet(ex.id, set.setNumber, true)}
                              disabled={isPending}
                              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Deshacer
                            </button>
                          </div>
                        ) : (
                          <CountdownTimer
                            seconds={set.targetDurationSeconds ?? 60}
                            onComplete={() => onTimedComplete(ex.id, set.setNumber)}
                          />
                        )
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <SetButton
                            setNumber={round}
                            targetReps={set.targetReps ?? null}
                            completed={set.completed}
                            disabled={isPending}
                            onToggle={() => onToggleSet(ex.id, set.setNumber, set.completed)}
                          />
                          <WeightHint loadType={set.loadType ?? null} loadValue={set.loadValue != null ? String(set.loadValue) : null} rmLbs={ex.athleteRmLbs} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
