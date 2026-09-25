"use client"

import { AiRoutineGenerator, type AiRoutineResult } from "@/components/ai-routine-generator"
import { ExercisePicker, type PickerExercise } from "@/components/exercise-picker"
import { PageTransition } from "@/components/page-transition"
import { YouTubePlayer, YouTubeThumb } from "@/components/youtube-player"
import { ZoneBar, ZoneLegend } from "@/components/zone-profile"
import { deriveBodyZone, ZONE_CONFIG, zoneProfileFromContent, type BodyZone } from "@/lib/body-zones"
import { useFullscreenWhileMounted } from "@/lib/fullscreen-mode"
import { markBackNavigation } from "@/lib/page-transition"
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
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ClockIcon,
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
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { createContext, use, useCallback, useContext, useEffect, useRef, useState } from "react"

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

type ExerciseInfo = { name: string; youtubeVideoId: string | null; videoOrientation: "horizontal" | "vertical"; zone: BodyZone | null }

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

// ─── Arrastrar y soltar (reordenar manteniendo presionado) ────────────────────

const ROOT_CONTAINER_ID = "root-container"
const blockDropId = (blockId: string) => `block-drop-${blockId}`

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

/** A qué contenedor pertenece (o apunta) un id: la raíz, o el circuito dueño del ejercicio/zona. */
function containerIdOf(items: Array<RoutineItemExercise | RoutineItemBlock>, id: string): string | null {
  if (id === ROOT_CONTAINER_ID) return ROOT_CONTAINER_ID
  if (id.startsWith("block-drop-")) return id.slice("block-drop-".length)
  const loc = locateItem(items, id)
  if (!loc) return null
  return loc.where === "root" ? ROOT_CONTAINER_ID : loc.blockId
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

  const router = useRouter()
  // Modo enfocado, igual que cuando el atleta entrena: sin sidebar ni hamburguesa, la
  // única salida es el botón "Salir" de la cabecera.
  useFullscreenWhileMounted(true)

  const { data: routineData, refetch } = trpc.routines.get.useQuery({ id: routineId })
  const { data: catalog }              = trpc.exercises.list.useQuery({ teamId })
  const updateContent                  = trpc.routines.updateContent.useMutation({ onSuccess: () => refetch() })
  const renameRoutine                  = trpc.routines.rename.useMutation({ onSuccess: () => refetch() })
  const { data: aiAvailable }          = trpc.routines.aiAvailable.useQuery({ teamId })
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
  const [confirmExit, setConfirmExit]   = useState(false)
  // Solo un ejercicio abierto en modo edición a la vez: abrir otro cierra el anterior.
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)
  const toggleExercise = useCallback((id: string) => {
    setOpenExerciseId((prev) => (prev === id ? null : id))
  }, [])
  // Último valor de descanso usado por el entrenador: sugiere ese mismo valor para el próximo descanso que se autocomplete.
  const [suggestedRest, setSuggestedRest] = useState(DEFAULT_SUGGESTED_REST_SECONDS)

  useEffect(() => { if (routineData) setName(routineData.name) }, [routineData])

  // Cerrar o recargar la pestaña se escapa del botón "Salir": ahí solo queda el aviso
  // nativo del navegador.
  useEffect(() => {
    if (!dirty) return
    function warn(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  // El gesto de "atrás" (botón físico, swipe) también debe pasar por requestExit en
  // vez de salir directo: se reserva una entrada extra en el historial que absorbe el
  // primer "atrás" y, en su lugar, dispara la misma confirmación que el botón "Salir".
  // La entrada lleva una marca propia: hojas anidadas (agregar ejercicio, filtros)
  // reservan su propia entrada encima y la conservan al hacer push, así que un "atrás"
  // que solo cierra una de esas hojas no debe disparar esta confirmación.
  const requestExitRef = useRef(requestExit)
  useEffect(() => { requestExitRef.current = requestExit })
  useEffect(() => {
    history.pushState({ ...window.history.state, routineEditor: true }, "", window.location.href)
    function onPopState(e: PopStateEvent) {
      if (e.state?.routineEditor) return
      history.pushState({ ...window.history.state, routineEditor: true }, "", window.location.href)
      requestExitRef.current()
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const content: RoutineContent = localContent ?? routineData?.content ?? { v: 1, items: [] }

  // Catálogo local como fuente primaria; fallback al mapa del servidor (ejercicios ya no visibles)
  const info: Record<string, ExerciseInfo> = {
    ...Object.fromEntries(Object.entries(routineData?.exerciseInfo ?? {}).map(([id, e]) => [id, { name: e.name, youtubeVideoId: e.youtubeVideoId, videoOrientation: e.videoOrientation, zone: e.zone }])),
    ...Object.fromEntries((catalog ?? []).map((e) => [e.id, { name: e.name, youtubeVideoId: e.youtubeVideoId, videoOrientation: e.videoOrientation, zone: deriveBodyZone(e.muscles) }])),
  }
  const infoFor = (id: string): ExerciseInfo => info[id] ?? { name: "…", youtubeVideoId: null, videoOrientation: "horizontal", zone: null }
  // Se recalcula con cada cambio sin guardar: el entrenador ve cómo se reparte la rutina mientras la arma
  const zoneProfile = zoneProfileFromContent(content, (id) => info[id]?.zone)

  function mutate(fn: (c: RoutineContent) => RoutineContent) {
    setLocalContent((prev) => fn(prev ?? routineData?.content ?? { v: 1, items: [] }))
    setDirty(true)
  }

  const emptyBlocks = content.items.filter((i) => i.type === "block" && i.exercises.length === 0).length

  // Salida única de la vista: si hay cambios, se pregunta qué hacer con ellos.
  const backHref = `/teams/${teamId}/plantillas`

  function requestExit() {
    if (dirty) { setConfirmExit(true); return }
    markBackNavigation()
    router.push(backHref)
  }

  function saveAndExit() {
    updateContent.mutate({ id: routineId, content }, {
      onSuccess: () => { setLocalContent(null); setDirty(false); markBackNavigation(); router.push(backHref) },
    })
  }

  function exitWithoutSaving() {
    setLocalContent(null)
    setDirty(false)
    setAiResult(null)
    setConfirmExit(false)
    markBackNavigation()
    router.push(backHref)
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

  // Arrastrar y soltar: mantener presionado un ejercicio o circuito lo activa como
  // arrastrable, para reordenarlo o meterlo/sacarlo de un circuito con el dedo.
  const [activeDragId, setActiveDragId]   = useState<string | null>(null)
  const [overContainerId, setOverContainerId] = useState<string | null>(null)
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))
  // Snapshot de antes de arrastrar: el preview en vivo (ver abajo) ya mueve el
  // ejercicio entre contenedores mientras se arrastra, así que si se cancela hay
  // que restaurar el contenido (y si estaba "limpio", que siga estándolo).
  const dragSnapshotRef = useRef<{ content: RoutineContent; dirty: boolean } | null>(null)

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
    dragSnapshotRef.current = { content, dirty }
  }
  // Mueve el ejercicio en vivo apenas cruza a otro contenedor (raíz ↔ circuito, o
  // entre circuitos), para que se vea entrar/salir mientras se arrastra en vez de
  // solo al soltar. El reordenamiento dentro de un mismo contenedor ya lo anima
  // dnd-kit por su cuenta (transform + transition de cada item), así que aquí no
  // se toca nada si el contenedor no cambió.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) { setOverContainerId(null); return }
    const activeId = String(active.id)
    const overId = String(over.id)
    const items = [...content.items].sort((a, b) => a.order - b.order)
    const activeContainer = containerIdOf(items, activeId)
    const overContainer   = containerIdOf(items, overId)
    setOverContainerId(overContainer)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return
    const next = moveDraggedItem(content, activeId, overId)
    if (next === content) return
    setLocalContent(next)
    setDirty(true)
  }
  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    setOverContainerId(null)
    dragSnapshotRef.current = null
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return
    mutate((c) => moveDraggedItem(c, activeId, overId))
  }
  function handleDragCancel() {
    setActiveDragId(null)
    setOverContainerId(null)
    if (dragSnapshotRef.current) {
      setLocalContent(dragSnapshotRef.current.content)
      setDirty(dragSnapshotRef.current.dirty)
    }
    dragSnapshotRef.current = null
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
    <>
    <PageTransition direction="forward">
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-16">
      {/* Cabecera fija: ocupa el espacio que dejó el topbar de la app en modo enfocado.
          La única salida de la vista es este botón, que es donde se decide qué hacer
          con los cambios. */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 -mt-6 sm:-mt-8 mb-2 px-4 sm:px-6 py-2 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestExit}
            aria-label="Salir"
            className="shrink-0 flex items-center gap-1 -ml-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="text-sm">Salir</span>
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim()
              if (!trimmed) { setName(routineData.name); return }
              if (trimmed.toLowerCase() !== routineData.name) renameRoutine.mutate({ id: routineId, name: trimmed.toLowerCase() })
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
            className="flex-1 min-w-0 text-base font-bold tracking-wide uppercase bg-transparent outline-none border-b border-transparent hover:border-muted-foreground/30 focus:border-primary/60 transition-colors truncate cursor-text"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
            aria-label="Nombre de la plantilla"
          />
        </div>
        {/* Reparto de la rutina por zona corporal, siempre visible mientras se arma */}
        {zoneProfile.totalSets > 0 && (
          <div className="pt-1 pb-0.5">
            <ZoneBar profile={zoneProfile} className="h-1" />
            <ZoneLegend profile={zoneProfile} className="mt-1 text-[10px]" />
          </div>
        )}
      </div>

      {/* IA (experimental): solo tiene sentido para arrancar una rutina vacía, así que
          en cuanto hay al menos un ejercicio deja de ofrecerse. */}
      {aiAvailable && !isEvaluation && content.items.length === 0 && (aiOpen ? (
        <AiRoutineGenerator
          teamId={teamId}
          replacesContent={false}
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
          <p className="text-[11px] text-muted-foreground pl-6">Es una propuesta: ajústala a tu gusto y, al salir, elige <strong>Guardar</strong> para conservarla.</p>
        </div>
      )}

      {/* Items */}
      <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <RootDropZone>
          {/* Solo tiene sentido marcar "por dónde empieza" cuando ya hay algo que recorrer;
              de paso, le da aire a la parte de arriba en vez de arrancar pegado al primer ejercicio. */}
          {sorted.length > 0 && <RoutineStartMarker />}
          <SortableContext items={sorted.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {sorted.map((item, idx) => {
              const moveProps = {
                onRemove: () => removeItem(item.id),
              }
              return (
                <SortableItem key={item.id} id={item.id}>
                  {item.type === "exercise" ? (
                    <div className="relative">
                      <div className="relative z-10">
                        {/* Respaldo opaco: la tarjeta es translúcida (bg-card/60) y sin esto se transparentaría el descanso que se esconde detrás. */}
                        <div className="absolute inset-0 rounded-xl bg-card pointer-events-none" aria-hidden="true" />
                        <ExerciseCard
                          item={item}
                          label={String(idx + 1)}
                          isEvaluation={isEvaluation}
                          info={infoFor(item.exerciseId)}
                          onPreview={setPreview}
                          onUpdate={(patch) => updateItem(item.id, patch)}
                          expanded={openExerciseId === item.id}
                          onToggle={() => toggleExercise(item.id)}
                          {...moveProps}
                        />
                      </div>
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
                      isDropTarget={activeDragId != null && overContainerId === item.id}
                      openExerciseId={openExerciseId}
                      onToggleExercise={toggleExercise}
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
      <div className="flex flex-wrap items-stretch gap-3">
        {available.length > 0 && (
          <div className="flex-1 min-w-[220px]">
            <AddExerciseRow exercises={available} onAdd={addExercise} placeholder="Agregar ejercicio…" />
          </div>
        )}
        {!isEvaluation && <AddCircuitPlaceholder onClick={addBlock} />}
      </div>
    </div>
    </PageTransition>

    {/* Modales fuera del contenedor que se desliza: un ancestro con `transform` crea un
        nuevo contenedor de posicionamiento y rompe `position: fixed`. */}
    {confirmExit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmExit(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-exit-title"
          >
            <div className="space-y-1">
              <p id="confirm-exit-title" className="text-base font-semibold">¿Guardar los cambios?</p>
              {emptyBlocks > 0 && (
                <p className="text-xs text-destructive">
                  {emptyBlocks === 1 ? "Hay un circuito vacío" : `Hay ${emptyBlocks} circuitos vacíos`}: agrega
                  ejercicios o elimínalos para poder guardar.
                </p>
              )}
              {updateContent.isError && (
                <p className="text-xs text-destructive">No se pudo guardar. Inténtalo de nuevo.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exitWithoutSaving}
                disabled={updateContent.isPending}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer transition-colors"
              >
                No guardar
              </button>
              <button
                type="button"
                onClick={saveAndExit}
                disabled={updateContent.isPending || emptyBlocks > 0}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 cursor-pointer transition-colors"
              >
                {updateContent.isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview?.youtubeVideoId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-4" onClick={() => setPreview(null)}>
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
    </>
  )
}

// ─── Add exercise row ─────────────────────────────────────────────────────────
//
// En vez de un botón de texto, el trigger es una tarjeta "fantasma" con el mismo
// tamaño y forma que un ExerciseCard cerrado: una simulación de la tarjeta que se
// va a crear, con borde punteado que parpadea para que se lea como un espacio
// vacío a llenar y no como un ejercicio más de la lista.

function AddExerciseRow({ exercises, onAdd, placeholder }: { exercises: PickerExercise[]; onAdd: (id: string) => void; placeholder: string }) {
  const [value, setValue] = useState("")
  return (
    <ExercisePicker
      exercises={exercises}
      value={value}
      onChange={(id) => { onAdd(id); setValue("") }}
      placeholder={placeholder}
      trigger={(open) => <AddExercisePlaceholder onClick={open} label={placeholder} />}
    />
  )
}

function AddExercisePlaceholder({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-full h-full min-h-[84px] flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed bg-muted/5 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer animate-border-pulse"
    >
      <span className="w-7 h-7 rounded-full border-2 border-current/40 flex items-center justify-center shrink-0">
        <PlusIcon className="w-4 h-4" />
      </span>
      <span className="text-sm font-medium">Agregar ejercicio</span>
    </button>
  )
}

/** Igual espíritu que el placeholder de ejercicio, pero como un cuadrado chico: un
    circuito no es "un ejercicio más" así que no debe simularse como una tarjeta grande. */
function AddCircuitPlaceholder({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Agregar circuito (varios ejercicios con vueltas)"
      className="w-24 min-h-[84px] shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer animate-border-pulse"
    >
      <RepeatIcon className="w-4 h-4" />
      <span className="text-[11px] font-medium leading-tight text-center px-1">Agregar circuito</span>
    </button>
  )
}

/** Marca visualmente dónde arranca la rutina y que el orden va de arriba hacia abajo. */
function RoutineStartMarker() {
  return (
    <div className="flex flex-col items-center gap-1 py-1 text-muted-foreground/50">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Inicio de la rutina</span>
      <ChevronDownIcon className="w-4 h-4" />
    </div>
  )
}

// ─── Drag and drop ─────────────────────────────────────────────────────────────
//
// El arrastre se activa solo desde el ícono de agarre (`DragHandle`), no desde
// cualquier punto de la tarjeta: en móvil, `touch-action: none` es necesario para
// que el gesto de mantener presionado no compita con el scroll nativo de la página,
// pero aplicarlo a toda la tarjeta bloquearía poder hacer scroll tocándola. Con un
// handle chico y dedicado, el resto de la tarjeta conserva el scroll normal.

type SortableHandle = {
  attributes: ReturnType<typeof useSortable>["attributes"]
  listeners: ReturnType<typeof useSortable>["listeners"]
  setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"]
}
const SortableItemContext = createContext<SortableHandle | null>(null)

/** Envuelve un ejercicio o circuito y expone su agarre de arrastre a los hijos vía contexto. */
function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <SortableItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>
      <div
        ref={setNodeRef}
        data-sortable-id={id}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn(isDragging && "opacity-30")}
      >
        {children}
      </div>
    </SortableItemContext.Provider>
  )
}

/** Ícono de agarre: mantenerlo presionado activa el arrastre del ejercicio o circuito que lo contiene. */
function DragHandle() {
  const handle = useContext(SortableItemContext)
  return (
    <button
      type="button"
      ref={handle?.setActivatorNodeRef}
      {...handle?.attributes}
      {...handle?.listeners}
      className="p-2 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing touch-none shrink-0"
      aria-label="Arrastrar para reordenar"
    >
      <GripVerticalIcon className="w-[18px] h-[18px]" />
    </button>
  )
}

/**
 * Agarre de arrastre y botón de eliminar apilados en la esquina superior derecha de la
 * tarjeta, para no ocupar ancho en el encabezado (donde antes dejaban una fila casi
 * vacía al envolver). El contenedor de la tarjeta debe tener `position: relative`.
 */
function CardCornerActions({ onRemove, confirmMessage }: { onRemove: () => void; confirmMessage: string }) {
  function handleRemove() {
    if (window.confirm(confirmMessage)) onRemove()
  }
  return (
    <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-center gap-1">
      <DragHandle />
      <button
        type="button"
        onClick={handleRemove}
        className="p-2 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-muted/60 transition-colors cursor-pointer"
        aria-label="Eliminar"
      >
        <Trash2Icon className="w-[18px] h-[18px]" />
      </button>
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
        className="flex items-center gap-1.5 ml-9 mt-1 pl-1 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors cursor-pointer"
      >
        <PlusIcon className="w-3 h-3" /> Agregar descanso
      </button>
    )
  }
  return (
    <div className="relative z-0 flex items-center gap-1.5 w-fit max-w-[calc(100%-2.25rem)] ml-9 -mt-2.5 pt-2.5 px-2.5 pb-1.5 rounded-b-lg border border-t-0 border-primary/30 bg-primary/10 text-[11px] text-primary">
      <PauseIcon className="w-3 h-3 shrink-0" />
      <span className="shrink-0 font-medium">{label}</span>
      <input
        type="number"
        min={0}
        value={seconds}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        // text-xs y no un tamaño arbitrario: la regla de globals.css que evita el zoom
        // de iOS al enfocar solo sube a 16px los tamaños del tema (text-xs/text-sm).
        className="w-14 bg-background border border-primary/30 rounded-md px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Segundos de descanso"
      />
      <span className="shrink-0">seg</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 p-0.5 text-primary/60 hover:text-destructive transition-colors cursor-pointer"
        aria-label="Quitar descanso"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

// Abrir se siente bien despacio (se puede seguir la aparición del contenido); cerrar
// más rápido porque ahí ya no hay nada nuevo que leer.
const CURTAIN_OPEN_MS = 600
const CURTAIN_CLOSE_MS = 400

function ExerciseCard({
  item, label, isEvaluation, info, onUpdate, onPreview, onRemove, nested = false,
  expanded, onToggle,
}: {
  item: RoutineExerciseContent
  label: string
  isEvaluation: boolean
  info: ExerciseInfo
  onUpdate: (patch: Partial<RoutineExerciseContent>) => void
  onPreview: (info: ExerciseInfo) => void
  onRemove: () => void
  nested?: boolean
  /** Lo controla el padre: solo un ejercicio puede estar abierto a la vez. */
  expanded: boolean
  onToggle: () => void
}) {
  const [drafts, setDrafts]       = useState<DraftSet[]>(() => item.sets.map(draftFromSet))
  const [meta, setMeta]           = useState({ tempo: item.tempo ?? "", goal: item.goal ?? "", notes: item.notes ?? "" })
  const [quick, setQuick]         = useState({ count: String(item.sets.length || 3), value: "" })
  const [tempoInfo, setTempoInfo] = useState(false)

  function toggleEditor() {
    // Al abrir, parte de lo que hay guardado; al cerrar no hay nada que descartar
    // porque cada cambio ya se fue aplicando al borrador de la plantilla.
    if (!expanded) {
      setDrafts(item.sets.map(draftFromSet))
      setMeta({ tempo: item.tempo ?? "", goal: item.goal ?? "", notes: item.notes ?? "" })
      setQuick({ count: String(item.sets.length || 3), value: "" })
    }
    onToggle()
  }

  // Sin botón "Aplicar": cada edición viaja de inmediato al borrador en memoria de la
  // plantilla, y el guardado real queda en el indicador global de la cabecera.
  function push(nextDrafts: DraftSet[], nextMeta: typeof meta) {
    onUpdate({
      sets: nextDrafts.map(draftToSet),
      ...(isEvaluation ? {} : {
        tempo: nextMeta.tempo || undefined,
        goal:  (nextMeta.goal as RoutineExerciseContent["goal"]) || undefined,
        notes: nextMeta.notes || undefined,
      }),
    })
  }

  function changeDrafts(next: DraftSet[]) {
    setDrafts(next)
    push(next, meta)
  }

  function changeMeta(next: typeof meta) {
    setMeta(next)
    push(drafts, next)
  }

  function applyQuick() {
    const count = Math.max(1, Math.min(20, Number(quick.count) || 1))
    const base = drafts[0] ?? defaultDraft(1)
    const value = quick.value.trim()
    changeDrafts(Array.from({ length: count }, (_, i) => ({
      ...base,
      setNumber: i + 1,
      ...(value !== "" ? (base.setType === "time" ? { targetDurationSeconds: value } : { targetReps: value }) : {}),
    })))
  }

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"

  return (
    <div className={cn("relative border border-border rounded-xl overflow-hidden", nested ? "bg-background" : "bg-card/60")}>
      {info.zone && (
        <div
          className={cn("absolute left-0 inset-y-0 w-1", ZONE_CONFIG[info.zone].bar)}
          title={ZONE_CONFIG[info.zone].label}
          aria-hidden="true"
        />
      )}
      <CardCornerActions onRemove={onRemove} confirmMessage={`¿Eliminar "${info.name}" de la rutina?`} />
      <div className="flex flex-wrap items-center gap-3 pl-3 pr-14 py-2.5 min-h-[84px] bg-muted/10">
        <span className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
          {label}
        </span>
        {info.youtubeVideoId ? (
          <button type="button" onClick={() => onPreview(info)} className="shrink-0 rounded-md overflow-hidden cursor-pointer" aria-label={`Ver video de ${info.name}`}>
            <YouTubeThumb videoId={info.youtubeVideoId} alt={info.name} showPlay className="w-20 aspect-video" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleEditor}
          aria-expanded={expanded}
          aria-controls={`editor-${item.id}`}
          className="flex-1 min-w-[140px] text-left cursor-pointer"
        >
          <p className="font-semibold text-sm truncate">{info.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {info.zone && <span className={cn("font-medium", ZONE_CONFIG[info.zone].text)}>{ZONE_CONFIG[info.zone].label} · </span>}
            {setsSummary(item.sets)}
            {item.restSeconds ? ` · descanso ${item.restSeconds}s` : ""}
            {item.notes ? " · con notas" : ""}
          </p>
        </button>
      </div>

      {/* Cortina: grid-rows 0fr → 1fr anima la altura sin medirla con JS. El contenido
          sigue montado (si no, no habría nada que animar al cerrar), así que cuando está
          cerrado se marca inerte para que no reciba foco ni lectores de pantalla. */}
      <div
        id={`editor-${item.id}`}
        className={cn(
          "grid transition-[grid-template-rows] ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        style={{ transitionDuration: `${expanded ? CURTAIN_OPEN_MS : CURTAIN_CLOSE_MS}ms` }}
      >
        <div className="overflow-hidden" inert={!expanded}>
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
                onUpdate={(patch) => changeDrafts(drafts.map((d, j) => j === i ? { ...d, ...patch } : d))}
                onRemove={() => changeDrafts(drafts.filter((_, j) => j !== i).map((d, j) => ({ ...d, setNumber: j + 1 })))}
                canRemove={drafts.length > 1}
              />
            ))}
          </div>

          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={() => changeDrafts([...drafts, defaultDraft(drafts.length + 1, drafts[drafts.length - 1])])}
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
                  {/* Va en el flujo (no flotante): la cortina recorta lo que se salga de
                      la tarjeta, y así la ayuda también se alcanza con teclado. */}
                  <button
                    type="button"
                    onClick={() => setTempoInfo((v) => !v)}
                    aria-expanded={tempoInfo}
                    aria-label="Qué es el ritmo (tempo)"
                    className="p-1 -m-1 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <InfoIcon className="w-3 h-3" />
                  </button>
                </div>
                {tempoInfo && (
                  <div className="text-[11px] text-muted-foreground bg-card border border-border rounded-lg px-2.5 py-2 leading-relaxed">
                    <p className="font-semibold text-foreground mb-1">Ejemplo: 3-1-2-0</p>
                    <p>El atleta verá: “Baja en 3 s, pausa 1 s, sube en 2 s, pausa 0 s”.</p>
                  </div>
                )}
                <input type="text" placeholder="3-1-2-0" value={meta.tempo} onChange={(e) => changeMeta({ ...meta, tempo: e.target.value })} className={inputCls} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                El descanso se edita en la fila “Descanso” debajo de este ejercicio, no aquí.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Objetivo</label>
                <select value={meta.goal} onChange={(e) => changeMeta({ ...meta, goal: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
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
                  onChange={(e) => changeMeta({ ...meta, notes: e.target.value })}
                  className={cn(inputCls, "py-2 resize-none")}
                />
              </div>
            </div>
          )}

          <div className="px-4 py-2.5 border-t border-border bg-muted/10">
            <button
              type="button"
              onClick={toggleEditor}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronUpIcon className="w-3.5 h-3.5" /> Listo
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Block (circuito) card ────────────────────────────────────────────────────

function BlockCard({
  item, label, infoFor, catalog, onUpdate, onPreview, onRemove,
  suggestedRest, onSuggestedRestChange, isDropTarget = false,
  openExerciseId, onToggleExercise,
}: {
  item: RoutineItemBlock
  label: string
  infoFor: (id: string) => ExerciseInfo
  catalog: PickerExercise[]
  onUpdate: (patch: Partial<RoutineItemBlock>) => void
  onPreview: (info: ExerciseInfo) => void
  onRemove: () => void
  suggestedRest: number
  onSuggestedRestChange: (seconds: number) => void
  /** Un ejercicio se está arrastrando sobre este circuito ahora mismo (entrando o reordenando adentro). */
  isDropTarget?: boolean
  openExerciseId: string | null
  onToggleExercise: (id: string) => void
}) {
  const exercises = [...item.exercises].sort((a, b) => a.order - b.order)
  const setExercises = (list: RoutineExerciseContent[]) => onUpdate({ exercises: renumber(list) })
  const { setNodeRef: setBlockDropRef } = useDroppable({ id: blockDropId(item.id) })

  return (
    <div
      className={cn(
        "relative border-2 border-primary/30 rounded-xl overflow-hidden bg-primary/5 transition-transform duration-150 ease-out",
        isDropTarget && "scale-[1.015] border-primary/60 shadow-lg shadow-primary/10",
      )}
    >
      <CardCornerActions
        onRemove={onRemove}
        confirmMessage={
          exercises.length > 0
            ? `¿Eliminar el circuito "${item.name || "Circuito"}"? Se eliminarán sus ${exercises.length} ejercicio${exercises.length !== 1 ? "s" : ""}.`
            : `¿Eliminar el circuito "${item.name || "Circuito"}"?`
        }
      />
      <div className="flex flex-wrap items-center gap-2 pl-3 pr-14 py-2.5 min-h-[84px] bg-primary/10">
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
              <div className="relative">
                <div className="relative z-10">
                  <ExerciseCard
                    nested
                    item={ex}
                    label={`${label}.${i + 1}`}
                    isEvaluation={false}
                    info={infoFor(ex.exerciseId)}
                    onPreview={onPreview}
                    onUpdate={(patch) => setExercises(exercises.map((e) => (e.id === ex.id ? { ...e, ...patch } : e)))}
                    onRemove={() => setExercises(exercises.filter((e) => e.id !== ex.id))}
                    expanded={openExerciseId === ex.id}
                    onToggle={() => onToggleExercise(ex.id)}
                  />
                </div>
                <RestRow
                  seconds={ex.restSeconds}
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
