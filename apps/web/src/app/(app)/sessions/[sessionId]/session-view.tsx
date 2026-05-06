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
      {/* Header */}
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
          <span className={cn("text-sm font-medium capitalize", session.status === "completed" ? "text-green-600" : "text-muted-foreground")}>
            {session.status === "completed" ? "Completada" : "Cancelada"}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Athlete sidebar */}
        <aside className="w-48 border-r flex flex-col overflow-y-auto shrink-0">
          <p className="text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wide">Atletas</p>
          {session.athletes.map((a) => (
            <button
              key={a.athleteId}
              onClick={() => setSelectedAthleteId(a.athleteId)}
              className={cn(
                "text-left px-4 py-3 text-sm border-b last:border-0 hover:bg-muted/50 transition-colors",
                a.athleteId === activeAthleteId && "bg-muted font-medium",
                a.status === "cancelled" && "opacity-40 line-through",
              )}
            >
              {a.athleteId.slice(0, 8)}…
            </button>
          ))}
        </aside>

        {/* Main: exercises for selected athlete */}
        <div className="flex-1 overflow-y-auto p-6">
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

// ─── Athlete exercises ────────────────────────────────────────────────────────

type Exercise = { id: string; exerciseId: string; targetSets: number; targetReps: number; targetWeight: string | null }

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

  return (
    <div className="space-y-4">
      {exercises.map((ex) => {
        const exSets = sets?.filter((s) => s.sessionExerciseId === ex.id) ?? []
        return (
          <ExerciseCard
            key={ex.id}
            sessionId={sessionId}
            athleteId={athleteId}
            exercise={ex}
            sets={exSets}
            isActive={isActive}
            onUpdate={refetch}
          />
        )
      })}
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

type SetRecord = {
  id: string
  setNumber: number
  reps: number
  weight: string | null
  status: "valid" | "invalid"
}

function ExerciseCard({
  sessionId,
  athleteId,
  exercise,
  sets,
  isActive,
  onUpdate,
}: {
  sessionId: string
  athleteId: string
  exercise: Exercise
  sets: SetRecord[]
  isActive: boolean
  onUpdate: () => void
}) {
  const [adding, setAdding] = useState(false)

  const nextSetNumber = (sets.at(-1)?.setNumber ?? 0) + 1

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{exercise.exerciseName}</p>
          <p className="text-xs text-muted-foreground">
            {exercise.targetSets} × {exercise.targetReps} reps
            {exercise.targetWeight ? ` @ ${exercise.targetWeight} kg` : ""}
          </p>
        </div>
        {isActive && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted"
          >
            <PlusIcon className="w-3 h-3" />
            Serie
          </button>
        )}
      </div>

      <div className="divide-y">
        {sets.map((set) => (
          <SetRow key={set.id} set={set} isActive={isActive} onUpdate={onUpdate} />
        ))}
        {sets.length === 0 && !adding && (
          <p className="px-4 py-3 text-xs text-muted-foreground">Sin series registradas</p>
        )}
      </div>

      {adding && (
        <div className="border-t">
          <RecordSetForm
            sessionId={sessionId}
            athleteId={athleteId}
            sessionExerciseId={exercise.id}
            setNumber={nextSetNumber}
            targetReps={exercise.targetReps}
            targetWeight={exercise.targetWeight}
            onSave={() => { setAdding(false); onUpdate() }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({ set, isActive, onUpdate }: { set: SetRecord; isActive: boolean; onUpdate: () => void }) {
  const updateStatus = trpc.sessions.updateSetStatus.useMutation({ onSuccess: onUpdate })
  const deleteSet = trpc.sessions.deleteSet.useMutation({ onSuccess: onUpdate })

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2 text-sm", set.status === "invalid" && "opacity-50")}>
      <span className="text-muted-foreground w-16">Serie {set.setNumber}</span>
      <span className="font-medium">{set.reps} reps</span>
      {set.weight && <span className="text-muted-foreground">{set.weight} kg</span>}

      {isActive && (
        <div className="ml-auto flex items-center gap-1">
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
      )}
    </div>
  )
}

// ─── Record set form ──────────────────────────────────────────────────────────

function RecordSetForm({
  sessionId,
  athleteId,
  sessionExerciseId,
  setNumber,
  targetReps,
  targetWeight,
  onSave,
  onCancel,
}: {
  sessionId: string
  athleteId: string
  sessionExerciseId: string
  setNumber: number
  targetReps: number
  targetWeight: string | null
  onSave: () => void
  onCancel: () => void
}) {
  const [reps, setReps] = useState(String(targetReps))
  const [weight, setWeight] = useState(targetWeight ?? "")

  const recordSet = trpc.sessions.recordSet.useMutation({ onSuccess: onSave })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    recordSet.mutate({
      sessionId,
      athleteId,
      sessionExerciseId,
      setNumber,
      reps: Number(reps),
      weight: weight || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
      <span className="text-sm text-muted-foreground w-16">Serie {setNumber}</span>
      <input
        autoFocus
        type="number"
        min={0}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        placeholder="Reps"
        className="w-20 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="number"
        min={0}
        step={0.5}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="Peso (kg)"
        className="w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={recordSet.isPending}
        className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded disabled:opacity-50"
      >
        Guardar
      </button>
      <button type="button" onClick={onCancel} className="text-xs px-2 py-1.5 rounded border">
        Cancelar
      </button>
    </form>
  )
}
