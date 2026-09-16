"use client"

import { AiRoutineGenerator, type AiRoutineResult } from "@/components/ai-routine-generator"
import { ExercisePicker, type PickerExercise } from "@/components/exercise-picker"
import { ShareRoutineButton } from "@/components/share-routine"
import { YouTubePlayer, YouTubeThumb } from "@/components/youtube-player"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import type { RoutineContent, RoutineExerciseContent, RoutineItemBlock, RoutineItemExercise, RoutineSet } from "@atleta/db/schema"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type PointerSensorOptions,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ClockIcon,
  CopyIcon,
  GripVerticalIcon,
  InfoIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react"
import { use, useCallback, useEffect, useRef, useState } from "react"

const DEFAULT_SUGGESTED_REST_SECONDS = 60

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

type ExerciseInfo = { name: string; youtubeVideoId: string | null; videoOrientation: "horizontal" | "vertical" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultDraft(setNumber: number, from?: DraftSet): DraftSet {
  return from
    ? { ...from, setNumber }
    : { setNumber, setType: "reps", targetReps: "", targetDurationSeconds: "", loadType: null, loadValue: "" }
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

function setsSummary(sets: RoutineSet[]): string {
  const n = sets.length
  if (n === 0) return "Sin series"
  const first = sets[0]
  const effort = (s: RoutineSet) =>
    s.setType === "time" ? (s.targetDurationSeconds ? `${s.targetDurationSeconds}s` : "tiempo libre") : (s.targetReps ? `${s.targetReps}` : "libre")
  const allSame = sets.every((s) => effort(s) === effort(first) && s.setType === first.setType)
  if (!allSame) return `${n} serie${n !== 1 ? "s" : ""}`
  return first.setType === "time" ? `${n} × ${effort(first)}` : `${n} × ${effort(first)} reps`
}

const uuid = () => crypto.randomUUID()
const renumber = <T extends { order: number }>(items: T[]) => items.map((it, i) => ({ ...it, order: i }))
const reps = (count: number, value: number): RoutineSet[] =>
  Array.from({ length: count }, (_, i) => ({ setNumber: i + 1, setType: "reps", targetReps: value }))

function cloneExercise<T extends RoutineExerciseContent>(ex: T): T {
  return { ...ex, id: uuid(), sets: ex.sets.map((s) => ({ ...s })) }
}

// ─── Arrastrar y soltar (reordenar manteniendo presionado) ────────────────────

const ROOT_CONTAINER_ID = "root-container"
const blockDropId = (blockId: string) => `block-drop-${blockId}`

/**
 * Deja que el arrastre se active manteniendo presionado cualquier punto de la tarjeta,
 * incluyendo sus botones: un toque corto sigue disparando su click normal (el arrastre
 * solo se activa tras el `delay` de la sensor), y uno largo lo convierte en drag. Solo
 * los campos de texto (input/textarea/select) quedan excluidos, porque ahí mantener
 * presionado sirve para ubicar el cursor o seleccionar texto, no para arrastrar.
 */
class DragHandlePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0) return false
        let el = event.target as HTMLElement | null
        while (el) {
          if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return false
          el = el.parentElement
        }
        onActivation?.({ event })
        return true
      },
    },
  ]
}

type ItemLoc = { where: "root"; index: number } | { where: "block"; blockId: string; index: number }

function locateItem(items: Array<RoutineItemExercise | RoutineItemBlock>, id: string): ItemLoc | null {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const rootIdx = sorted.findIndex((i) => i.id === id)
  if (rootIdx !== -1) return { where: "root", index: rootIdx }
  for (const it of sorted) {
    if (it.type === "block") {
      const exs = [...it.exercises].sort((a, b) => a.order - b.order)
      const exIdx = exs.findIndex((e) => e.id === id)
      if (exIdx !== -1) return { where: "block", blockId: it.id, index: exIdx }
    }
  }
  return null
}

/**
 * Mueve el ejercicio o circuito arrastrado a su nueva posición. Un ejercicio puede
 * moverse entre la raíz y cualquier circuito (o entre circuitos); un circuito solo
 * puede reordenarse dentro de la raíz, nunca anidarse dentro de otro.
 */
function moveDraggedItem(content: RoutineContent, activeId: string, overId: string): RoutineContent {
  if (activeId === overId) return content
  const items = [...content.items].sort((a, b) => a.order - b.order)
  const activeLoc = locateItem(items, activeId)
  if (!activeLoc) return content

  const rootItems = [...items]
  const blockExercises = new Map<string, RoutineExerciseContent[]>(
    rootItems
      .filter((i): i is RoutineItemBlock => i.type === "block")
      .map((b) => [b.id, [...b.exercises].sort((a, b2) => a.order - b2.order)]),
  )

  if (activeLoc.where === "root" && rootItems[activeLoc.index].type === "block") {
    const toIdx = rootItems.findIndex((i) => i.id === overId)
    if (toIdx === -1) return content // no se puede soltar un circuito dentro de otro circuito
    return { ...content, items: renumber(arrayMove(rootItems, activeLoc.index, toIdx)) }
  }

  // Reordenar un ejercicio dentro de su mismo contenedor (raíz o mismo circuito): un simple
  // arrayMove sobre los índices originales. Insertarlo "a mano" tras quitarlo desplazaría el
  // índice de destino y dejaría el orden sin cambios cuando se suelta justo después de su vecino.
  if (activeLoc.where === "root") {
    const toIdx = rootItems.findIndex((i) => i.id === overId)
    if (toIdx !== -1) return { ...content, items: renumber(arrayMove(rootItems, activeLoc.index, toIdx)) }
  } else {
    const exs = blockExercises.get(activeLoc.blockId)
    const toIdx = exs?.findIndex((e) => e.id === overId) ?? -1
    if (exs && toIdx !== -1) {
      blockExercises.set(activeLoc.blockId, arrayMove(exs, activeLoc.index, toIdx))
      const newItems = rootItems.map((i) => (i.type === "block" ? { ...i, exercises: renumber(blockExercises.get(i.id) ?? i.exercises) } : i))
      return { ...content, items: renumber(newItems) }
    }
  }

  let activeExercise: RoutineExerciseContent | null = null
  if (activeLoc.where === "root") {
    const removed = rootItems.splice(activeLoc.index, 1)[0]
    if (removed.type !== "exercise") return content
    const { type: _type, ...bare } = removed
    activeExercise = bare
  } else {
    const exs = blockExercises.get(activeLoc.blockId)
    if (!exs) return content
    const [removed] = exs.splice(activeLoc.index, 1)
    activeExercise = removed
  }
  if (!activeExercise) return content

  if (overId === ROOT_CONTAINER_ID) {
    rootItems.push({ type: "exercise", ...activeExercise })
  } else if (overId.startsWith("block-drop-")) {
    const exs = blockExercises.get(overId.slice("block-drop-".length))
    if (!exs) return content
    exs.push(activeExercise)
  } else {
    const overRootIdx = rootItems.findIndex((i) => i.id === overId)
    if (overRootIdx !== -1) {
      rootItems.splice(overRootIdx, 0, { type: "exercise", ...activeExercise })
    } else {
      let placed = false
      for (const exs of blockExercises.values()) {
        const idx = exs.findIndex((e) => e.id === overId)
        if (idx !== -1) {
          exs.splice(idx, 0, activeExercise)
          placed = true
          break
        }
      }
      if (!placed) return content
    }
  }

  const newItems = rootItems.map((i) => (i.type === "block" ? { ...i, exercises: renumber(blockExercises.get(i.id) ?? i.exercises) } : i))
  return { ...content, items: renumber(newItems) }
}

/** Autocompleta el descanso del último ejercicio de una lista de ejercicios (plana o dentro de un circuito) cuando aún no tiene uno, para que separe del que se está por agregar. */
function applyAutoRestOnLastExercise(exercises: RoutineExerciseContent[], suggestedSeconds: number): RoutineExerciseContent[] {
  if (exercises.length === 0) return exercises
  const sorted = [...exercises].sort((a, b) => a.order - b.order)
  const last = sorted[sorted.length - 1]
  if (last.restSeconds != null) return exercises
  return exercises.map((e) => (e.id === last.id ? { ...e, restSeconds: suggestedSeconds } : e))
}

/** Igual que arriba, pero para la lista de items de nivel superior (ejercicios sueltos o circuitos). */
function applyAutoRestOnLastItem(items: Array<RoutineItemExercise | RoutineItemBlock>, suggestedSeconds: number): Array<RoutineItemExercise | RoutineItemBlock> {
  if (items.length === 0) return items
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const last = sorted[sorted.length - 1]
  if (last.type === "exercise") {
    if (last.restSeconds != null) return items
    return items.map((i) => (i.id === last.id ? { ...i, restSeconds: suggestedSeconds } : i))
  }
  const updatedExercises = applyAutoRestOnLastExercise(last.exercises, suggestedSeconds)
  if (updatedExercises === last.exercises) return items
  return items.map((i) => (i.id === last.id ? { ...i, exercises: updatedExercises } : i))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinePage({ params }: { params: Promise<{ teamId: string; routineId: string }> }) {
  const { teamId, routineId } = use(params)

  const { data: routineData, refetch } = trpc.routines.get.useQuery({ id: routineId })
  const { data: catalog }              = trpc.exercises.list.useQuery({ teamId })
  const updateContent                  = trpc.routines.updateContent.useMutation({ onSuccess: () => refetch() })
  const renameRoutine                  = trpc.routines.rename.useMutation({ onSuccess: () => refetch() })
  const { data: aiAvailable }          = trpc.routines.aiAvailable.useQuery({ teamId })
  const { data: teams }                = trpc.teams.list.useQuery()
  const isCoach                        = teams?.find((t) => t.team.id === teamId)?.role === "coach"
  const utils                          = trpc.useUtils()

  const [aiOpen, setAiOpen]     = useState(false)
  const [aiResult, setAiResult] = useState<Omit<AiRoutineResult, "content"> | null>(null)

  function applyAiResult(result: AiRoutineResult) {
    setLocalContent(result.content)
    setDirty(true)
    setAiResult({ summary: result.summary, createdExercises: result.createdExercises })
    setAiOpen(false)
    if (result.createdExercises.length > 0) utils.exercises.list.invalidate({ teamId })
  }

  const [localContent, setLocalContent] = useState<RoutineContent | null>(null)
  const [dirty, setDirty]               = useState(false)
  const [name, setName]                 = useState("")
  const [preview, setPreview]           = useState<ExerciseInfo | null>(null)
  // Último valor de descanso usado por el entrenador: sugiere ese mismo valor para el próximo descanso que se autocomplete.
  const [suggestedRest, setSuggestedRest] = useState(DEFAULT_SUGGESTED_REST_SECONDS)

  useEffect(() => { if (routineData) setName(routineData.name) }, [routineData])

  const content: RoutineContent = localContent ?? routineData?.content ?? { v: 1, items: [] }

  // Catálogo local como fuente primaria; fallback al mapa del servidor (ejercicios ya no visibles)
  const info: Record<string, ExerciseInfo> = {
    ...Object.fromEntries(Object.entries(routineData?.exerciseInfo ?? {}).map(([id, e]) => [id, { name: e.name, youtubeVideoId: e.youtubeVideoId, videoOrientation: e.videoOrientation }])),
    ...Object.fromEntries((catalog ?? []).map((e) => [e.id, { name: e.name, youtubeVideoId: e.youtubeVideoId, videoOrientation: e.videoOrientation }])),
  }
  const infoFor = (id: string): ExerciseInfo => info[id] ?? { name: "…", youtubeVideoId: null, videoOrientation: "horizontal" }

  function mutate(fn: (c: RoutineContent) => RoutineContent) {
    setLocalContent((prev) => fn(prev ?? routineData?.content ?? { v: 1, items: [] }))
    setDirty(true)
  }

  const emptyBlocks = content.items.filter((i) => i.type === "block" && i.exercises.length === 0).length

  function handleSave() {
    if (emptyBlocks > 0) return
    updateContent.mutate({ id: routineId, content }, {
      onSuccess: () => { setLocalContent(null); setDirty(false) },
    })
  }

  const isEvaluation = routineData?.category === "evaluation"
  const sorted = [...content.items].sort((a, b) => a.order - b.order)

  function addExercise(exerciseId: string) {
    const newEx: RoutineItemExercise = {
      type: "exercise",
      id: uuid(),
      exerciseId,
      order: sorted.length,
      sets: isEvaluation
        ? [
            { setNumber: 1, setType: "reps", targetReps: 5, loadType: "percent_rm", loadValue: 80 },
            { setNumber: 2, setType: "reps", targetReps: 3, loadType: "percent_rm", loadValue: 90 },
            { setNumber: 3, setType: "reps",               loadType: "percent_rm", loadValue: 100 },
          ]
        : reps(3, 10),
    }
    mutate((c) => {
      const existing = applyAutoRestOnLastItem([...c.items].sort((a, b) => a.order - b.order), suggestedRest)
      return { ...c, items: renumber([...existing, newEx]) }
    })
  }

  function addBlock() {
    const block: RoutineItemBlock = { type: "block", id: uuid(), order: sorted.length, name: "Circuito", rounds: 3, exercises: [] }
    mutate((c) => {
      const existing = applyAutoRestOnLastItem([...c.items].sort((a, b) => a.order - b.order), suggestedRest)
      return { ...c, items: renumber([...existing, block]) }
    })
  }

  function moveItem(id: string, dir: -1 | 1) {
    mutate((c) => {
      const items = [...c.items].sort((a, b) => a.order - b.order)
      const idx = items.findIndex((i) => i.id === id)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= items.length) return c
      ;[items[idx], items[target]] = [items[target], items[idx]]
      return { ...c, items: renumber(items) }
    })
  }

  // Arrastrar y soltar: mantener presionado un ejercicio o circuito lo activa como
  // arrastrable, para reordenarlo o meterlo/sacarlo de un circuito con el dedo.
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const dndSensors = useSensors(useSensor(DragHandlePointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }
  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return
    mutate((c) => moveDraggedItem(c, activeId, overId))
  }
  function handleDragCancel() {
    setActiveDragId(null)
  }

  function duplicateItem(id: string) {
    mutate((c) => {
      const items = [...c.items].sort((a, b) => a.order - b.order)
      const idx = items.findIndex((i) => i.id === id)
      if (idx < 0) return c
      const original = items[idx]
      const copy = original.type === "exercise"
        ? cloneExercise(original)
        : { ...original, id: uuid(), exercises: original.exercises.map(cloneExercise) }
      items.splice(idx + 1, 0, copy)
      return { ...c, items: renumber(items) }
    })
  }

  function removeItem(id: string) {
    mutate((c) => ({ ...c, items: renumber([...c.items].sort((a, b) => a.order - b.order).filter((i) => i.id !== id)) }))
  }

  function updateItem(id: string, patch: Partial<RoutineItemExercise> | Partial<RoutineItemBlock>) {
    mutate((c) => ({
      ...c,
      items: c.items.map((i) => (i.id === id ? { ...i, ...patch } as typeof i : i)),
    }))
  }

  const usedIds = new Set(content.items.flatMap((i) =>
    i.type === "exercise" ? [i.exerciseId] : i.exercises.map((e) => e.exerciseId),
  ))
  const available: PickerExercise[] = isEvaluation
    ? (catalog ?? []).filter((e) => !usedIds.has(e.id))
    : (catalog ?? [])

  if (!routineData) return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="h-7 w-48 bg-muted/40 rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-32">
      {/* Header */}
      <div>
        <Link
          href={`/teams/${teamId}/plantillas`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Plantillas
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (!trimmed) { setName(routineData.name); return }
            if (trimmed.toLowerCase() !== routineData.name) renameRoutine.mutate({ id: routineId, name: trimmed.toLowerCase() })
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
          className="text-2xl font-bold tracking-wider uppercase bg-transparent outline-none border-b border-transparent hover:border-muted-foreground/30 focus:border-primary/60 transition-colors w-full min-h-[44px] cursor-text"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
          aria-label="Nombre de la plantilla"
        />
        <div className="flex items-center justify-between gap-3 mt-1">
          <p className="text-xs text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "bloque" : "bloques"} · toca <strong>Editar</strong> para cambiar series, descanso y notas
          </p>
          {isCoach && !isEvaluation && content.items.length > 0 && (
            <ShareRoutineButton routineId={routineId} routineName={routineData.name} />
          )}
        </div>
      </div>

      {/* IA (experimental, solo equipos habilitados) */}
      {aiAvailable && !isEvaluation && (aiOpen ? (
        <AiRoutineGenerator
          teamId={teamId}
          replacesContent={content.items.length > 0}
          onGenerated={applyAiResult}
          onClose={() => setAiOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/40 bg-primary/5 text-sm text-primary font-medium hover:bg-primary/10 cursor-pointer transition-colors"
        >
          <SparklesIcon className="w-4 h-4" /> Generar con IA
        </button>
      ))}

      {aiResult && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <SparklesIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs flex-1 leading-relaxed">{aiResult.summary}</p>
            <button type="button" onClick={() => setAiResult(null)} className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Cerrar resumen">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {aiResult.createdExercises.length > 0 && (
            <p className="text-[11px] text-muted-foreground pl-6">
              Ejercicios nuevos añadidos al catálogo del equipo, sin video: {aiResult.createdExercises.map((e) => e.name).join(", ")}. Revísalos en Mis ejercicios.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground pl-6">Es una propuesta: ajústala y pulsa <strong>Guardar cambios</strong> para conservarla.</p>
        </div>
      )}

      {/* Items */}
      <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <RootDropZone>
          <SortableContext items={sorted.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {sorted.map((item, idx) => {
              const moveProps = {
                onMoveUp: idx > 0 ? () => moveItem(item.id, -1) : undefined,
                onMoveDown: idx < sorted.length - 1 ? () => moveItem(item.id, 1) : undefined,
                onDuplicate: isEvaluation ? undefined : () => duplicateItem(item.id),
                onRemove: () => removeItem(item.id),
              }
              return (
                <SortableItem key={item.id} id={item.id}>
                  {item.type === "exercise" ? (
                    <div>
                      <ExerciseCard
                        item={item}
                        label={String(idx + 1)}
                        isEvaluation={isEvaluation}
                        info={infoFor(item.exerciseId)}
                        onPreview={setPreview}
                        onUpdate={(patch) => updateItem(item.id, patch)}
                        {...moveProps}
                      />
                      {!isEvaluation && (
                        <RestRow
                          seconds={item.restSeconds}
                          onAdd={() => updateItem(item.id, { restSeconds: suggestedRest })}
                          onChange={(n) => { updateItem(item.id, { restSeconds: n }); setSuggestedRest(n) }}
                          onClear={() => updateItem(item.id, { restSeconds: undefined })}
                        />
                      )}
                    </div>
                  ) : (
                    <BlockCard
                      item={item}
                      label={String(idx + 1)}
                      infoFor={infoFor}
                      catalog={catalog ?? []}
                      onPreview={setPreview}
                      onUpdate={(patch) => updateItem(item.id, patch)}
                      suggestedRest={suggestedRest}
                      onSuggestedRestChange={setSuggestedRest}
                      {...moveProps}
                    />
                  )}
                </SortableItem>
              )
            })}
          </SortableContext>

          {content.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl gap-2 text-center px-6">
              <p className="text-sm font-medium">Esta plantilla está vacía</p>
              <p className="text-xs text-muted-foreground">Agrega ejercicios desde el catálogo. Cada uno trae su video de YouTube.</p>
            </div>
          )}
        </RootDropZone>

        <DragOverlay>
          {activeDragId ? <DragPreview id={activeDragId} content={content} infoFor={infoFor} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Add */}
      <div className="space-y-2">
        {available.length > 0 && (
          <AddExerciseRow exercises={available} onAdd={addExercise} placeholder="Agregar ejercicio…" />
        )}
        {!isEvaluation && (
          <button
            type="button"
            onClick={addBlock}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-primary/40 text-sm text-primary hover:bg-primary/5 cursor-pointer transition-colors"
          >
            <RepeatIcon className="w-4 h-4" /> Agregar circuito (varios ejercicios con vueltas)
          </button>
        )}
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <p className="flex-1 text-xs text-muted-foreground">
              {emptyBlocks > 0
                ? <span className="text-destructive">Hay {emptyBlocks === 1 ? "un circuito vacío" : `${emptyBlocks} circuitos vacíos`}: agrega ejercicios o elimínalos.</span>
                : "Tienes cambios sin guardar"}
            </p>
            <button
              onClick={() => { setLocalContent(null); setDirty(false); setAiResult(null) }}
              className="text-sm px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={updateContent.isPending || emptyBlocks > 0}
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {updateContent.isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {preview?.youtubeVideoId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white">
              <p className="font-semibold truncate">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Cerrar">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <YouTubePlayer videoId={preview.youtubeVideoId} title={preview.name} orientation={preview.videoOrientation} autoStart />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add exercise row ─────────────────────────────────────────────────────────

function AddExerciseRow({ exercises, onAdd, placeholder }: { exercises: PickerExercise[]; onAdd: (id: string) => void; placeholder: string }) {
  const [value, setValue] = useState("")
  return (
    <ExercisePicker
      exercises={exercises}
      value={value}
      onChange={(id) => { onAdd(id); setValue("") }}
      placeholder={placeholder}
    />
  )
}

// ─── Drag and drop ─────────────────────────────────────────────────────────────

/** Envuelve un ejercicio o circuito para que, al mantenerlo presionado, se pueda arrastrar. */
function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  // Sin `attributes` (role/tabIndex de accesibilidad): no hay sensor de teclado, y aplicarlos
  // volvería focalizable con Tab el contenedor entero, que ya tiene botones e inputs reales dentro.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      data-sortable-id={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-30")}
      {...listeners}
    >
      {children}
    </div>
  )
}

/** Zona soltable de la lista raíz: permite soltar un ejercicio fuera de un circuito, incluso si la lista está vacía. */
function RootDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: ROOT_CONTAINER_ID })
  return (
    <div ref={setNodeRef} data-root-dropzone className="space-y-3">
      {children}
    </div>
  )
}

function DragPreview({ id, content, infoFor }: { id: string; content: RoutineContent; infoFor: (id: string) => ExerciseInfo }) {
  const items = [...content.items].sort((a, b) => a.order - b.order)
  const rootItem = items.find((i) => i.id === id)
  if (rootItem) {
    return rootItem.type === "exercise"
      ? <DragPreviewCard label={infoFor(rootItem.exerciseId).name} />
      : <DragPreviewCard label={rootItem.name || "Circuito"} icon />
  }
  for (const it of items) {
    if (it.type === "block") {
      const ex = it.exercises.find((e) => e.id === id)
      if (ex) return <DragPreviewCard label={infoFor(ex.exerciseId).name} />
    }
  }
  return null
}

function DragPreviewCard({ label, icon }: { label: string; icon?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-primary bg-card shadow-xl text-sm font-semibold cursor-grabbing">
      {icon && <RepeatIcon className="w-4 h-4 text-primary shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
  )
}

// ─── Item toolbar (mover / duplicar / eliminar) ───────────────────────────────

function ItemActions({ onMoveUp, onMoveDown, onDuplicate, onRemove }: {
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDuplicate?: () => void
  onRemove: () => void
}) {
  const btn = "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
  return (
    <div className="flex items-center shrink-0">
      <GripVerticalIcon className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mr-0.5" aria-hidden />
      <button type="button" onClick={onMoveUp} disabled={!onMoveUp} className={btn} aria-label="Subir"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={onMoveDown} disabled={!onMoveDown} className={btn} aria-label="Bajar"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} className={btn} aria-label="Duplicar"><CopyIcon className="w-3.5 h-3.5" /></button>
      )}
      <button type="button" onClick={onRemove} className={cn(btn, "hover:text-destructive")} aria-label="Eliminar"><Trash2Icon className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ─── Descanso entre ejercicios ────────────────────────────────────────────────
// Fila compacta (no es un ítem numerado) que representa el descanso que el atleta
// hará después de este ejercicio y antes del siguiente. Vive sobre el campo
// `restSeconds` del propio ejercicio.

function RestRow({ seconds, label = "Descanso", onAdd, onChange, onClear }: {
  seconds?: number
  label?: string
  onAdd: () => void
  onChange: (seconds: number) => void
  onClear: () => void
}) {
  if (seconds == null) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 ml-9 pl-1 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors cursor-pointer"
      >
        <PlusIcon className="w-3 h-3" /> Agregar descanso
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1.5 ml-9 px-2 py-1 text-[11px] text-muted-foreground">
      <PauseIcon className="w-3 h-3 shrink-0" />
      <span className="shrink-0">{label}</span>
      <input
        type="number"
        min={0}
        value={seconds}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-14 bg-background border border-border rounded-md px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Segundos de descanso"
      />
      <span className="shrink-0">seg</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 p-0.5 text-muted-foreground/60 hover:text-destructive transition-colors cursor-pointer"
        aria-label="Quitar descanso"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  item, label, isEvaluation, info, onUpdate, onPreview, onMoveUp, onMoveDown, onDuplicate, onRemove, nested = false,
}: {
  item: RoutineExerciseContent
  label: string
  isEvaluation: boolean
  info: ExerciseInfo
  onUpdate: (patch: Partial<RoutineExerciseContent>) => void
  onPreview: (info: ExerciseInfo) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDuplicate?: () => void
  onRemove: () => void
  nested?: boolean
}) {
  const [expanded, setExpanded]   = useState(false)
  const [drafts, setDrafts]       = useState<DraftSet[]>(() => item.sets.map(draftFromSet))
  const [meta, setMeta]           = useState({ tempo: item.tempo ?? "", goal: item.goal ?? "", notes: item.notes ?? "" })
  const [quick, setQuick]         = useState({ count: String(item.sets.length || 3), value: "" })
  const [tempoInfo, setTempoInfo] = useState(false)
  const tempoRef                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tempoInfo) return
    function handleClick(e: Event) {
      if (tempoRef.current && !tempoRef.current.contains(e.target as Node)) setTempoInfo(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("touchstart", handleClick)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("touchstart", handleClick)
    }
  }, [tempoInfo])

  function openEditor() {
    setDrafts(item.sets.map(draftFromSet))
    setMeta({ tempo: item.tempo ?? "", goal: item.goal ?? "", notes: item.notes ?? "" })
    setExpanded((v) => !v)
  }

  function applyQuick() {
    const count = Math.max(1, Math.min(20, Number(quick.count) || 1))
    const base = drafts[0] ?? defaultDraft(1)
    const value = quick.value.trim()
    setDrafts(Array.from({ length: count }, (_, i) => ({
      ...base,
      setNumber: i + 1,
      ...(value !== "" ? (base.setType === "time" ? { targetDurationSeconds: value } : { targetReps: value }) : {}),
    })))
  }

  const handleSave = useCallback(() => {
    onUpdate({
      sets: drafts.map(draftToSet),
      ...(isEvaluation ? {} : {
        tempo: meta.tempo || undefined,
        goal:  (meta.goal as RoutineExerciseContent["goal"]) || undefined,
        notes: meta.notes || undefined,
      }),
    })
    setExpanded(false)
  }, [drafts, meta, isEvaluation, onUpdate])

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"

  return (
    <div className={cn("border border-border rounded-xl overflow-hidden", nested ? "bg-background" : "bg-card/60")}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-muted/10">
        <span className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {label}
        </span>
        {info.youtubeVideoId ? (
          <button type="button" onClick={() => onPreview(info)} className="shrink-0 rounded-md overflow-hidden cursor-pointer" aria-label={`Ver video de ${info.name}`}>
            <YouTubeThumb videoId={info.youtubeVideoId} alt={info.name} showPlay className="w-20 aspect-video" />
          </button>
        ) : null}
        <button type="button" onClick={openEditor} className="flex-1 min-w-[140px] text-left cursor-pointer">
          <p className="font-semibold text-sm truncate">{info.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {setsSummary(item.sets)}
            {item.restSeconds ? ` · descanso ${item.restSeconds}s` : ""}
            {item.notes ? " · con notas" : ""}
          </p>
        </button>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            onClick={openEditor}
            className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {expanded ? "Cerrar" : "Editar"}
          </button>
          <ItemActions onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDuplicate={onDuplicate} onRemove={onRemove} />
        </div>
      </div>

      {!expanded && item.sets.length > 0 && item.sets.length <= 6 && (
        <div className="divide-y divide-border">
          {item.sets.map((s) => <SetPreviewRow key={s.setNumber} set={s} />)}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border">
          {/* Series rápidas */}
          {!isEvaluation && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-primary/5 border-b border-border">
              <span className="text-xs font-medium">Rápido:</span>
              <input
                type="number" min={1} max={20}
                value={quick.count}
                onChange={(e) => setQuick((q) => ({ ...q, count: e.target.value }))}
                className="w-14 bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
                aria-label="Número de series"
              />
              <span className="text-xs text-muted-foreground">series de</span>
              <input
                type="number" min={1}
                value={quick.value}
                onChange={(e) => setQuick((q) => ({ ...q, value: e.target.value }))}
                placeholder={drafts[0]?.setType === "time" ? "30" : "10"}
                className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
                aria-label="Repeticiones o segundos por serie"
              />
              <span className="text-xs text-muted-foreground">{drafts[0]?.setType === "time" ? "segundos" : "reps"}</span>
              <button
                type="button"
                onClick={applyQuick}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer"
              >
                Aplicar a todas
              </button>
            </div>
          )}

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

          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={() => setDrafts((prev) => [...prev, defaultDraft(prev.length + 1, prev[prev.length - 1])])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Agregar serie (copia la anterior)
            </button>
          </div>

          {!isEvaluation && (
            <div className="px-4 py-3 border-t border-border space-y-3 bg-muted/5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Detalles para el atleta</p>
              <div className="space-y-1 max-w-[calc(50%-0.375rem)]">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground">Ritmo (tempo)</label>
                  <div ref={tempoRef} className="relative group">
                    <button
                      type="button"
                      onClick={() => setTempoInfo((v) => !v)}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
                    >
                      <InfoIcon className="w-3 h-3" />
                    </button>
                    <div className={cn(
                      "absolute left-0 top-5 z-50 w-48 transition-opacity duration-150",
                      "pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto",
                      tempoInfo && "opacity-100 pointer-events-auto",
                    )}>
                      <div className="text-[11px] text-muted-foreground bg-card border border-border rounded-lg px-2.5 py-2 leading-relaxed shadow-lg">
                        <p className="font-semibold text-foreground mb-1">Ejemplo: 3-1-2-0</p>
                        <p>El atleta verá: “Baja en 3 s, pausa 1 s, sube en 2 s, pausa 0 s”.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <input type="text" placeholder="3-1-2-0" value={meta.tempo} onChange={(e) => setMeta((m) => ({ ...m, tempo: e.target.value }))} className={inputCls} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                El descanso se edita en la fila “Descanso” debajo de este ejercicio, no aquí.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Objetivo</label>
                <select value={meta.goal} onChange={(e) => setMeta((m) => ({ ...m, goal: e.target.value }))} className={cn(inputCls, "cursor-pointer")}>
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
                <label className="text-xs text-muted-foreground">Indicaciones (el atleta las verá destacadas)</label>
                <textarea
                  rows={2}
                  placeholder="Ej.: apóyate en la pared si pierdes el equilibrio"
                  value={meta.notes}
                  onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))}
                  className={cn(inputCls, "py-2 resize-none")}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-muted/10">
            <button onClick={() => setExpanded(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border cursor-pointer">
              Cancelar
            </button>
            <button onClick={handleSave} className="text-xs bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors">
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Block (circuito) card ────────────────────────────────────────────────────

function BlockCard({
  item, label, infoFor, catalog, onUpdate, onPreview, onMoveUp, onMoveDown, onDuplicate, onRemove,
  suggestedRest, onSuggestedRestChange,
}: {
  item: RoutineItemBlock
  label: string
  infoFor: (id: string) => ExerciseInfo
  catalog: PickerExercise[]
  onUpdate: (patch: Partial<RoutineItemBlock>) => void
  onPreview: (info: ExerciseInfo) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDuplicate?: () => void
  onRemove: () => void
  suggestedRest: number
  onSuggestedRestChange: (seconds: number) => void
}) {
  const exercises = [...item.exercises].sort((a, b) => a.order - b.order)
  const setExercises = (list: RoutineExerciseContent[]) => onUpdate({ exercises: renumber(list) })
  const { setNodeRef: setBlockDropRef } = useDroppable({ id: blockDropId(item.id) })

  function move(idx: number, dir: -1 | 1) {
    const list = [...exercises]
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    ;[list[idx], list[target]] = [list[target], list[idx]]
    setExercises(list)
  }

  return (
    <div className="border-2 border-primary/30 rounded-xl overflow-hidden bg-primary/5">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-primary/10">
        <span className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {label}
        </span>
        <RepeatIcon className="w-4 h-4 text-primary shrink-0" />
        <input
          value={item.name ?? ""}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nombre del circuito"
          className="flex-1 min-w-[120px] bg-transparent text-sm font-semibold text-primary outline-none border-b border-transparent focus:border-primary/50"
          aria-label="Nombre del circuito"
        />
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => onUpdate({ rounds: Math.max(2, item.rounds - 1) })}
            className="w-7 h-7 rounded-lg border border-primary/30 flex items-center justify-center cursor-pointer disabled:opacity-30"
            disabled={item.rounds <= 2}
            aria-label="Menos vueltas"
          >
            <MinusIcon className="w-3 h-3" />
          </button>
          <span className="w-16 text-center font-medium">{item.rounds} vueltas</span>
          <button
            type="button"
            onClick={() => onUpdate({ rounds: Math.min(20, item.rounds + 1) })}
            className="w-7 h-7 rounded-lg border border-primary/30 flex items-center justify-center cursor-pointer"
            aria-label="Más vueltas"
          >
            <PlusIcon className="w-3 h-3" />
          </button>
        </div>
        <ItemActions onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDuplicate={onDuplicate} onRemove={onRemove} />
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-primary/15 text-xs">
        <PauseIcon className="w-3.5 h-3.5 text-primary shrink-0" />
        <label htmlFor={`rest-rounds-${item.id}`} className="text-muted-foreground shrink-0">Descanso entre rondas</label>
        <input
          id={`rest-rounds-${item.id}`}
          type="number"
          min={0}
          placeholder="60"
          value={item.restBetweenRoundsSeconds ?? ""}
          onChange={(e) => onUpdate({ restBetweenRoundsSeconds: e.target.value ? Number(e.target.value) : undefined })}
          className="w-16 bg-background border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Descanso entre rondas del circuito, en segundos"
        />
        <span className="text-muted-foreground shrink-0">seg</span>
      </div>

      <div ref={setBlockDropRef} data-block-dropzone={item.id} className="p-3 space-y-2">
        {exercises.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Agrega al menos un ejercicio a este circuito, o arrastra uno aquí.</p>
        )}
        <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          {exercises.map((ex, i) => (
            <SortableItem key={ex.id} id={ex.id}>
              <div>
                <ExerciseCard
                  nested
                  item={ex}
                  label={`${label}.${i + 1}`}
                  isEvaluation={false}
                  info={infoFor(ex.exerciseId)}
                  onPreview={onPreview}
                  onUpdate={(patch) => setExercises(exercises.map((e) => (e.id === ex.id ? { ...e, ...patch } : e)))}
                  onMoveUp={i > 0 ? () => move(i, -1) : undefined}
                  onMoveDown={i < exercises.length - 1 ? () => move(i, 1) : undefined}
                  onRemove={() => setExercises(exercises.filter((e) => e.id !== ex.id))}
                />
                <RestRow
                  seconds={ex.restSeconds}
                  label={i === exercises.length - 1 ? "Descanso al terminar el circuito" : "Descanso"}
                  onAdd={() => setExercises(exercises.map((e) => (e.id === ex.id ? { ...e, restSeconds: suggestedRest } : e)))}
                  onChange={(n) => {
                    setExercises(exercises.map((e) => (e.id === ex.id ? { ...e, restSeconds: n } : e)))
                    onSuggestedRestChange(n)
                  }}
                  onClear={() => setExercises(exercises.map((e) => (e.id === ex.id ? { ...e, restSeconds: undefined } : e)))}
                />
              </div>
            </SortableItem>
          ))}
        </SortableContext>
        <AddExerciseRow
          exercises={catalog}
          placeholder="Agregar ejercicio al circuito…"
          onAdd={(exerciseId) => {
            const withRest = applyAutoRestOnLastExercise(exercises, suggestedRest)
            setExercises([...withRest, { id: uuid(), exerciseId, order: withRest.length, sets: reps(1, 10) }])
          }}
        />
        {exercises.length > 0 && (
          <p className="text-[11px] text-muted-foreground px-1 flex items-center gap-1">
            <PlayIcon className="w-3 h-3" />
            El circuito completo (todos los ejercicios en orden) se repite {item.rounds} veces.
          </p>
        )}
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
    <div className="flex items-center gap-4 px-4 py-1.5 text-xs text-muted-foreground">
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
  const numCls = "w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"

  if (isEvaluation) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Serie {set.setNumber}</span>
        <div className="flex items-center gap-1.5">
          <input type="number" min={1} value={set.targetReps} onChange={(e) => onUpdate({ targetReps: e.target.value, setType: "reps", loadType: "percent_rm" })} placeholder="libre" className={numCls} />
          <span className="text-xs text-muted-foreground">reps</span>
        </div>
        <span className="text-xs text-muted-foreground">@</span>
        <div className="flex items-center gap-1.5">
          <input type="number" min={1} max={110} step={5} value={set.loadValue} onChange={(e) => onUpdate({ loadValue: e.target.value, loadType: "percent_rm" })} placeholder="—" className={numCls} />
          <span className="text-xs text-muted-foreground">% RM</span>
        </div>
        <button type="button" onClick={onRemove} disabled={!canRemove} className="ml-auto p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors cursor-pointer">
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
          <button type="button" onClick={() => onUpdate({ setType: "reps" })} className={cn("px-2.5 py-1 transition-colors cursor-pointer", !isTime ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}>
            Reps
          </button>
          <button type="button" onClick={() => onUpdate({ setType: "time" })} className={cn("px-2.5 py-1 flex items-center gap-1 transition-colors cursor-pointer", isTime ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}>
            <ClockIcon className="w-3 h-3" />
            Tiempo
          </button>
        </div>
        <button type="button" onClick={onRemove} disabled={!canRemove} className="ml-auto p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors cursor-pointer">
          <Trash2Icon className="w-3.5 h-3.5" />
        </button>
      </div>

      {isTime ? (
        <div className="flex items-center gap-2 ml-[4.25rem]">
          <input type="number" min={1} value={set.targetDurationSeconds} onChange={(e) => onUpdate({ targetDurationSeconds: e.target.value })} placeholder="60" className={cn(numCls, "w-20")} />
          <span className="text-xs text-muted-foreground">segundos</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 ml-[4.25rem] flex-wrap">
          <div className="flex items-center gap-1.5">
            <input type="number" min={1} value={set.targetReps} onChange={(e) => onUpdate({ targetReps: e.target.value })} placeholder="libre" className={numCls} />
            <span className="text-xs text-muted-foreground">reps</span>
          </div>
          <select
            value={set.loadType ?? ""}
            onChange={(e) => onUpdate({ loadType: (e.target.value || null) as LoadType, loadValue: "" })}
            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="">Peso corporal</option>
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
                className={numCls}
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
