"use client"

import { trpc } from "@/lib/trpc/client"
import { Trash2Icon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function RoutinePage({ params }: { params: { routineId: string } }) {
  const { routineId } = params
  const [addingExercise, setAddingExercise] = useState(false)

  const { data: routine, refetch } = trpc.routines.get.useQuery({ id: routineId })
  const { data: catalog } = trpc.exercises.list.useQuery()

  const addExercise = trpc.routines.addExercise.useMutation({ onSuccess: () => { refetch(); setAddingExercise(false) } })
  const removeExercise = trpc.routines.removeExercise.useMutation({ onSuccess: refetch })

  if (!routine) return <div className="p-8 text-muted-foreground">Cargando rutina...</div>

  const usedExerciseIds = new Set(routine.exercises.map((e) => e.exerciseId))
  const availableExercises = catalog?.filter((e) => !usedExerciseIds.has(e.id)) ?? []

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/dashboard" className="hover:underline">Equipos</Link>
          {" / "}
          <Link href={`/teams/${routine.teamId}`} className="hover:underline">Equipo</Link>
          {" / "}
        </p>
        <h1 className="text-xl font-semibold">{routine.name}</h1>
      </div>

      {/* Exercise list */}
      <div className="space-y-2">
        {routine.exercises.map((ex, i) => (
          <ExerciseRow
            key={ex.id}
            ex={ex}
            onRemove={() => removeExercise.mutate({ routineExerciseId: ex.id })}
            onUpdate={refetch}
          />
        ))}
        {routine.exercises.length === 0 && !addingExercise && (
          <p className="text-muted-foreground text-sm text-center py-8 border rounded-lg">
            Sin ejercicios. Agrega el primero.
          </p>
        )}
      </div>

      {/* Add exercise form */}
      {addingExercise ? (
        <AddExerciseForm
          routineId={routineId}
          nextOrder={routine.exercises.length}
          exercises={availableExercises}
          onAdd={(values) => addExercise.mutate({ routineId, ...values })}
          onCancel={() => setAddingExercise(false)}
        />
      ) : (
        <button
          onClick={() => setAddingExercise(true)}
          className="flex items-center gap-1 text-sm border px-3 py-2 rounded-md hover:bg-muted w-full justify-center"
        >
          <PlusIcon className="w-4 h-4" />
          Agregar ejercicio
        </button>
      )}
    </div>
  )
}

// ─── Exercise row ─────────────────────────────────────────────────────────────

type RoutineExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  targetSets: number
  targetReps: number
  targetWeight: string | null
  order: number
}

function ExerciseRow({
  ex,
  onRemove,
  onUpdate,
}: {
  ex: RoutineExercise
  onRemove: () => void
  onUpdate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [sets, setSets] = useState(String(ex.targetSets))
  const [reps, setReps] = useState(String(ex.targetReps))
  const [weight, setWeight] = useState(ex.targetWeight ?? "")

  const updateExercise = trpc.routines.updateExercise.useMutation({
    onSuccess: () => { onUpdate(); setEditing(false) },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateExercise.mutate({
      routineExerciseId: ex.id,
      targetSets: Number(sets),
      targetReps: Number(reps),
      targetWeight: weight || null,
    })
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs text-muted-foreground w-4">{ex.order + 1}</span>
        <span className="font-medium text-sm flex-1">{ex.exerciseName}</span>
        {!editing && (
          <span className="text-xs text-muted-foreground">
            {ex.targetSets} × {ex.targetReps}
            {ex.targetWeight ? ` @ ${ex.targetWeight} kg` : ""}
          </span>
        )}
        <div className="flex gap-1">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-2 py-1 rounded border hover:bg-muted text-muted-foreground"
            >
              Editar
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1 text-muted-foreground hover:text-destructive rounded"
          >
            <Trash2Icon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="flex items-center gap-2 px-4 py-3 border-t bg-muted/30">
          <label className="text-xs text-muted-foreground">Series</label>
          <input
            autoFocus
            type="number"
            min={1}
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="w-16 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <label className="text-xs text-muted-foreground">Reps</label>
          <input
            type="number"
            min={1}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-16 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <label className="text-xs text-muted-foreground">Peso (kg)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Opcional"
            className="w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded ml-auto">
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded border">
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}

// ─── Add exercise form ────────────────────────────────────────────────────────

type CatalogExercise = { id: string; name: string }

function AddExerciseForm({
  routineId,
  nextOrder,
  exercises,
  onAdd,
  onCancel,
}: {
  routineId: string
  nextOrder: number
  exercises: CatalogExercise[]
  onAdd: (v: { exerciseId: string; targetSets: number; targetReps: number; targetWeight?: string; order: number }) => void
  onCancel: () => void
}) {
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "")
  const [sets, setSets] = useState("3")
  const [reps, setReps] = useState("5")
  const [weight, setWeight] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!exerciseId) return
    onAdd({
      exerciseId,
      targetSets: Number(sets),
      targetReps: Number(reps),
      targetWeight: weight || undefined,
      order: nextOrder,
    })
  }

  if (exercises.length === 0) {
    return (
      <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center space-y-2">
        <p>No hay más ejercicios disponibles en el catálogo.</p>
        <button onClick={onCancel} className="text-xs border px-3 py-1.5 rounded">
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
      <p className="text-sm font-medium">Agregar ejercicio</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">Ejercicio</label>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Series</label>
          <input
            type="number"
            min={1}
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Repeticiones</label>
          <input
            type="number"
            min={1}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">Peso objetivo (kg) — opcional</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Dejar vacío si no aplica"
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm px-4 py-2 rounded-md border">
          Cancelar
        </button>
        <button type="submit" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md">
          Agregar
        </button>
      </div>
    </form>
  )
}
