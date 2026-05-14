"use client"

import { ExercisePicker, type PickerExercise } from "@/components/exercise-picker"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import {
  ChevronLeftIcon,
  ClockIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react"
import Link from "next/link"
import { use, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

type SetType  = "reps" | "time"
type LoadType = "fixed_kg" | "percent_rm" | "rpe" | null

type SetTarget = {
  id: string
  setNumber: number
  targetReps: number | null
  targetPercent: string | null
  setType: SetType
  targetDurationSeconds: number | null
  loadType: LoadType
  loadValue: string | null
}

type DraftSet = {
  setNumber: number
  setType: SetType
  targetReps: string
  targetDurationSeconds: string
  loadType: LoadType
  loadValue: string
}

type RoutineExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  order: number
  sets: SetTarget[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinePage({ params }: { params: Promise<{ teamId: string; routineId: string }> }) {
  const { teamId, routineId } = use(params)
  const [addingExercise, setAddingExercise] = useState(false)

  const { data: routine, refetch } = trpc.routines.get.useQuery({ id: routineId })
  const { data: catalog }          = trpc.exercises.list.useQuery({ teamId })

  const addExercise    = trpc.routines.addExercise.useMutation({ onSuccess: () => { refetch(); setAddingExercise(false) } })
  const removeExercise = trpc.routines.removeExercise.useMutation({ onSuccess: () => refetch() })
  const updateType     = trpc.routines.updateType.useMutation({ onSuccess: () => refetch() })

  if (!routine) return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="h-7 w-48 bg-muted/40 rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  const usedExerciseIds   = new Set(routine.exercises.map((e) => e.exerciseId))
  const availableExercises = catalog?.filter((e) => !usedExerciseIds.has(e.id)) ?? []
  const isCircuit         = routine.type === "circuit"

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/teams/${teamId}/rutinas`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Rutinas
        </Link>
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          {routine.name}
        </h1>
      </div>

      {/* Routine type selector */}
      <div className="border border-border rounded-xl p-4 space-y-3 bg-card/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tipo de rutina</p>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["sequential", "circuit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateType.mutate({ id: routineId, type: t, circuitRounds: routine.circuitRounds })}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                routine.type === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {t === "sequential" ? <><ZapIcon className="w-3.5 h-3.5" />Secuencial</> : <><RefreshCwIcon className="w-3.5 h-3.5" />Circuito</>}
            </button>
          ))}
        </div>

        {isCircuit && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground shrink-0">Rondas</label>
            <input
              type="number"
              min={1}
              max={20}
              defaultValue={routine.circuitRounds ?? 3}
              onBlur={(e) => {
                const v = parseInt(e.target.value)
                if (!isNaN(v) && v > 0) updateType.mutate({ id: routineId, type: "circuit", circuitRounds: v })
              }}
              className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
            <p className="text-xs text-muted-foreground">Los atletas completarán todos los ejercicios {routine.circuitRounds ?? 3} veces seguidas.</p>
          </div>
        )}
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        {routine.exercises.map((ex, idx) => (
          <ExerciseCard
            key={ex.id}
            ex={ex as RoutineExercise}
            index={idx}
            isCircuit={isCircuit}
            onRemove={() => removeExercise.mutate({ routineExerciseId: ex.id })}
            onUpdate={refetch}
          />
        ))}

        {routine.exercises.length === 0 && !addingExercise && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
            <p className="text-sm text-muted-foreground">Sin ejercicios. Agrega el primero.</p>
          </div>
        )}
      </div>

      {/* Add exercise */}
      {addingExercise ? (
        <AddExerciseForm
          routineId={routineId}
          teamId={teamId}
          nextOrder={routine.exercises.length}
          exercises={availableExercises}
          isCircuit={isCircuit}
          circuitRounds={routine.circuitRounds ?? 3}
          onAdd={(values) => addExercise.mutate(values)}
          onCancel={() => setAddingExercise(false)}
          isPending={addExercise.isPending}
        />
      ) : (
        <button
          onClick={() => setAddingExercise(true)}
          className="flex items-center justify-center gap-1.5 text-sm border border-border border-dashed px-3 py-3 rounded-xl hover:border-primary/50 hover:text-primary text-muted-foreground w-full transition-colors cursor-pointer"
        >
          <PlusIcon className="w-4 h-4" />
          Agregar ejercicio
        </button>
      )}
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  ex, index, isCircuit, onRemove, onUpdate,
}: {
  ex: RoutineExercise
  index: number
  isCircuit: boolean
  onRemove: () => void
  onUpdate: () => void
}) {
  const [editingSets, setEditingSets] = useState(false)

  const setCount   = ex.sets.length
  const hasTimed   = ex.sets.some(s => s.setType === "time")
  const label      = isCircuit
    ? `${setCount} serie${setCount !== 1 ? "s" : ""} × ronda`
    : `${setCount} serie${setCount !== 1 ? "s" : ""}`

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/60">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/10">
        <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="font-semibold text-sm flex-1 truncate">{ex.exerciseName}</span>
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          {hasTimed && <ClockIcon className="w-3 h-3" />}
          {label}
        </span>
        <button
          onClick={() => setEditingSets((v) => !v)}
          className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {editingSets ? "Cerrar" : "Editar"}
        </button>
        <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer">
          <Trash2Icon className="w-3.5 h-3.5" />
        </button>
      </div>

      {!editingSets && ex.sets.length > 0 && (
        <div className="divide-y divide-border">
          {ex.sets.map((s) => <SetPreviewRow key={s.id} set={s} />)}
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

// ─── Set preview row ──────────────────────────────────────────────────────────

function SetPreviewRow({ set }: { set: SetTarget }) {
  const isTime = set.setType === "time"
  const effort = isTime
    ? set.targetDurationSeconds != null ? `${set.targetDurationSeconds}s` : "tiempo libre"
    : set.targetReps != null ? `${set.targetReps} reps` : "reps libre"

  const load = (() => {
    if (set.loadType === "percent_rm" && set.loadValue) return `${set.loadValue}% RM`
    if (set.loadType === "fixed_kg"  && set.loadValue) return `${set.loadValue} kg`
    if (set.loadType === "rpe"       && set.loadValue) return `RPE ${set.loadValue}`
    if (set.targetPercent)                              return `${set.targetPercent}% RM`
    return null
  })()

  return (
    <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground">
      <span className="w-14 font-medium text-foreground shrink-0">Serie {set.setNumber}</span>
      <span className="flex items-center gap-1">
        {set.setType === "time" && <ClockIcon className="w-3 h-3" />}
        {effort}
      </span>
      {load && <span className="text-primary/80">{load}</span>}
    </div>
  )
}

// ─── Sets editor ──────────────────────────────────────────────────────────────

function defaultDraft(setNumber: number): DraftSet {
  return { setNumber, setType: "reps", targetReps: "", targetDurationSeconds: "", loadType: null, loadValue: "" }
}

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
          setType: s.setType ?? "reps",
          targetReps: s.targetReps?.toString() ?? "",
          targetDurationSeconds: s.targetDurationSeconds?.toString() ?? "",
          loadType: s.loadType ?? (s.targetPercent ? "percent_rm" : null),
          loadValue: s.loadValue ?? s.targetPercent ?? "",
        }))
      : [defaultDraft(1)],
  )

  const updateSets = trpc.routines.updateSets.useMutation({ onSuccess: onSaved })

  function addSet() {
    setSets((prev) => [...prev, defaultDraft(prev.length + 1)])
  }

  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, setNumber: i + 1 })))
  }

  function update(index: number, patch: Partial<DraftSet>) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function handleSave() {
    updateSets.mutate({
      routineExerciseId,
      sets: sets.map((s) => ({
        setNumber: s.setNumber,
        setType: s.setType,
        targetReps: s.setType === "reps" && s.targetReps !== "" ? Number(s.targetReps) : null,
        targetDurationSeconds: s.setType === "time" && s.targetDurationSeconds !== "" ? Number(s.targetDurationSeconds) : null,
        loadType: s.setType === "reps" ? s.loadType : null,
        loadValue: s.setType === "reps" && s.loadValue !== "" ? s.loadValue : null,
        targetPercent: null, // cleared — use loadValue/loadType going forward
      })),
    })
  }

  return (
    <div className="border-t border-border">
      <div className="divide-y divide-border">
        {sets.map((s, i) => (
          <SetEditorRow
            key={i}
            set={s}
            onUpdate={(patch) => update(i, patch)}
            onRemove={() => removeSet(i)}
            canRemove={sets.length > 1}
          />
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/10">
        <button
          onClick={addSet}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Agregar serie
        </button>
        <button
          onClick={handleSave}
          disabled={updateSets.isPending}
          className="text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer font-medium hover:bg-primary/90 transition-colors"
        >
          {updateSets.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  )
}

function SetEditorRow({
  set, onUpdate, onRemove, canRemove,
}: {
  set: DraftSet
  onUpdate: (patch: Partial<DraftSet>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const isTime = set.setType === "time"

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Serie {set.setNumber}</span>

        {/* Type toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => onUpdate({ setType: "reps" })}
            className={cn(
              "px-2.5 py-1 transition-colors cursor-pointer",
              !isTime ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            Reps
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ setType: "time" })}
            className={cn(
              "px-2.5 py-1 flex items-center gap-1 transition-colors cursor-pointer",
              isTime ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            <ClockIcon className="w-3 h-3" />
            Tiempo
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="ml-auto p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors cursor-pointer"
        >
          <Trash2Icon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fields depending on type */}
      {isTime ? (
        <div className="flex items-center gap-2 ml-[4.25rem]">
          <input
            type="number"
            min={1}
            value={set.targetDurationSeconds}
            onChange={(e) => onUpdate({ targetDurationSeconds: e.target.value })}
            placeholder="60"
            className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">segundos</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 ml-[4.25rem] flex-wrap">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              value={set.targetReps}
              onChange={(e) => onUpdate({ targetReps: e.target.value })}
              placeholder="libre"
              className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            <span className="text-xs text-muted-foreground">reps</span>
          </div>

          {/* Load type */}
          <select
            value={set.loadType ?? ""}
            onChange={(e) => onUpdate({ loadType: (e.target.value || null) as LoadType, loadValue: "" })}
            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="">Sin carga</option>
            <option value="percent_rm">% RM</option>
            <option value="fixed_kg">Peso fijo (kg)</option>
            <option value="rpe">RPE</option>
          </select>

          {set.loadType && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={set.loadType === "rpe" ? 10 : 999}
                step={set.loadType === "percent_rm" ? 5 : 1}
                value={set.loadValue}
                onChange={(e) => onUpdate({ loadValue: e.target.value })}
                placeholder={set.loadType === "percent_rm" ? "75" : set.loadType === "rpe" ? "8" : "60"}
                className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
              <span className="text-xs text-muted-foreground">
                {set.loadType === "percent_rm" ? "%" : set.loadType === "fixed_kg" ? "kg" : "RPE"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add exercise form ────────────────────────────────────────────────────────

function AddExerciseForm({
  routineId, teamId: _teamId, nextOrder, exercises, isCircuit, circuitRounds, onAdd, onCancel, isPending,
}: {
  routineId: string
  teamId: string
  nextOrder: number
  exercises: PickerExercise[]
  isCircuit: boolean
  circuitRounds: number
  onAdd: (v: {
    routineId: string
    exerciseId: string
    order: number
    sets: {
      setNumber: number
      targetReps: number | null
      targetPercent: string | null
      setType: SetType
      targetDurationSeconds: number | null
      loadType: LoadType
      loadValue: string | null
    }[]
  }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const defaultSetsCount = isCircuit ? 1 : 3

  function makeDefaultSets(): DraftSet[] {
    return Array.from({ length: defaultSetsCount }, (_, i) => ({
      setNumber: i + 1,
      setType: "reps" as SetType,
      targetReps: isCircuit ? "10" : i === 0 ? "5" : i === 1 ? "4" : "3",
      targetDurationSeconds: "",
      loadType: "percent_rm" as LoadType,
      loadValue: isCircuit ? "70" : i === 0 ? "75" : i === 1 ? "82" : "90",
    }))
  }

  const [exerciseId, setExerciseId] = useState("")
  const [sets, setSets]             = useState<DraftSet[]>(makeDefaultSets)

  function addSet() {
    setSets((prev) => [...prev, defaultDraft(prev.length + 1)])
  }
  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, setNumber: i + 1 })))
  }
  function update(index: number, patch: Partial<DraftSet>) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
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
        setType: s.setType,
        targetReps: s.setType === "reps" && s.targetReps !== "" ? Number(s.targetReps) : null,
        targetDurationSeconds: s.setType === "time" && s.targetDurationSeconds !== "" ? Number(s.targetDurationSeconds) : null,
        loadType: s.setType === "reps" ? s.loadType : null,
        loadValue: s.setType === "reps" && s.loadValue !== "" ? s.loadValue : null,
        targetPercent: null,
      })),
    })
  }

  if (exercises.length === 0) {
    return (
      <div className="border border-border rounded-xl p-4 text-sm text-muted-foreground text-center space-y-2">
        <p>No hay más ejercicios disponibles.</p>
        <button onClick={onCancel} className="text-xs border border-border px-3 py-1.5 rounded-lg cursor-pointer">Cerrar</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl overflow-hidden bg-card/60">
      <div className="px-4 py-3 border-b border-border bg-muted/10 space-y-2">
        <p className="text-sm font-semibold text-foreground">Agregar ejercicio</p>
        <ExercisePicker exercises={exercises} value={exerciseId} onChange={setExerciseId} />
        {isCircuit && (
          <p className="text-xs text-muted-foreground">
            Modo circuito: define 1 serie por ejercicio — se repetirá {circuitRounds} veces por ronda.
          </p>
        )}
      </div>

      <div className="divide-y divide-border">
        {sets.map((s, i) => (
          <SetEditorRow
            key={i}
            set={s}
            onUpdate={(patch) => update(i, patch)}
            onRemove={() => removeSet(i)}
            canRemove={sets.length > 1}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/10">
        {!isCircuit ? (
          <button
            type="button"
            onClick={addSet}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Agregar serie
          </button>
        ) : <div />}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !exerciseId}
            className="text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg disabled:opacity-50 font-medium cursor-pointer hover:bg-primary/90 transition-colors"
          >
            {isPending ? "Agregando…" : "Agregar"}
          </button>
        </div>
      </div>
    </form>
  )
}
