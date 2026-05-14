"use client"

import { trpc } from "@/lib/trpc/client"
import { ArrowLeftIcon, CheckIcon, TimerIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export default function SessionExecutionPage() {
  const { teamId, assignedSessionId } = useParams<{ teamId: string; assignedSessionId: string }>()
  const router = useRouter()
  const [executionId, setExecutionId] = useState<string | null>(null)
  const startInitiated = useRef(false)

  const { data: sessions } = trpc.assignedSessions.myList.useQuery({ teamId })
  const session = sessions?.find((s) => s.id === assignedSessionId)

  const start = trpc.athleteSessions.start.useMutation({
    onSuccess: (exec) => setExecutionId(exec.id),
  })

  const { data: progress, refetch: refetchProgress } = trpc.athleteSessions.progress.useQuery(
    { executionId: executionId! },
    { enabled: !!executionId },
  )

  const completeSet = trpc.athleteSessions.completeSet.useMutation({
    onSuccess: () => refetchProgress(),
  })
  const undoSet = trpc.athleteSessions.undoSet.useMutation({
    onSuccess: () => refetchProgress(),
  })
  const complete = trpc.athleteSessions.complete.useMutation({
    onSuccess: () => router.push(`/teams/${teamId}/mis-rutinas`),
  })
  const skip = trpc.athleteSessions.skip.useMutation({
    onSuccess: () => router.push(`/teams/${teamId}/mis-rutinas`),
  })

  useEffect(() => {
    if (!session || startInitiated.current) return
    if (session.status === "completed" || session.status === "skipped") return
    startInitiated.current = true
    start.mutate({ assignedSessionId })
  }, [session?.id])

  function handleToggleSet(routineExerciseId: string, setNumber: number, completed: boolean) {
    if (!executionId) return
    if (completed) {
      undoSet.mutate({ executionId, routineExerciseId, setNumber })
    } else {
      completeSet.mutate({ executionId, routineExerciseId, setNumber })
    }
  }

  const totalSets = progress?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0
  const completedSets = progress?.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0) ?? 0

  const backLink = (
    <Link
      href={`/teams/${teamId}/mis-rutinas`}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      Mis rutinas
    </Link>
  )

  // Loading: session not yet loaded, or start mutation pending
  if (!session || (!executionId && session.status !== "completed" && session.status !== "skipped")) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {backLink}
        <div className="space-y-3">
          <div className="h-7 w-48 bg-muted/40 rounded animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-muted/40 rounded-xl animate-pulse" />
          ))}
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
            <h2
              className="text-xl font-bold tracking-wider uppercase"
              style={{ fontFamily: "var(--font-barlow-condensed)" }}
            >
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

  // Execution
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 space-y-6">
      {backLink}

      <div>
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          {session.routineName ?? "Rutina"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {totalSets > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progreso</span>
            <span>{completedSets} / {totalSets} series</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(completedSets / totalSets) * 100}%` }}
            />
          </div>
        </div>
      )}

      {!progress ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {progress.exercises.map((ex) => {
            const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed)
            return (
              <div
                key={ex.id}
                className={`border rounded-xl p-4 transition-all ${allDone ? "border-primary/30 bg-primary/5" : "border-border bg-card/60"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{ex.exerciseName}</h3>
                    {(ex.tempo || ex.restSeconds) && (
                      <div className="flex items-center gap-3 mt-1">
                        {ex.tempo && (
                          <span className="text-[11px] text-muted-foreground">Tempo {ex.tempo}</span>
                        )}
                        {ex.restSeconds && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <TimerIcon className="w-3 h-3" />
                            {ex.restSeconds}s descanso
                          </span>
                        )}
                      </div>
                    )}
                    {ex.notes && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 italic">{ex.notes}</p>
                    )}
                  </div>
                  {allDone && <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                </div>

                {ex.sets.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic">Sin series definidas</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ex.sets.map((set) => (
                      <button
                        key={set.setNumber}
                        onClick={() => handleToggleSet(ex.id, set.setNumber, set.completed)}
                        disabled={completeSet.isPending || undoSet.isPending}
                        className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 transition-all cursor-pointer disabled:opacity-50 ${
                          set.completed
                            ? "bg-primary/20 border-primary text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <span className="text-sm font-bold leading-none">{set.setNumber}</span>
                        {set.targetReps != null && (
                          <span className="text-[9px] mt-0.5 leading-none">{set.targetReps}×</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Fixed bottom bar */}
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
