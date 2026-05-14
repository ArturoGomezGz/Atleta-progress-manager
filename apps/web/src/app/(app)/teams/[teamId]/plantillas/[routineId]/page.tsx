"use client"

import { ExercisePicker, type PickerExercise } from "@/components/exercise-picker"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import type { RoutineContent, RoutineExerciseContent, RoutineItemBlock, RoutineItemExercise, RoutineSet } from "@atleta/db/schema"
import {
  ChevronLeftIcon,
  ClockIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

type SetType  = "reps" | "time"
type LoadType = "fixed_kg" | "percent_rm" | "rpe" | null

type DraftSet = {
  setNumber: number
  setType: SetType
  targetReps: string
  targetDurationSeconds: string
  loadType: LoadType
  loadValue: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultDraft(setNumber: number): DraftSet {
  return { setNumber, setType: "reps", targetReps: "", targetDurationSeconds: "", loadType: null, loadValue: "" }
}

function draftFromSet(s: RoutineSet): DraftSet {
  return {
    setNumber:             s.setNumber,
    setType:               (s.setType === "time" ? "time" : "reps") as SetType,
    targetReps:            s.targetReps?.toString() ?? "",
    targetDurationSeconds: s.targetDurationSeconds?.toString() ?? "",
    loadType:              (s.loadType ?? null) as LoadType,
    loadValue:             s.loadValue?.toString() ?? "",
  }
}

function draftToSet(d: DraftSet): RoutineSet {
  return {
    setNumber: d.setNumber,
    setType:   d.setType,
    ...(d.setType === "reps" && d.targetReps !== ""   ? { targetReps: Number(d.targetReps) } : {}),
    ...(d.setType === "time" && d.targetDurationSeconds !== "" ? { targetDurationSeconds: Number(d.targetDurationSeconds) } : {}),
    ...(d.setType === "reps" && d.loadType ? { loadType: d.loadType } : {}),
    ...(d.setType === "reps" && d.loadType && d.loadValue !== "" ? { loadValue: Number(d.loadValue) } : {}),
  }
}

function setLabel(sets: RoutineSet[]): string {
  const n = sets.length
  const hasTimed = sets.some((s) => s.setType === "time")
  return `${n} serie${n !== 1 ? "s" : ""}${hasTimed ? " (con tiempo)" : ""}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinePage({ params }: { params: Promise<{ teamId: string; routineId: string }> }) {
  const { teamId, routineId } = use(params)

  const { data: routineData, refetch } = trpc.routines.get.useQuery({ id: routineId })
  const { data: catalog }              = trpc.exercises.list.useQuery({ teamId })
  const updateContent                  = trpc.routines.updateContent.useMutation({ onSuccess: () => refetch() })
  const renameRoutine                  = trpc.routines.rename.useMutation({ onSuccess: () => refetch() })

  const [localContent, setLocalContent] = useState<RoutineContent | null>(null)
  const [dirty, setDirty]               = useState(false)
  const [name, setName]                 = useState("")

  useEffect(() => { if (routineData) setName(routineData.name) }, [routineData])

  const content: RoutineContent = localContent ?? routineData?.content ?? { v: 1, items: [] }
  const exerciseNames = routineData?.exerciseNames ?? {}

  function mutate(fn: (c: RoutineContent) => RoutineContent) {
    setLocalContent((prev) => fn(prev ?? routineData?.content ?? { v: 1, items: [] }))
    setDirty(true)
  }

  function handleSave() {
    updateContent.mutate({ id: routineId, content }, {
      onSuccess: () => { setLocalContent(null); setDirty(false) },
    })
  }

  function addExercise(exerciseId: string) {
    const maxOrder = Math.max(-1, ...content.items.map((i) => i.order))
    const defaultSets: RoutineSet[] = routineData?.category === "evaluation"
      ? [
          { setNumber: 1, setType: "reps", targetReps: 5, loadType: "percent_rm", loadValue: 80 },
          { setNumber: 2, setType: "reps", targetReps: 3, loadType: "percent_rm", loadValue: 90 },
          { setNumber: 3, setType: "reps",               loadType: "percent_rm", loadValue: 100 },
        ]
      : [{ setNumber: 1, setType: "reps" }]

    const newEx: RoutineItemExercise = {
      type: "exercise",
      id: crypto.randomUUID(),
      exerciseId,
      order: maxOrder + 1,
      sets: defaultSets,
    }
    mutate((c) => ({ ...c, items: [...c.items, newEx] }))
  }

  function removeItem(id: string) {
    mutate((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }))
  }

  function updateItem(id: string, patch: Partial<RoutineItemExercise | RoutineItemBlock>) {
    mutate((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === id ? { ...i, ...patch } as typeof i : i)),
    }))
  }

  const usedIds = new Set(content.items.flatMap((i) =>
    i.type === "exercise" ? [i.exerciseId] : i.exercises.map((e) => e.exerciseId)
  ))
  const available = (catalog ?? []).filter((e) => !usedIds.has(e.id))

  if (!routineData) return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="h-7 w-48 bg-muted/40 rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[1,2,3].map((i) => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  const sorted = [...content.items].sort((a, b) => a.order - b.order)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/teams/${teamId}/rutinas?tab=${routineData?.category === "training" ? "entrenamientos" : "evaluaciones"}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
            Rutinas
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim()
              if (!trimmed) { setName(routineData.name); return }
              if (trimmed !== routineData.name) renameRoutine.mutate({ id: routineId, name: trimmed })
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
            className="text-2xl font-bold tracking-wider uppercase bg-transparent outline-none border-b border-transparent hover:border-muted-foreground/30 focus:border-primary/60 transition-colors w-full min-h-[44px] cursor-text"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
            aria-label="Nombre de la plantilla"
          />
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={updateContent.isPending}
            className="shrink-0 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors cursor-pointer"
          >
            {updateContent.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        {sorted.map((item, idx) =>
          item.type === "exercise" ? (
            <ExerciseCard
              key={item.id}
              item={item}
              index={idx}
              isEvaluation={routineData?.category === "evaluation"}
              exerciseName={exerciseNames[item.exerciseId] ?? "…"}
              onRemove={() => removeItem(item.id)}
              onUpdate={(patch) => updateItem(item.id, patch)}
            />
          ) : (
            <BlockCard
              key={item.id}
              item={item}
              index={idx}
              exerciseNames={exerciseNames}
              onRemove={() => removeItem(item.id)}
              onUpdate={(patch) => updateItem(item.id, patch)}
            />
          )
        )}

        {content.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
            <p className="text-sm text-muted-foreground">Sin ejercicios. Agrega el primero.</p>
          </div>
        )}
      </div>

      {/* Add exercise */}
      {available.length > 0 && (
        <AddExerciseRow exercises={available} onAdd={addExercise} />
      )}
    </div>
  )
}

// ─── Add exercise row ─────────────────────────────────────────────────────────

function AddExerciseRow({ exercises, onAdd }: { exercises: PickerExercise[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("")

  function handleAdd() {
    if (!selected) return
    onAdd(selected)
    setSelected("")
    setOpen(false)
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center justify-center gap-1.5 text-sm border border-border border-dashed px-3 py-3 rounded-xl hover:border-primary/50 hover:text-primary text-muted-foreground w-full transition-colors cursor-pointer"
    >
      <PlusIcon className="w-4 h-4" />
      Agregar ejercicio
    </button>
  )

  return (
    <div className="border border-border rounded-xl bg-card/60">
      <div className="px-4 py-3 border-b border-border bg-muted/10 space-y-2">
        <p className="text-sm font-semibold">Agregar ejercicio</p>
        <ExercisePicker exercises={exercises} value={selected} onChange={setSelected} />
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-muted/10">
        <button onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer">
          Cancelar
        </button>
        <button
          onClick={handleAdd}
          disabled={!selected}
          className="text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg disabled:opacity-50 font-medium cursor-pointer hover:bg-primary/90 transition-colors"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  item, index, isEvaluation, exerciseName, onRemove, onUpdate,
}: {
  item: RoutineItemExercise
  index: number
  isEvaluation: boolean
  exerciseName: string
  onRemove: () => void
  onUpdate: (patch: Partial<RoutineItemExercise>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts]     = useState<DraftSet[]>(() => item.sets.map(draftFromSet))
  const [meta, setMeta]         = useState({ tempo: item.tempo ?? "", restSeconds: item.restSeconds?.toString() ?? "", goal: item.goal ?? "", notes: item.notes ?? "" })

  const handleSave = useCallback(() => {
    onUpdate({
      sets:        drafts.map(draftToSet),
      ...(isEvaluation ? {} : {
        tempo:       meta.tempo || undefined,
        restSeconds: meta.restSeconds ? Number(meta.restSeconds) : undefined,
        goal:        (meta.goal as RoutineExerciseContent["goal"]) || undefined,
        notes:       meta.notes || undefined,
      }),
    })
    setExpanded(false)
  }, [drafts, meta, isEvaluation, onUpdate])

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/60">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/10">
        <GripVerticalIcon className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
        <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="font-semibold text-sm flex-1 truncate">{exerciseName}</span>
        <span className="text-xs text-muted-foreground shrink-0">{setLabel(item.sets)}</span>
        <button
          onClick={() => { setDrafts(item.sets.map(draftFromSet)); setExpanded((v) => !v) }}
          className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {expanded ? "Cerrar" : "Editar"}
        </button>
        <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer">
          <Trash2Icon className="w-3.5 h-3.5" />
        </button>
      </div>

      {!expanded && item.sets.length > 0 && (
        <div className="divide-y divide-border">
          {item.sets.map((s) => <SetPreviewRow key={s.setNumber} set={s} />)}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border">
          {/* Sets editor */}
          <div className="divide-y divide-border">
            {drafts.map((s, i) => (
              <SetEditorRow
                key={i}
                set={s}
                isEvaluation={isEvaluation}
                onUpdate={(patch) => setDrafts((prev) => prev.map((d, j) => j === i ? { ...d, ...patch } : d))}
                onRemove={() => setDrafts((prev) => prev.filter((_, j) => j !== i).map((d, j) => ({ ...d, setNumber: j + 1 })))}
                canRemove={drafts.length > 1}
              />
            ))}
          </div>

          {/* Meta fields — solo para rutinas de entrenamiento */}
          {!isEvaluation && (
          <div className="px-4 py-3 border-t border-border space-y-3 bg-muted/5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Detalles del ejercicio</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tempo</label>
                <input
                  type="text"
                  placeholder="3-1-2-0"
                  value={meta.tempo}
                  onChange={(e) => setMeta((m) => ({ ...m, tempo: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Descanso (segundos)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="90"
                  value={meta.restSeconds}
                  onChange={(e) => setMeta((m) => ({ ...m, restSeconds: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Objetivo</label>
              <select
                value={meta.goal}
                onChange={(e) => setMeta((m) => ({ ...m, goal: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
              >
                <option value="">Sin objetivo</option>
                <option value="strength">Fuerza</option>
                <option value="hypertrophy">Hipertrofia</option>
                <option value="endurance">Resistencia</option>
                <option value="power">Potencia</option>
                <option value="cardio">Cardio</option>
                <option value="recovery">Recuperación</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Notas</label>
              <textarea
                rows={2}
                placeholder="Instrucciones para el atleta…"
                value={meta.notes}
                onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>
          </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/10">
            <button
              onClick={() => setDrafts((prev) => [...prev, defaultDraft(prev.length + 1)])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Agregar serie
            </button>
            <button
              onClick={handleSave}
              className="text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Block card ───────────────────────────────────────────────────────────────

function BlockCard({
  item, index, exerciseNames, onRemove, onUpdate,
}: {
  item: RoutineItemBlock
  index: number
  exerciseNames: Record<string, string>
  onRemove: () => void
  onUpdate: (patch: Partial<RoutineItemBlock>) => void
}) {
  return (
    <div className="border border-primary/30 rounded-xl overflow-hidden bg-primary/5">
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/10">
        <GripVerticalIcon className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
        <span className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="font-semibold text-sm flex-1 text-primary">
          Circuito ×{item.rounds} rondas {item.name ? `— ${item.name}` : ""}
        </span>
        <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer">
          <Trash2Icon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-border/60">
        {item.exercises.map((ex, i) => (
          <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
            <span className="flex-1 truncate">{exerciseNames[ex.exerciseId] ?? "…"}</span>
            <span className="text-xs text-muted-foreground">{setLabel(ex.sets)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Set preview row ──────────────────────────────────────────────────────────

function SetPreviewRow({ set }: { set: RoutineSet }) {
  const isTime = set.setType === "time"
  const effort = isTime
    ? set.targetDurationSeconds != null ? `${set.targetDurationSeconds}s` : "tiempo libre"
    : set.targetReps != null ? `${set.targetReps} reps` : "reps libre"

  const load = (() => {
    if (set.loadType === "percent_rm" && set.loadValue) return `${set.loadValue}% RM`
    if (set.loadType === "fixed_kg"  && set.loadValue) return `${set.loadValue} lbs`
    if (set.loadType === "rpe"       && set.loadValue) return `RPE ${set.loadValue}`
    return null
  })()

  return (
    <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground">
      <span className="w-14 font-medium text-foreground shrink-0">Serie {set.setNumber}</span>
      <span className="flex items-center gap-1">
        {isTime && <ClockIcon className="w-3 h-3" />}
        {effort}
      </span>
      {load && <span className="text-primary/80">{load}</span>}
    </div>
  )
}

// ─── Set editor row ───────────────────────────────────────────────────────────

function SetEditorRow({
  set, isEvaluation, onUpdate, onRemove, canRemove,
}: {
  set: DraftSet
  isEvaluation: boolean
  onUpdate: (patch: Partial<DraftSet>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const isTime = set.setType === "time"

  if (isEvaluation) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Serie {set.setNumber}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={1}
            value={set.targetReps}
            onChange={(e) => onUpdate({ targetReps: e.target.value, setType: "reps", loadType: "percent_rm" })}
            placeholder="libre"
            className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">reps</span>
        </div>
        <span className="text-xs text-muted-foreground">@</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={1} max={110} step={5}
            value={set.loadValue}
            onChange={(e) => onUpdate({ loadValue: e.target.value, loadType: "percent_rm" })}
            placeholder="—"
            className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">% RM</span>
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
    )
  }

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Serie {set.setNumber}</span>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => onUpdate({ setType: "reps" })}
            className={cn("px-2.5 py-1 transition-colors cursor-pointer", !isTime ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}
          >
            Reps
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ setType: "time" })}
            className={cn("px-2.5 py-1 flex items-center gap-1 transition-colors cursor-pointer", isTime ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}
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

      {isTime ? (
        <div className="flex items-center gap-2 ml-[4.25rem]">
          <input
            type="number" min={1}
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
              type="number" min={1}
              value={set.targetReps}
              onChange={(e) => onUpdate({ targetReps: e.target.value })}
              placeholder="libre"
              className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            <span className="text-xs text-muted-foreground">reps</span>
          </div>
          <select
            value={set.loadType ?? ""}
            onChange={(e) => onUpdate({ loadType: (e.target.value || null) as LoadType, loadValue: "" })}
            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="">Sin carga</option>
            <option value="percent_rm">% RM</option>
            <option value="fixed_kg">Peso fijo (lbs)</option>
            <option value="rpe">RPE</option>
          </select>
          {set.loadType && (
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={1}
                max={set.loadType === "rpe" ? 10 : 999}
                step={set.loadType === "percent_rm" ? 5 : 1}
                value={set.loadValue}
                onChange={(e) => onUpdate({ loadValue: e.target.value })}
                placeholder={set.loadType === "percent_rm" ? "75" : set.loadType === "rpe" ? "8" : "60"}
                className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
              <span className="text-xs text-muted-foreground">
                {set.loadType === "percent_rm" ? "%" : set.loadType === "fixed_kg" ? "lbs" : "RPE"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
