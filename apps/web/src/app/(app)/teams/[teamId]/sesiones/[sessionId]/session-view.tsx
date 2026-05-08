"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { AlertTriangleIcon, BanIcon, CheckIcon, PencilIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = { sessionId: string }

export function SessionView({ sessionId }: Props) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<"complete" | "cancel" | null>(null)
  const router = useRouter()

  const { data: session, refetch: refetchSession } = trpc.sessions.get.useQuery({ id: sessionId })
  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => { setConfirming(null); if (session) router.push(`/teams/${session.teamId}/sesiones`) },
  })
  const cancelSession = trpc.sessions.cancel.useMutation({ onSuccess: () => { refetchSession(); setConfirming(null) } })
  const cancelAthlete = trpc.sessions.cancelAthlete.useMutation({ onSuccess: refetchSession })
  const reactivateAthlete = trpc.sessions.reactivateAthlete.useMutation({ onSuccess: refetchSession })

  if (!session) return <div className="p-8 text-muted-foreground">Cargando sesión...</div>

  const activeAthleteId = selectedAthleteId ?? session.athletes.find((a) => a.status === "active")?.athleteId ?? null
  const isActive = session.status === "active"

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* ── Header ── */}
      <div className="border-b px-4 lg:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="font-semibold text-sm">Sesión activa</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        {/* Desktop-only action buttons */}
        {isActive && (
          <div className="hidden lg:flex gap-2">
            <button onClick={() => setConfirming("complete")}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer">
              <CheckIcon className="w-4 h-4" /> Completar
            </button>
            <button onClick={() => setConfirming("cancel")}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border text-destructive hover:bg-destructive/10 cursor-pointer">
              <XIcon className="w-4 h-4" /> Cancelar
            </button>
          </div>
        )}

        {!isActive && (
          <span className={cn("text-sm font-medium", session.status === "completed" ? "text-primary" : "text-muted-foreground")}>
            {session.status === "completed" ? "Completada" : "Cancelada"}
          </span>
        )}
      </div>

      {/* ── Confirmation modal ── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirming(null)}>
          <div className="bg-popover border border-border rounded-t-2xl lg:rounded-xl shadow-2xl p-6 w-full lg:max-w-sm"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-5">
              <AlertTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{confirming === "complete" ? "¿Completar sesión?" : "¿Cancelar sesión?"}</p>
                <p className="text-sm text-muted-foreground mt-1">Una vez cerrada, la sesión no podrá modificarse.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)}
                className="flex-1 py-3 rounded-xl border text-sm font-medium cursor-pointer">
                Volver
              </button>
              <button
                onClick={() => confirming === "complete" ? completeSession.mutate({ id: sessionId }) : cancelSession.mutate({ id: sessionId })}
                disabled={completeSession.isPending || cancelSession.isPending}
                className={cn("flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50 cursor-pointer",
                  confirming === "complete" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground")}>
                {completeSession.isPending || cancelSession.isPending ? "..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Athlete strip */}
        <aside className="lg:w-48 lg:border-r lg:flex-col lg:overflow-y-auto lg:shrink-0 flex flex-row overflow-x-auto border-b lg:border-b-0 shrink-0">
          {session.athletes.map((a) => (
            <div key={a.athleteId}
              className={cn("shrink-0 flex items-center border-r lg:border-r-0 lg:border-b last:border-0",
                a.status === "cancelled" && "opacity-40")}>
              <button
                onClick={() => setSelectedAthleteId(a.athleteId)}
                className={cn("flex-1 px-4 py-2.5 lg:py-3 text-sm hover:bg-muted/50 transition-colors whitespace-nowrap text-left cursor-pointer",
                  a.athleteId === activeAthleteId && "bg-muted font-medium",
                  a.status === "cancelled" && "line-through")}>
                {a.athleteName}
              </button>
              {isActive && a.status === "active" && (
                <button onClick={() => cancelAthlete.mutate({ sessionId, athleteId: a.athleteId })}
                  className="p-2 mr-1 text-muted-foreground hover:text-destructive rounded shrink-0 cursor-pointer">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
              {isActive && a.status === "cancelled" && (
                <button onClick={() => reactivateAthlete.mutate({ sessionId, athleteId: a.athleteId })}
                  className="p-2 mr-1 text-muted-foreground hover:text-primary rounded shrink-0 cursor-pointer">
                  <RotateCcwIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </aside>

        {/* Main scroll area — extra bottom padding on mobile for sticky bar */}
        <div className={cn("flex-1 overflow-y-auto p-4 lg:p-6", isActive && "pb-24 lg:pb-6")}>
          {(() => {
            if (!activeAthleteId) return <p className="text-muted-foreground text-sm">Selecciona un atleta</p>
            const activeAthlete = session.athletes.find((a) => a.athleteId === activeAthleteId)
            if (activeAthlete?.status === "cancelled") {
              return (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                  <p className="text-muted-foreground text-sm">Sesión cancelada para este atleta</p>
                </div>
              )
            }
            return (
              <AthleteExercises
                sessionId={sessionId}
                athleteId={activeAthleteId}
                exercises={session.exercises}
                isActive={isActive}
                onSessionUpdate={refetchSession}
              />
            )
          })()}
        </div>
      </div>

      {/* ── Mobile sticky bottom bar ── */}
      {isActive && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 flex gap-3 px-4 py-3 bg-background/95 backdrop-blur-sm border-t border-border">
          <button onClick={() => setConfirming("cancel")}
            className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border text-sm font-medium text-destructive hover:bg-destructive/10 cursor-pointer">
            <XIcon className="w-4 h-4" /> Cancelar
          </button>
          <button onClick={() => setConfirming("complete")}
            className="flex items-center justify-center gap-1.5 flex-[2] py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer">
            <CheckIcon className="w-4 h-4" /> Completar sesión
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionSetTarget = { id: string; setNumber: number; targetReps: number | null; targetPercent: string | null }
type Exercise = { id: string; exerciseId: string; exerciseName: string; order: number; targets: SessionSetTarget[] }
type SetRecord = { id: string; setNumber: number; sessionSetTargetId: string | null; reps: number; weightLbs: string; status: "valid" | "invalid" }

// ─── Athlete exercises ────────────────────────────────────────────────────────

function AthleteExercises({ sessionId, athleteId, exercises, isActive, onSessionUpdate }:
  { sessionId: string; athleteId: string; exercises: Exercise[]; isActive: boolean; onSessionUpdate: () => void }) {
  const { data: sets, refetch } = trpc.sessions.athleteSets.useQuery({ sessionId, athleteId })
  const { data: athleteRms } = trpc.sessions.athleteRms.useQuery({ sessionId, athleteId })
  const { data: cancelledExerciseIds, refetch: refetchCancelled } = trpc.sessions.athleteCancelledExercises.useQuery({ sessionId, athleteId })

  function refetchAll() { refetch(); refetchCancelled() }

  return (
    <div className="space-y-4">
      {exercises.map((ex) => {
        const exSets = (sets ?? []).filter((s) => s.sessionExerciseId === ex.id) as SetRecord[]
        const rmLbs = athleteRms?.[ex.exerciseId] ?? null
        const isCancelled = (cancelledExerciseIds ?? []).includes(ex.id)
        return (
          <ExerciseCard key={ex.id} sessionId={sessionId} athleteId={athleteId} exercise={ex}
            sets={exSets} isActive={isActive} isCancelled={isCancelled} rmLbs={rmLbs}
            onUpdate={refetch} onToggleCancel={refetchAll} />
        )
      })}
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ sessionId, athleteId, exercise, sets, isActive, isCancelled, rmLbs, onUpdate, onToggleCancel }:
  { sessionId: string; athleteId: string; exercise: Exercise; sets: SetRecord[]; isActive: boolean; isCancelled: boolean; rmLbs: string | null; onUpdate: () => void; onToggleCancel: () => void }) {
  const [addingExtra, setAddingExtra] = useState(false)
  const cancelExercise = trpc.sessions.cancelAthleteExercise.useMutation({ onSuccess: onToggleCancel })
  const reactivateExercise = trpc.sessions.reactivateAthleteExercise.useMutation({ onSuccess: onToggleCancel })

  const nextSetNumber = (sets.at(-1)?.setNumber ?? 0) + 1
  const extraCount = sets.filter((s) => s.sessionSetTargetId === null).length

  // First target without a recorded set is the "active" one
  const nextTargetId = exercise.targets.find((t) => !sets.find((s) => s.sessionSetTargetId === t.id))?.id ?? null

  if (isCancelled) {
    return (
      <div className="border rounded-xl overflow-hidden opacity-50">
        <div className="px-4 py-3 bg-muted/20 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm line-through">{exercise.exerciseName}</p>
            <p className="text-xs text-muted-foreground">Cancelado</p>
          </div>
          {isActive && (
            <button onClick={() => reactivateExercise.mutate({ sessionId, athleteId, sessionExerciseId: exercise.id })}
              disabled={reactivateExercise.isPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2 py-1.5 rounded cursor-pointer">
              <RotateCcwIcon className="w-3.5 h-3.5" /> Reactivar
            </button>
          )}
        </div>
      </div>
    )
  }

  const doneCount = sets.filter((s) => s.sessionSetTargetId !== null).length
  const totalTargets = exercise.targets.length

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 bg-muted/20 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{exercise.exerciseName}</p>
          <p className="text-xs text-muted-foreground">
            {doneCount}/{totalTargets} series
          </p>
        </div>
        {isActive && (
          <button onClick={() => cancelExercise.mutate({ sessionId, athleteId, sessionExerciseId: exercise.id })}
            disabled={cancelExercise.isPending}
            className="p-2 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer">
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="divide-y divide-border">
        {exercise.targets.map((target) => {
          const recorded = sets.find((s) => s.sessionSetTargetId === target.id) ?? null
          const isNext = isActive && !recorded && target.id === nextTargetId
          const isPending = isActive && !recorded && target.id !== nextTargetId
          return (
            <TargetSetRow key={target.id} sessionId={sessionId} athleteId={athleteId}
              sessionExerciseId={exercise.id} target={target} recorded={recorded}
              isActive={isActive} isNext={isNext} isPending={isPending}
              rmLbs={rmLbs} onUpdate={onUpdate} />
          )
        })}

        {sets.filter((s) => s.sessionSetTargetId === null).map((set) => (
          <SetRow key={set.id} set={set} isActive={isActive} onUpdate={onUpdate} />
        ))}

        {isActive && (
          <div className="px-4 py-3">
            {addingExtra ? (
              <RecordSetForm sessionId={sessionId} athleteId={athleteId} sessionExerciseId={exercise.id}
                sessionSetTargetId={null} setNumber={nextSetNumber} defaultReps="" defaultWeight=""
                label={`Serie extra ${extraCount + 1}`}
                onSave={() => { onUpdate(); setAddingExtra(false) }} onCancel={() => setAddingExtra(false)} />
            ) : (
              <button onClick={() => setAddingExtra(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-h-[44px]">
                <PlusIcon className="w-3.5 h-3.5" /> Agregar serie
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Target set row ───────────────────────────────────────────────────────────

function TargetSetRow({ sessionId, athleteId, sessionExerciseId, target, recorded, isActive, isNext, isPending, rmLbs, onUpdate }:
  { sessionId: string; athleteId: string; sessionExerciseId: string; target: SessionSetTarget; recorded: SetRecord | null; isActive: boolean; isNext: boolean; isPending: boolean; rmLbs: string | null; onUpdate: () => void }) {
  const repsLabel = target.targetReps != null ? `${target.targetReps} reps` : "libre"
  const pctLabel = target.targetPercent != null ? `${target.targetPercent}%RM` : "%RM libre"
  const defaultWeight = target.targetPercent != null && rmLbs != null
    ? (Math.ceil(Number(rmLbs) * Number(target.targetPercent) / 100 * 2) / 2).toFixed(1)
    : ""

  // ── Recorded ──
  if (recorded) {
    return (
      <div className={cn("flex items-center gap-3 px-4 py-3 transition-opacity", recorded.status === "invalid" && "opacity-40")}>
        <CheckIcon className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground w-12 shrink-0">Serie {target.setNumber}</span>
        <span className="text-sm flex-1 font-medium">{recorded.reps} reps · {recorded.weightLbs} lbs</span>
        {isActive && <SetActions set={recorded} onUpdate={onUpdate} />}
      </div>
    )
  }

  // ── Active / next to record ──
  if (isNext) {
    return (
      <div className="border-l-2 border-primary bg-primary/5 px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary"
            style={{ fontFamily: "var(--font-barlow-condensed, 'Barlow Condensed', sans-serif)" }}>
            Serie {target.setNumber}
          </span>
          <span className="text-xs text-muted-foreground">{repsLabel} · {pctLabel}</span>
        </div>
        <RecordSetForm sessionId={sessionId} athleteId={athleteId} sessionExerciseId={sessionExerciseId}
          sessionSetTargetId={target.id} setNumber={target.setNumber}
          defaultReps={target.targetReps?.toString() ?? ""} defaultWeight={defaultWeight}
          label="Registrar" onSave={onUpdate} />
      </div>
    )
  }

  // ── Pending (future) ──
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", isPending && "opacity-40")}>
      <span className="text-xs text-muted-foreground w-12 shrink-0">Serie {target.setNumber}</span>
      <span className="text-xs text-muted-foreground">{repsLabel}</span>
      <span className="text-xs text-muted-foreground">{pctLabel}</span>
    </div>
  )
}

// ─── Set row (extra) ──────────────────────────────────────────────────────────

function SetRow({ set, isActive, onUpdate }: { set: SetRecord; isActive: boolean; onUpdate: () => void }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", set.status === "invalid" && "opacity-40")}>
      <CheckIcon className="w-4 h-4 text-primary/60 shrink-0" />
      <span className="text-xs text-muted-foreground w-12 shrink-0">Serie {set.setNumber}</span>
      <span className="text-sm flex-1 font-medium">{set.reps} reps · {set.weightLbs} lbs</span>
      {isActive && <SetActions set={set} onUpdate={onUpdate} />}
    </div>
  )
}

// ─── Set actions ──────────────────────────────────────────────────────────────

function SetActions({ set, onUpdate }: { set: SetRecord; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false)
  const updateStatus = trpc.sessions.updateSetStatus.useMutation({ onSuccess: onUpdate })
  const updateSet = trpc.sessions.updateSet.useMutation({ onSuccess: () => { onUpdate(); setEditing(false) } })
  const [reps, setReps] = useState(String(set.reps))
  const [weightLbs, setWeightLbs] = useState(set.weightLbs)

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input autoFocus type="number" inputMode="numeric" min={0} value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="w-14 h-9 border rounded-lg px-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring text-center" />
        <span className="text-xs text-muted-foreground">reps</span>
        <input type="number" inputMode="numeric" min={0} step={0.5} value={weightLbs}
          onChange={(e) => setWeightLbs(e.target.value)}
          className="w-16 h-9 border rounded-lg px-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring text-center" />
        <span className="text-xs text-muted-foreground">lbs</span>
        <button onClick={() => updateSet.mutate({ setId: set.id, reps: Number(reps), weightLbs: weightLbs || "0" })}
          disabled={updateSet.isPending}
          className="h-9 px-3 bg-primary text-primary-foreground text-xs rounded-lg disabled:opacity-50 cursor-pointer">
          {updateSet.isPending ? "..." : "OK"}
        </button>
        <button onClick={() => setEditing(false)}
          className="p-2 text-muted-foreground hover:text-foreground cursor-pointer">
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setEditing(true)}
        className="p-2 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
        aria-label="Corregir">
        <PencilIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => updateStatus.mutate({ setId: set.id, status: set.status === "valid" ? "invalid" : "valid" })}
        className={cn("p-2 rounded-lg cursor-pointer",
          set.status === "valid" ? "text-muted-foreground hover:text-destructive" : "text-primary hover:text-primary/70")}
        aria-label={set.status === "valid" ? "Invalidar" : "Validar"}>
        <BanIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Record set form ──────────────────────────────────────────────────────────

function RecordSetForm({ sessionId, athleteId, sessionExerciseId, sessionSetTargetId, setNumber,
  defaultReps, defaultWeight, label, onSave, onCancel }:
  { sessionId: string; athleteId: string; sessionExerciseId: string; sessionSetTargetId: string | null;
    setNumber: number; defaultReps: string; defaultWeight: string; label: string; onSave: () => void; onCancel?: () => void }) {
  const [reps, setReps] = useState(defaultReps)
  const [weightLbs, setWeightLbs] = useState(defaultWeight)

  const recordSet = trpc.sessions.recordSet.useMutation({
    onSuccess: () => { onSave(); setReps(defaultReps); setWeightLbs(defaultWeight) },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    recordSet.mutate({ sessionId, athleteId, sessionExerciseId, sessionSetTargetId, setNumber, reps: Number(reps), weightLbs: weightLbs || "0" })
  }

  function handleInvalidate() {
    recordSet.mutate({ sessionId, athleteId, sessionExerciseId, sessionSetTargetId, setNumber, reps: Number(reps) || 0, weightLbs: weightLbs || "0", status: "invalid" })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 flex-1">
        <input autoFocus type="number" inputMode="numeric" min={0} value={reps}
          onChange={(e) => setReps(e.target.value)} placeholder="Reps"
          className="w-full min-w-0 h-11 border rounded-xl px-3 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center font-medium" />
        <span className="text-xs text-muted-foreground shrink-0">reps</span>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <input type="number" inputMode="numeric" min={0} step={0.5} value={weightLbs}
          onChange={(e) => setWeightLbs(e.target.value)} placeholder="0"
          className="w-full min-w-0 h-11 border rounded-xl px-3 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center font-medium" />
        <span className="text-xs text-muted-foreground shrink-0">lbs</span>
      </div>
      <button type="submit" disabled={recordSet.isPending || reps === ""}
        className="h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-xl disabled:opacity-50 active:scale-95 transition-transform cursor-pointer shrink-0">
        {recordSet.isPending ? "..." : label}
      </button>
      <button type="button" onClick={handleInvalidate} disabled={recordSet.isPending}
        aria-label="Registrar como inválido"
        className="h-11 w-11 flex items-center justify-center border rounded-xl text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-50 shrink-0 cursor-pointer">
        <BanIcon className="w-4 h-4" />
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}
          className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 cursor-pointer">
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </form>
  )
}
