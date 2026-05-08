"use client"

import { trpc } from "@/lib/trpc/client"
import { PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { use, useState } from "react"

export default function RoutinePage({ params }: { params: Promise<{ teamId: string; routineId: string }> }) {
  const { teamId, routineId } = use(params)
  const [addingExercise, setAddingExercise] = useState(false)

  const { data: routine, refetch } = trpc.routines.get.useQuery({ id: routineId })
  const { data: catalog } = trpc.exercises.list.useQuery({ teamId })

  const addExercise = trpc.routines.addExercise.useMutation({ onSuccess: () => { refetch(); setAddingExercise(false) } })
  const removeExercise = trpc.routines.removeExercise.useMutation({ onSuccess: refetch })

  if (!routine) return <div className="p-8 text-muted-foreground">Cargando plantilla...</div>

  const usedExerciseIds = new Set(routine.exercises.map((e) => e.exerciseId))
  const availableExercises = catalog?.filter((e) => !usedExerciseIds.has(e.id)) ?? []

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href={`/teams/${teamId}/plantillas`} className="hover:underline">Plantillas</Link>
          {" / "}
        </p>
        <h1 className="text-xl font-semibold">{routine.name}</h1>
      </div>

      <div className="space-y-3">
        {routine.exercises.map((ex) => (
          <ExerciseCard
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

      {addingExercise ? (
        <AddExerciseForm
          routineId={routineId}
          nextOrder={routine.exercises.length}
          exercises={availableExercises}
          onAdd={(values) => addExercise.mutate(values)}
          onCancel={() => setAddingExercise(false)}
          isPending={addExercise.isPending}
          teamId={teamId}
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

// ─── Types ────────────────────────────────────────────────────────────────────

type SetTarget = {
  id: string
  setNumber: number
  targetReps: number | null
  targetPercent: string | null
}

type RoutineExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  order: number
  sets: SetTarget[]
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ ex, onRemove, onUpdate }: { ex: RoutineExercise; onRemove: () => void; onUpdate: () => void }) {
  const [editingSets, setEditingSets] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
        <span className="font-medium text-sm flex-1">{ex.exerciseName}</span>
        <span className="text-xs text-muted-foreground">{ex.sets.length} serie{ex.sets.length !== 1 ? "s" : ""}</span>
        <button
          onClick={() => setEditingSets((v) => !v)}
          className="text-xs px-2 py-1 rounded border hover:bg-muted text-muted-foreground"
        >
          {editingSets ? "Cerrar" : "Editar series"}
        </button>
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive rounded">
          <Trash2Icon className="w-4 h-4" />
        </button>
      </div>

      {!editingSets && ex.sets.length > 0 && (
        <div className="divide-y">
          {ex.sets.map((s) => (
            <SetPreviewRow key={s.id} set={s} />
          ))}
        </div>
      )}

      {editingSets && (
        <SetsEditor
          routineExerciseId={ex.id}
          initialSets={ex.sets}
          onSaved={() => { onUpdate(); setEditingSets(false) }}
        />
      )}
    </div>
  )
}

function SetPreviewRow({ set }: { set: SetTarget }) {
  const reps = set.targetReps != null ? `${set.targetReps} reps` : "reps libre"
  const pct = set.targetPercent != null ? `${set.targetPercent}%RM` : "%RM libre"
  return (
    <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground">
      <span className="w-14 font-medium text-foreground">Serie {set.setNumber}</span>
      <span>{reps}</span>
      <span>{pct}</span>
    </div>
  )
}

// ─── Sets editor ──────────────────────────────────────────────────────────────

type DraftSet = { setNumber: number; targetReps: string; targetPercent: string }

function SetsEditor({
  routineExerciseId,
  initialSets,
  onSaved,
}: {
  routineExerciseId: string
  initialSets: SetTarget[]
  onSaved: () => void
}) {
  const [sets, setSets] = useState<DraftSet[]>(
    initialSets.length > 0
      ? initialSets.map((s) => ({
          setNumber: s.setNumber,
          targetReps: s.targetReps?.toString() ?? "",
          targetPercent: s.targetPercent ?? "",
        }))
      : [{ setNumber: 1, targetReps: "", targetPercent: "" }],
  )

  const updateSets = trpc.routines.updateSets.useMutation({ onSuccess: onSaved })

  function addSet() {
    setSets((prev) => [...prev, { setNumber: prev.length + 1, targetReps: "", targetPercent: "" }])
  }

  function removeSet(index: number) {
    setSets((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, setNumber: i + 1 })),
    )
  }

  function updateSet(index: number, field: "targetReps" | "targetPercent", value: string) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function handleSave() {
    updateSets.mutate({
      routineExerciseId,
      sets: sets.map((s) => ({
        setNumber: s.setNumber,
        targetReps: s.targetReps !== "" ? Number(s.targetReps) : null,
        targetPercent: s.targetPercent !== "" ? s.targetPercent : null,
      })),
    })
  }

  return (
    <div className="border-t">
      <div className="divide-y">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Serie {s.setNumber}</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min={1}
                value={s.targetReps}
                onChange={(e) => updateSet(i, "targetReps", e.target.value)}
                placeholder="libre"
                className="w-16 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">reps</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min={1}
                max={200}
                step={1}
                value={s.targetPercent}
                onChange={(e) => updateSet(i, "targetPercent", e.target.value)}
                placeholder="libre"
                className="w-16 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">%RM</span>
            </div>
            <button
              onClick={() => removeSet(i)}
              disabled={sets.length === 1}
              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/10">
        <button
          onClick={addSet}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Agregar serie
        </button>
        <button
          onClick={handleSave}
          disabled={updateSets.isPending}
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50"
        >
          {updateSets.isPending ? "Guardando..." : "Guardar series"}
        </button>
      </div>
    </div>
  )
}

// ─── Add exercise form ────────────────────────────────────────────────────────

type CatalogExercise = { id: string; name: string; category: "team" | "system" | "mine" | "public" }

const CATEGORY_LABELS: Record<CatalogExercise["category"], string> = {
  team: "Del equipo",
  system: "Sistema",
  mine: "Mis ejercicios",
  public: "Públicos",
}

const CATEGORY_ORDER: CatalogExercise["category"][] = ["team", "system", "mine", "public"]

function AddExerciseForm({
  routineId,
  teamId: _teamId,
  nextOrder,
  exercises,
  onAdd,
  onCancel,
  isPending,
}: {
  routineId: string
  teamId: string
  nextOrder: number
  exercises: CatalogExercise[]
  onAdd: (v: { routineId: string; exerciseId: string; order: number; sets: { setNumber: number; targetReps: number | null; targetPercent: string | null }[] }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [search, setSearch] = useState("")
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "")
  const [sets, setSets] = useState<DraftSet[]>([{ setNumber: 1, targetReps: "", targetPercent: "" }])

  const filtered = search
    ? exercises.filter((ex) => ex.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

  const grouped = CATEGORY_ORDER.reduce<Record<string, CatalogExercise[]>>((acc, cat) => {
    const items = filtered.filter((ex) => ex.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  function addSet() {
    setSets((prev) => [...prev, { setNumber: prev.length + 1, targetReps: "", targetPercent: "" }])
  }

  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, setNumber: i + 1 })))
  }

  function updateSet(index: number, field: "targetReps" | "targetPercent", value: string) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!exerciseId) return
    onAdd({
      routineId,
      exerciseId,
      order: nextOrder,
      sets: sets.map((s) => ({
        setNumber: s.setNumber,
        targetReps: s.targetReps !== "" ? Number(s.targetReps) : null,
        targetPercent: s.targetPercent !== "" ? s.targetPercent : null,
      })),
    })
  }

  if (exercises.length === 0) {
    return (
      <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center space-y-2">
        <p>No hay más ejercicios disponibles en el catálogo.</p>
        <button onClick={onCancel} className="text-xs border px-3 py-1.5 rounded">Cerrar</button>
      </div>
    )
  }

  const selectedExercise = exercises.find((ex) => ex.id === exerciseId)

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/10 space-y-2">
        <p className="text-sm font-medium">Agregar ejercicio</p>

        {/* Search + picker */}
        <div className="border rounded-md overflow-hidden bg-background">
          <div className="flex items-center border-b px-3 py-1.5 gap-2">
            <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar ejercicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                  {CATEGORY_LABELS[cat as CatalogExercise["category"]]}
                </div>
                {items.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setExerciseId(ex.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/40 transition-colors ${
                      exerciseId === ex.id ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">Sin resultados</p>
            )}
          </div>
        </div>

        {selectedExercise && (
          <p className="text-xs text-muted-foreground">
            Seleccionado: <span className="font-medium text-foreground">{selectedExercise.name}</span>
          </p>
        )}
      </div>

      <div className="divide-y">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Serie {s.setNumber}</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min={1}
                value={s.targetReps}
                onChange={(e) => updateSet(i, "targetReps", e.target.value)}
                placeholder="libre"
                className="w-16 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">reps</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min={1}
                max={200}
                step={1}
                value={s.targetPercent}
                onChange={(e) => updateSet(i, "targetPercent", e.target.value)}
                placeholder="libre"
                className="w-16 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">%RM</span>
            </div>
            <button
              type="button"
              onClick={() => removeSet(i)}
              disabled={sets.length === 1}
              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/10">
        <button
          type="button"
          onClick={addSet}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Agregar serie
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded border">
            Cancelar
          </button>
          <button type="submit" disabled={isPending || !exerciseId} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50">
            {isPending ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </div>
    </form>
  )
}
