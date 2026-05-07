"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { CheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"

type Props = { sessionId: string }

export function SessionView({ sessionId }: Props) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)

  const { data: session, refetch: refetchSession } = trpc.sessions.get.useQuery({ id: sessionId })
  const completeSession = trpc.sessions.complete.useMutation({ onSuccess: refetchSession })
  const cancelSession = trpc.sessions.cancel.useMutation({ onSuccess: refetchSession })

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
              onClick={() => completeSession.mutate({ id: sessionId })}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
            >
              <CheckIcon className="w-4 h-4" />
              Completar
            </button>
            <button
              onClick={() => cancelSession.mutate({ id: sessionId })}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border text-destructive hover:bg-destructive/10"
            >
              <XIcon className="w-4 h-4" />
              Cancelar
            </button>
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
            <button
              key={a.athleteId}
              onClick={() => setSelectedAthleteId(a.athleteId)}
              className={cn(
                "shrink-0 px-4 py-2.5 lg:py-3 text-sm border-r lg:border-r-0 lg:border-b last:border-0 hover:bg-muted/50 transition-colors whitespace-nowrap text-left",
                a.athleteId === activeAthleteId && "bg-muted font-medium",
                a.status === "cancelled" && "opacity-40 line-through",
              )}
            >
              {a.athleteName}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeAthleteId ? (
            <AthleteExercises
              sessionId={sessionId}
              athleteId={activeAthleteId}
              exercises={session.exercises}
              isActive={isActive}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Selecciona un atleta</p>
          )}
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
}: {
  sessionId: string
  athleteId: string
  exercises: Exercise[]
  isActive: boolean
}) {
  const { data: sets, refetch } = trpc.sessions.athleteSets.useQuery({ sessionId, athleteId })
  const { data: athleteRms } = trpc.sessions.athleteRms.useQuery({ sessionId, athleteId })

  return (
    <div className="space-y-4">
      {exercises.map((ex) => {
        const exSets = (sets ?? []).filter((s) => s.sessionExerciseId === ex.id) as SetRecord[]
        const rmLbs = athleteRms?.[ex.exerciseId] ?? null
        return (
          <ExerciseCard
            key={ex.id}
            sessionId={sessionId}
            athleteId={athleteId}
            exercise={ex}
            sets={exSets}
            isActive={isActive}
            rmLbs={rmLbs}
            onUpdate={refetch}
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
  rmLbs,
  onUpdate,
}: {
  sessionId: string
  athleteId: string
  exercise: Exercise
  sets: SetRecord[]
  isActive: boolean
  rmLbs: string | null
  onUpdate: () => void
}) {
  const [addingExtra, setAddingExtra] = useState(false)

  const nextSetNumber = (sets.at(-1)?.setNumber ?? 0) + 1
  const extraCount = sets.filter((s) => s.sessionSetTargetId === null).length

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{exercise.exerciseName}</p>
          <p className="text-xs text-muted-foreground">{exercise.targets.length} series planeadas</p>
        </div>
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
    <div className={cn("border-b last:border-0", recorded?.status === "invalid" && "opacity-50")}>
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/10">
        <span className="text-xs font-medium text-muted-foreground w-14">Serie {target.setNumber}</span>
        <span className="text-xs text-muted-foreground">{repsLabel}</span>
        <span className="text-xs text-muted-foreground">{pctLabel}</span>
        {recorded && (
          <span className="ml-auto text-xs text-muted-foreground">
            → {recorded.reps} reps · {recorded.weightLbs} lbs
          </span>
        )}
      </div>

      {isActive && !recorded && (
        <div className="px-4 py-2 border-t border-dashed">
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
        </div>
      )}

      {isActive && recorded && (
        <SetActions set={recorded} onUpdate={onUpdate} />
      )}
    </div>
  )
}

// ─── Set row (extra sets) ─────────────────────────────────────────────────────

function SetRow({ set, isActive, onUpdate }: { set: SetRecord; isActive: boolean; onUpdate: () => void }) {
  return (
    <div className={cn("border-b last:border-0", set.status === "invalid" && "opacity-50")}>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-xs text-muted-foreground w-14">Serie {set.setNumber}</span>
        <span className="text-sm font-medium">{set.reps} reps</span>
        <span className="text-xs text-muted-foreground">{set.weightLbs} lbs</span>
        {isActive && <SetActions set={set} onUpdate={onUpdate} />}
      </div>
    </div>
  )
}

// ─── Set actions ──────────────────────────────────────────────────────────────

function SetActions({ set, onUpdate }: { set: SetRecord; onUpdate: () => void }) {
  const updateStatus = trpc.sessions.updateSetStatus.useMutation({ onSuccess: onUpdate })
  const deleteSet = trpc.sessions.deleteSet.useMutation({ onSuccess: onUpdate })

  return (
    <div className="flex items-center gap-1 px-4 pb-2">
      <button
        onClick={() => updateStatus.mutate({ setId: set.id, status: set.status === "valid" ? "invalid" : "valid" })}
        className={cn(
          "text-xs px-2 py-0.5 rounded border",
          set.status === "valid" ? "text-muted-foreground hover:text-destructive" : "text-green-600 hover:bg-green-50",
        )}
      >
        {set.status === "valid" ? "Invalidar" : "Validar"}
      </button>
      <button
        onClick={() => deleteSet.mutate({ setId: set.id })}
        className="p-1 text-muted-foreground hover:text-destructive rounded"
      >
        <Trash2Icon className="w-3.5 h-3.5" />
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
    recordSet.mutate({
      sessionId,
      athleteId,
      sessionExerciseId,
      sessionSetTargetId,
      setNumber,
      reps: Number(reps),
      weightLbs: weightLbs || "0",
    })
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
