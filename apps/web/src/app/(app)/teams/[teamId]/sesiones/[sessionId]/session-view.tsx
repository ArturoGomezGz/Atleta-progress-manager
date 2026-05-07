"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { AlertTriangleIcon, CheckIcon, PencilIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = { sessionId: string }

export function SessionView({ sessionId }: Props) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<"complete" | "cancel" | null>(null)
  const router = useRouter()

  const { data: session, refetch: refetchSession } = trpc.sessions.get.useQuery({ id: sessionId })
  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: (_, { id }) => {
      setConfirming(null)
      if (session) router.push(`/teams/${session.teamId}/sesiones`)
    },
  })
  const cancelSession = trpc.sessions.cancel.useMutation({ onSuccess: () => { refetchSession(); setConfirming(null) } })
  const cancelAthlete = trpc.sessions.cancelAthlete.useMutation({ onSuccess: refetchSession })
  const reactivateAthlete = trpc.sessions.reactivateAthlete.useMutation({ onSuccess: refetchSession })

  if (!session) return <div className="p-8 text-muted-foreground">Cargando sesión...</div>

  const activeAthleteId = selectedAthleteId ?? session.athletes.find((a) => a.status === "active")?.athleteId ?? null
  const isActive = session.status === "active"

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Sesión activa</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(session.startedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming("complete")}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
            >
              <CheckIcon className="w-4 h-4" />
              Completar
            </button>
            <button
              onClick={() => setConfirming("cancel")}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border text-destructive hover:bg-destructive/10"
            >
              <XIcon className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        )}

        {/* Confirmation modal */}
        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirming(null)}>
            <div className="bg-popover border border-border rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">
                    {confirming === "complete" ? "¿Completar sesión?" : "¿Cancelar sesión?"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Una vez cerrada, la sesión no podrá modificarse.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirming(null)}
                  className="text-sm px-4 py-2 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Volver
                </button>
                <button
                  onClick={() => confirming === "complete" ? completeSession.mutate({ id: sessionId }) : cancelSession.mutate({ id: sessionId })}
                  disabled={completeSession.isPending || cancelSession.isPending}
                  className={cn(
                    "text-sm px-4 py-2 rounded-lg disabled:opacity-50",
                    confirming === "complete" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {completeSession.isPending || cancelSession.isPending ? "..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
        {!isActive && (
          <span className={cn("text-sm font-medium", session.status === "completed" ? "text-green-600" : "text-muted-foreground")}>
            {session.status === "completed" ? "Completada" : "Cancelada"}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Athlete list — horizontal strip on mobile, vertical sidebar on desktop */}
        <aside className="lg:w-48 lg:border-r lg:flex-col lg:overflow-y-auto lg:shrink-0 flex flex-row overflow-x-auto border-b lg:border-b-0 shrink-0">
          {session.athletes.map((a) => (
            <div
              key={a.athleteId}
              className={cn(
                "shrink-0 flex items-center border-r lg:border-r-0 lg:border-b last:border-0",
                a.status === "cancelled" && "opacity-40",
              )}
            >
              <button
                onClick={() => setSelectedAthleteId(a.athleteId)}
                className={cn(
                  "flex-1 px-4 py-2.5 lg:py-3 text-sm hover:bg-muted/50 transition-colors whitespace-nowrap text-left",
                  a.athleteId === activeAthleteId && "bg-muted font-medium",
                  a.status === "cancelled" && "line-through",
                )}
              >
                {a.athleteName}
              </button>
              {isActive && a.status === "active" && (
                <button
                  onClick={() => cancelAthlete.mutate({ sessionId, athleteId: a.athleteId })}
                  title="Cancelar atleta"
                  className="p-1.5 mr-1 text-muted-foreground hover:text-destructive rounded shrink-0"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
              {isActive && a.status === "cancelled" && (
                <button
                  onClick={() => reactivateAthlete.mutate({ sessionId, athleteId: a.athleteId })}
                  title="Reactivar atleta"
                  className="p-1.5 mr-1 text-muted-foreground hover:text-green-600 rounded shrink-0"
                >
                  <RotateCcwIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
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
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionSetTarget = {
  id: string
  setNumber: number
  targetReps: number | null
  targetPercent: string | null
}

type Exercise = {
  id: string
  exerciseId: string
  exerciseName: string
  order: number
  targets: SessionSetTarget[]
}

type SetRecord = {
  id: string
  setNumber: number
  sessionSetTargetId: string | null
  reps: number
  weightLbs: string
  status: "valid" | "invalid"
}

// ─── Athlete exercises ────────────────────────────────────────────────────────

function AthleteExercises({
  sessionId,
  athleteId,
  exercises,
  isActive,
  onSessionUpdate,
}: {
  sessionId: string
  athleteId: string
  exercises: Exercise[]
  isActive: boolean
  onSessionUpdate: () => void
}) {
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
          <ExerciseCard
            key={ex.id}
            sessionId={sessionId}
            athleteId={athleteId}
            exercise={ex}
            sets={exSets}
            isActive={isActive}
            isCancelled={isCancelled}
            rmLbs={rmLbs}
            onUpdate={refetch}
            onToggleCancel={refetchAll}
          />
        )
      })}
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  sessionId,
  athleteId,
  exercise,
  sets,
  isActive,
  isCancelled,
  rmLbs,
  onUpdate,
  onToggleCancel,
}: {
  sessionId: string
  athleteId: string
  exercise: Exercise
  sets: SetRecord[]
  isActive: boolean
  isCancelled: boolean
  rmLbs: string | null
  onUpdate: () => void
  onToggleCancel: () => void
}) {
  const [addingExtra, setAddingExtra] = useState(false)
  const cancelExercise = trpc.sessions.cancelAthleteExercise.useMutation({ onSuccess: onToggleCancel })
  const reactivateExercise = trpc.sessions.reactivateAthleteExercise.useMutation({ onSuccess: onToggleCancel })

  const nextSetNumber = (sets.at(-1)?.setNumber ?? 0) + 1
  const extraCount = sets.filter((s) => s.sessionSetTargetId === null).length

  if (isCancelled) {
    return (
      <div className="border rounded-lg overflow-hidden opacity-60">
        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm line-through">{exercise.exerciseName}</p>
            <p className="text-xs text-muted-foreground">Cancelado</p>
          </div>
          {isActive && (
            <button
              onClick={() => reactivateExercise.mutate({ sessionId, athleteId, sessionExerciseId: exercise.id })}
              disabled={reactivateExercise.isPending}
              title="Reactivar ejercicio"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-green-600 rounded px-2 py-1 disabled:opacity-50"
            >
              <RotateCcwIcon className="w-3.5 h-3.5" />
              Reactivar
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{exercise.exerciseName}</p>
          <p className="text-xs text-muted-foreground">{exercise.targets.length} series planeadas</p>
        </div>
        {isActive && (
          <button
            onClick={() => cancelExercise.mutate({ sessionId, athleteId, sessionExerciseId: exercise.id })}
            disabled={cancelExercise.isPending}
            title="Cancelar ejercicio"
            className="p-1 text-muted-foreground hover:text-destructive rounded disabled:opacity-50"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="divide-y">
        {exercise.targets.map((target) => {
          const recorded = sets.find((s) => s.sessionSetTargetId === target.id)
          return (
            <TargetSetRow
              key={target.id}
              sessionId={sessionId}
              athleteId={athleteId}
              sessionExerciseId={exercise.id}
              target={target}
              recorded={recorded ?? null}
              isActive={isActive}
              rmLbs={rmLbs}
              onUpdate={onUpdate}
            />
          )
        })}

        {sets.filter((s) => s.sessionSetTargetId === null).map((set) => (
          <SetRow key={set.id} set={set} isActive={isActive} onUpdate={onUpdate} />
        ))}

        {isActive && (
          <div className="px-4 py-2.5">
            {addingExtra ? (
              <RecordSetForm
                sessionId={sessionId}
                athleteId={athleteId}
                sessionExerciseId={exercise.id}
                sessionSetTargetId={null}
                setNumber={nextSetNumber}
                defaultReps=""
                defaultWeight=""
                label={`Serie extra ${extraCount + 1}`}
                onSave={() => { onUpdate(); setAddingExtra(false) }}
                onCancel={() => setAddingExtra(false)}
              />
            ) : (
              <button
                onClick={() => setAddingExtra(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Agregar serie
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Target set row ───────────────────────────────────────────────────────────

function TargetSetRow({
  sessionId,
  athleteId,
  sessionExerciseId,
  target,
  recorded,
  isActive,
  rmLbs,
  onUpdate,
}: {
  sessionId: string
  athleteId: string
  sessionExerciseId: string
  target: SessionSetTarget
  recorded: SetRecord | null
  isActive: boolean
  rmLbs: string | null
  onUpdate: () => void
}) {
  const repsLabel = target.targetReps != null ? `${target.targetReps} reps` : "reps libre"
  const pctLabel = target.targetPercent != null ? `${target.targetPercent}%RM` : "%RM libre"

  const defaultWeight =
    target.targetPercent != null && rmLbs != null
      ? (Math.ceil(Number(rmLbs) * Number(target.targetPercent) / 100 * 2) / 2).toFixed(1)
      : ""

  return (
    <div className={cn("border-b last:border-0 flex items-center gap-3 px-4 py-2.5 bg-muted/10 flex-wrap", recorded?.status === "invalid" && "opacity-50")}>
      <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Serie {target.setNumber}</span>
      <span className="text-xs text-muted-foreground shrink-0">{repsLabel}</span>
      <span className="text-xs text-muted-foreground shrink-0">{pctLabel}</span>
      <div className="ml-auto flex items-center gap-2">
        {recorded && (
          <span className="text-xs text-muted-foreground">→ {recorded.reps} reps · {recorded.weightLbs} lbs</span>
        )}
        {isActive && !recorded && (
          <RecordSetForm
            key={defaultWeight}
            sessionId={sessionId}
            athleteId={athleteId}
            sessionExerciseId={sessionExerciseId}
            sessionSetTargetId={target.id}
            setNumber={target.setNumber}
            defaultReps={target.targetReps?.toString() ?? ""}
            defaultWeight={defaultWeight}
            label="Registrar"
            onSave={onUpdate}
          />
        )}
        {isActive && recorded && <SetActions set={recorded} onUpdate={onUpdate} />}
      </div>
    </div>
  )
}

// ─── Set row (extra sets) ─────────────────────────────────────────────────────

function SetRow({ set, isActive, onUpdate }: { set: SetRecord; isActive: boolean; onUpdate: () => void }) {
  return (
    <div className={cn("border-b last:border-0 flex items-center gap-3 px-4 py-2.5 flex-wrap", set.status === "invalid" && "opacity-50")}>
      <span className="text-xs text-muted-foreground w-14 shrink-0">Serie {set.setNumber}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{set.reps} reps · {set.weightLbs} lbs</span>
        {isActive && <SetActions set={set} onUpdate={onUpdate} />}
      </div>
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
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="number"
            min={0}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-16 border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">reps</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step={0.5}
            value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)}
            className="w-20 border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">lbs</span>
        </div>
        <button
          onClick={() => updateSet.mutate({ setId: set.id, reps: Number(reps), weightLbs: weightLbs || "0" })}
          disabled={updateSet.isPending}
          className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {updateSet.isPending ? "..." : "Guardar"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => updateStatus.mutate({ setId: set.id, status: set.status === "valid" ? "invalid" : "valid" })}
        className={cn(
          "text-xs px-2 py-0.5 rounded border",
          set.status === "valid" ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-green-600",
        )}
      >
        {set.status === "valid" ? "Invalidar" : "Validar"}
      </button>
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
      >
        <PencilIcon className="w-3 h-3" />
        Corregir
      </button>
    </div>
  )
}

// ─── Record set form ──────────────────────────────────────────────────────────

function RecordSetForm({
  sessionId,
  athleteId,
  sessionExerciseId,
  sessionSetTargetId,
  setNumber,
  defaultReps,
  defaultWeight,
  label,
  onSave,
  onCancel,
}: {
  sessionId: string
  athleteId: string
  sessionExerciseId: string
  sessionSetTargetId: string | null
  setNumber: number
  defaultReps: string
  defaultWeight: string
  label: string
  onSave: () => void
  onCancel?: () => void
}) {
  const [reps, setReps] = useState(defaultReps)
  const [weightLbs, setWeightLbs] = useState(defaultWeight)

  const recordSet = trpc.sessions.recordSet.useMutation({ onSuccess: () => { onSave(); setReps(defaultReps); setWeightLbs(defaultWeight) } })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    recordSet.mutate({ sessionId, athleteId, sessionExerciseId, sessionSetTargetId, setNumber, reps: Number(reps), weightLbs: weightLbs || "0" })
  }

  function handleInvalidate() {
    recordSet.mutate({ sessionId, athleteId, sessionExerciseId, sessionSetTargetId, setNumber, reps: Number(reps) || 0, weightLbs: weightLbs || "0", status: "invalid" })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min={0}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="Reps"
          className="w-16 border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">reps</span>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={0.5}
          value={weightLbs}
          onChange={(e) => setWeightLbs(e.target.value)}
          placeholder="0"
          className="w-20 border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">lbs</span>
      </div>
      <button
        type="submit"
        disabled={recordSet.isPending || reps === ""}
        className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md disabled:opacity-50"
      >
        {recordSet.isPending ? "..." : label}
      </button>
      <button
        type="button"
        onClick={handleInvalidate}
        disabled={recordSet.isPending}
        className="text-xs px-3 py-1.5 rounded-md border text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-50"
      >
        Invalidar
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
        >
          Cancelar
        </button>
      )}
    </form>
  )
}
