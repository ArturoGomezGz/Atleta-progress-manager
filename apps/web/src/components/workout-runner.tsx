"use client"

// Ejecutor de rutinas — la pantalla que ve quien está entrenando.
//
// No sabe de dónde vienen los datos: un atleta con cuenta los lee de su sesión
// (`sessions.myProgress`) y un invitado con enlace de los suyos (`share.workout`).
// Quien lo usa aporta las acciones (`onRecordSet`, `onFinish`) y la pantalla
// final, para que el invitado reciba la invitación a crear su cuenta.

import { YouTubePlayer, YouTubeThumb } from "@/components/youtube-player"
import { useFullscreenWhileMounted } from "@/lib/fullscreen-mode"
import { cn } from "@/lib/utils"
import { describeTarget, explainTempo, formatDuration, isTimeTarget, summarizeTargets } from "@/lib/workout-text"
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  InfoIcon,
  ListIcon,
  MessageSquareIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  RotateCcwIcon,
  TimerIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WorkoutTarget = {
  id: string
  sessionExerciseId: string
  setNumber: number
  setType: string
  targetReps: number | null
  targetDurationSeconds: number | null
  targetPercent: string | null
}

export type WorkoutSet = {
  id: string
  sessionExerciseId: string
  sessionSetTargetId: string | null
  setNumber: number
  reps: number
  weightLbs: string
  status: "valid" | "invalid"
}

export type WorkoutExercise = {
  id: string
  exerciseId: string
  exerciseName: string
  description: string | null
  youtubeVideoId: string | null
  youtubeTitle: string | null
  videoOrientation: "horizontal" | "vertical"
  order: number
  tempo: string | null
  restSeconds: number | null
  notes: string | null
  blockId: string | null
  blockName: string | null
  rounds: number
  roundNumber: number | null
  targets: WorkoutTarget[]
  sets: WorkoutSet[]
}

export type WorkoutProgress = {
  id: string
  status: string
  startedAt: string
  routineName: string | null
  exercises: WorkoutExercise[]
}

/** Datos de la serie que se acaba de terminar, para que quien use el ejecutor la guarde. */
export type RecordSetInput = {
  exercise: WorkoutExercise
  target: WorkoutTarget
  reps: number
  weightLbs: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function calcWeight(targetPercent: string | null, rmLbs: string | null | undefined): string {
  if (!targetPercent || !rmLbs) return ""
  const raw = Number(rmLbs) * Number(targetPercent) / 100
  return (Math.ceil(raw * 2) / 2).toFixed(1)
}

function findCurrentPosition(exercises: WorkoutExercise[]) {
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei]
    for (const target of ex.targets) {
      const done = ex.sets.some((s) => s.sessionSetTargetId === target.id)
      if (!done) return { exercise: ex, target, exerciseIdx: ei }
    }
  }
  return null
}

export const totalSets = (exercises: WorkoutExercise[]) => exercises.reduce((s, ex) => s + ex.targets.length, 0)
const doneSets = (exercises: WorkoutExercise[]) =>
  exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.sessionSetTargetId !== null).length, 0)
const doneFor = (ex: WorkoutExercise) => ex.sets.filter((r) => r.sessionSetTargetId !== null).length

// Descanso usado cuando el ejercicio no trae uno propio definido por el entrenador.
const DEFAULT_REST_SECONDS = 90

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* no soportado */ }
}

// Las pantallas a altura completa y el pie fijo se ajustan según haya menú
// lateral (atleta dentro de la app) o no (invitado con enlace).
const screenHeight = (withSidebar: boolean) =>
  withSidebar ? "min-h-[calc(100dvh-3.5rem)] lg:min-h-screen" : "min-h-dvh"

// ─── Shared pieces ─────────────────────────────────────────────────────────────

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-3 py-2.5 -ml-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
    >
      <ArrowLeftIcon className="w-5 h-5" />
      {label}
    </Link>
  )
}

function VideoModal({ exercise, onClose }: { exercise: WorkoutExercise; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  if (!exercise.youtubeVideoId) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={`Video: ${exercise.exerciseName}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-lg font-semibold truncate">{exercise.exerciseName}</p>
        <button
          onClick={onClose}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-base font-semibold cursor-pointer"
        >
          <XIcon className="w-5 h-5" /> Cerrar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="max-w-3xl mx-auto space-y-4 [&_a]:text-white/80 [&_button]:text-white/90">
          <YouTubePlayer
            videoId={exercise.youtubeVideoId}
            title={exercise.exerciseName}
            orientation={exercise.videoOrientation}
            autoStart
            large
          />
          {exercise.description && <p className="text-base text-white/80 leading-relaxed">{exercise.description}</p>}
        </div>
      </div>
    </div>
  )
}

function NotesModal({ notes, onClose }: { notes: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Indicaciones de tu entrenador"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-amber-500/30 p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold flex items-center gap-2 text-lg">
            <MessageSquareIcon className="w-5 h-5 text-amber-600" /> Indicaciones de tu entrenador
          </p>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 cursor-pointer" aria-label="Cerrar">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-base leading-relaxed">{notes}</p>
      </div>
    </div>
  )
}

function ExerciseOverviewCard({
  exercise, index, onWatch, highlight,
}: {
  exercise: WorkoutExercise
  index: number
  onWatch: () => void
  highlight?: "current" | "done"
}) {
  const done = doneFor(exercise)
  const total = exercise.targets.length

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden",
      highlight === "current" ? "border-primary ring-2 ring-primary/30" : "border-border",
    )}>
      <div className="flex gap-3 p-3">
        {exercise.youtubeVideoId ? (
          <button onClick={onWatch} className="shrink-0 cursor-pointer rounded-xl overflow-hidden" aria-label={`Ver video de ${exercise.exerciseName}`}>
            <YouTubeThumb videoId={exercise.youtubeVideoId} alt={exercise.exerciseName} showPlay className="w-32 sm:w-40 aspect-video" />
          </button>
        ) : (
          <div className="shrink-0 w-32 sm:w-40 aspect-video rounded-xl bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
            {index + 1}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1 py-0.5">
          <p className="text-sm text-muted-foreground">Ejercicio {index + 1}</p>
          <p className="text-lg font-semibold leading-snug">{exercise.exerciseName}</p>
          <p className="text-base">{summarizeTargets(exercise.targets)}</p>
          {exercise.blockName && (
            <p className="text-sm text-primary flex items-center gap-1">
              <RepeatIcon className="w-4 h-4" /> {exercise.blockName}
              {exercise.roundNumber && ` · ronda ${exercise.roundNumber} de ${exercise.rounds}`}
            </p>
          )}
        </div>
      </div>

      {(exercise.notes || highlight === "done" || (done > 0 && done < total)) && (
        <div className="px-4 pb-3 space-y-2">
          {exercise.notes && (
            <p className="text-base text-muted-foreground flex gap-2">
              <MessageSquareIcon className="w-4 h-4 mt-1 shrink-0" />
              {exercise.notes}
            </p>
          )}
          {done > 0 && (
            <p className={cn("text-base font-medium flex items-center gap-2", done >= total ? "text-emerald-500" : "text-primary")}>
              <CheckCircleIcon className="w-5 h-5" />
              {done >= total ? "Terminado" : `${done} de ${total} series hechas`}
            </p>
          )}
        </div>
      )}

      {exercise.youtubeVideoId && (
        <button
          onClick={onWatch}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-t border-border text-base font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors"
        >
          <PlayIcon className="w-5 h-5" /> Ver cómo se hace
        </button>
      )}
    </div>
  )
}

// ─── Vista previa (antes de empezar) ───────────────────────────────────────────

type PreviewItem =
  | { kind: "exercise"; exercise: WorkoutExercise }
  | { kind: "circuit"; blockId: string; blockName: string; rounds: number; exercises: WorkoutExercise[]; allExercises: WorkoutExercise[] }

/**
 * Agrupa las rondas de un mismo circuito en una sola entrada. `flattenContent`
 * expande cada circuito ronda por ronda (A, B, A, B, …) para que el ejecutor
 * sepa el orden exacto; para la vista previa (y para "ver toda la rutina" ya
 * empezada) eso solo repite el mismo bloque varias veces, así que aquí nos
 * quedamos con los ejercicios de la primera ronda para mostrarlos y guardamos
 * todas las rondas en `allExercises` para calcular progreso.
 */
function groupForPreview(exercises: WorkoutExercise[]): PreviewItem[] {
  const items: PreviewItem[] = []
  for (const ex of exercises) {
    const prev = items[items.length - 1]
    if (ex.blockId && prev?.kind === "circuit" && prev.blockId === ex.blockId) {
      prev.allExercises.push(ex)
      if (ex.roundNumber === 1) prev.exercises.push(ex)
      continue
    }
    if (ex.blockId) {
      items.push({
        kind: "circuit",
        blockId: ex.blockId,
        blockName: ex.blockName ?? "Circuito",
        rounds: ex.rounds,
        exercises: ex.roundNumber === 1 ? [ex] : [],
        allExercises: [ex],
      })
      continue
    }
    items.push({ kind: "exercise", exercise: ex })
  }
  return items
}

function CircuitOverviewCard({
  blockName, rounds, exercises, allExercises, onWatch, current,
}: {
  blockName: string
  rounds: number
  exercises: WorkoutExercise[]
  /** Todas las rondas del bloque; si se omite, la tarjeta no muestra progreso (vista previa). */
  allExercises?: WorkoutExercise[]
  onWatch: (exercise: WorkoutExercise) => void
  /** Ejercicio activo de la sesión en curso, para resaltar el bloque y la ronda vigente. */
  current?: WorkoutExercise
}) {
  const active = current && allExercises?.some((ex) => ex.id === current.id) ? current : null
  const totalTargets = allExercises?.reduce((s, ex) => s + ex.targets.length, 0) ?? 0
  const totalDone = allExercises?.reduce((s, ex) => s + doneFor(ex), 0) ?? 0
  const isDone = totalTargets > 0 && totalDone >= totalTargets

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden",
      active ? "border-primary ring-2 ring-primary/30" : "border-border",
    )}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-primary/5 border-b border-border">
        <p className="font-semibold flex items-center gap-2">
          <RepeatIcon className="w-4 h-4 text-primary" /> {blockName}
        </p>
        {isDone ? (
          <span className="text-sm font-medium text-emerald-500 bg-emerald-500/10 rounded-full px-2.5 py-1 flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" /> Completado
          </span>
        ) : active?.roundNumber ? (
          <span className="text-sm font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
            Ronda {active.roundNumber} de {rounds}
          </span>
        ) : (
          <span className="text-sm font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
            × {rounds} {rounds === 1 ? "ronda" : "rondas"}
          </span>
        )}
      </div>
      <div className="divide-y divide-border">
        {exercises.map((ex) => {
          const roundEntries = allExercises?.filter((e) => e.exerciseId === ex.exerciseId) ?? []
          const done = roundEntries.reduce((s, e) => s + doneFor(e), 0)
          const total = roundEntries.reduce((s, e) => s + e.targets.length, 0)
          return (
            <div key={ex.id} className={cn("flex gap-3 p-3", active?.exerciseId === ex.exerciseId && "bg-primary/5")}>
              {ex.youtubeVideoId ? (
                <button
                  onClick={() => onWatch(ex)}
                  className="shrink-0 cursor-pointer rounded-xl overflow-hidden"
                  aria-label={`Ver video de ${ex.exerciseName}`}
                >
                  <YouTubeThumb videoId={ex.youtubeVideoId} alt={ex.exerciseName} showPlay className="w-24 sm:w-32 aspect-video" />
                </button>
              ) : (
                <div className="shrink-0 w-24 sm:w-32 aspect-video rounded-xl bg-muted" />
              )}
              <div className="flex-1 min-w-0 space-y-1 py-0.5">
                <p className="text-base font-semibold leading-snug">{ex.exerciseName}</p>
                <p className="text-base">{summarizeTargets(ex.targets)}</p>
                {ex.notes && (
                  <p className="text-sm text-muted-foreground flex gap-1.5">
                    <MessageSquareIcon className="w-4 h-4 mt-0.5 shrink-0" /> {ex.notes}
                  </p>
                )}
                {done > 0 && (
                  <p className={cn("text-sm font-medium flex items-center gap-1.5", done >= total ? "text-emerald-500" : "text-primary")}>
                    <CheckCircleIcon className="w-4 h-4" />
                    {done >= total ? "Terminado" : `${done} de ${total} series hechas`}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RoutinePreview({
  progress, onStart, starting, error, back, intro, children, withSidebar = true,
}: {
  progress: WorkoutProgress
  onStart: () => void
  starting?: boolean
  error?: string
  back?: { href: string; label: string }
  /** Texto que explica cómo funciona la pantalla; si se omite se usa el del atleta. */
  intro?: React.ReactNode
  /** Encabezado propio (p. ej. quién comparte la rutina en un enlace de invitado). */
  children?: React.ReactNode
  withSidebar?: boolean
}) {
  const [video, setVideo] = useState<WorkoutExercise | null>(null)
  const total = totalSets(progress.exercises)
  const groups = groupForPreview(progress.exercises)
  const exerciseCount = groups.reduce((n, g) => n + (g.kind === "circuit" ? g.exercises.length : 1), 0)

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-6 pb-40">
      {back && <BackLink href={back.href} label={back.label} />}
      {children}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold leading-tight">{sc(progress.routineName ?? "Rutina")}</h1>
        <p className="text-base text-muted-foreground flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          {exerciseCount} ejercicios · {total} series en total
        </p>
      </div>

      <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-base leading-relaxed">
        {intro ?? (
          <>
            Antes de empezar, puedes tocar cada ejercicio para <strong>ver el video</strong> de cómo se hace.
            Cuando estés listo, pulsa <strong>Empezar rutina</strong>.
          </>
        )}
      </div>

      <div className="space-y-3">
        {groups.map((g, i) =>
          g.kind === "circuit" ? (
            <CircuitOverviewCard
              key={g.blockId}
              blockName={g.blockName}
              rounds={g.rounds}
              exercises={g.exercises}
              allExercises={g.allExercises}
              onWatch={setVideo}
            />
          ) : (
            <ExerciseOverviewCard key={g.exercise.id} exercise={g.exercise} index={i} onWatch={() => setVideo(g.exercise)} />
          ),
        )}
      </div>

      <div className={cn(
        "fixed bottom-0 left-0 right-0 px-4 py-4 bg-background/95 backdrop-blur-sm border-t border-border z-30",
        withSidebar && "lg:left-56",
      )}>
        <div className="max-w-xl mx-auto">
          <button
            onClick={onStart}
            disabled={starting}
            className="w-full flex items-center justify-center gap-3 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <PlayIcon className="w-6 h-6 fill-current" />
            {starting ? "Preparando…" : "Empezar rutina"}
          </button>
          {error && <p className="text-base text-destructive text-center mt-2">{error}</p>}
        </div>
      </div>

      {video && <VideoModal exercise={video} onClose={() => setVideo(null)} />}
    </div>
  )
}

// ─── Ejecución ─────────────────────────────────────────────────────────────────

export function WorkoutRunner({
  progress, rms = {}, onRecordSet, onFinish, doneView, exit, withSidebar = true,
}: {
  progress: WorkoutProgress
  /** Máximos del atleta por ejercicio, para traducir el %RM a libras. */
  rms?: Record<string, string>
  onRecordSet: (input: RecordSetInput) => Promise<unknown>
  /** Se llama una sola vez cuando ya no quedan series pendientes. */
  onFinish: () => void
  /** Pantalla final: el atleta vuelve a sus rutinas, el invitado crea su cuenta. */
  doneView: (stats: { exercises: number; sets: number }) => React.ReactNode
  exit?: { href: string; label: string }
  withSidebar?: boolean
}) {
  // Mientras se está entrenando, la pantalla debe ocupar todo el espacio: sin sidebar
  // ni topbar de la app, así la única salida es el propio botón de salir (`exit`).
  useFullscreenWhileMounted(true)

  const [rest, setRest] = useState<{ left: number; total: number; overtime: number | null } | null>(null)
  const [showOverview, setShowOverview] = useState(false)
  const [video, setVideo] = useState<WorkoutExercise | null>(null)
  // Se apaga por defecto en cada sesión de entrenamiento; si el atleta lo activa en un
  // descanso, se mantiene activo para los siguientes descansos de esta misma sesión.
  const [autoContinue, setAutoContinue] = useState(false)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoContinueRef = useRef(autoContinue)
  autoContinueRef.current = autoContinue

  // Al abrir la vista de progreso metemos una entrada de historial propia, así el
  // gesto de "regresar" del navegador/celular cierra esa vista en vez de sacar
  // al atleta de la rutina.
  useEffect(() => {
    function onPopState() { setShowOverview(false) }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  function openOverview() {
    window.history.pushState({ atletaOverview: true }, "")
    setShowOverview(true)
  }

  function closeOverview() {
    window.history.back()
  }

  function startRest(seconds: number) {
    if (restRef.current) clearInterval(restRef.current)
    setRest({ left: seconds, total: seconds, overtime: null })
    restRef.current = setInterval(() => {
      setRest((prev) => {
        if (!prev) return prev
        if (prev.overtime !== null) return { ...prev, overtime: prev.overtime + 1 }
        if (prev.left <= 1) {
          vibrate([200, 100, 200])
          if (autoContinueRef.current) {
            clearInterval(restRef.current!)
            return null
          }
          return { ...prev, left: 0, overtime: 0 }
        }
        return { ...prev, left: prev.left - 1 }
      })
    }, 1000)
  }

  function skipRest() {
    if (restRef.current) clearInterval(restRef.current)
    setRest(null)
  }

  useEffect(() => () => { if (restRef.current) clearInterval(restRef.current) }, [])

  const position = findCurrentPosition(progress.exercises)
  const total    = totalSets(progress.exercises)
  const done     = doneSets(progress.exercises)

  if (!position) {
    return (
      <AllDone onFinish={onFinish} workoutId={progress.id}>
        {doneView({ exercises: progress.exercises.length, sets: done })}
      </AllDone>
    )
  }

  if (showOverview) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-32">
        <button
          onClick={closeOverview}
          className="inline-flex items-center gap-2 px-3 py-2.5 -ml-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
        >
          <ArrowLeftIcon className="w-5 h-5" /> {rest ? "Volver al descanso" : "Volver al ejercicio"}
        </button>
        <div>
          <h1 className="text-3xl font-bold">{sc(progress.routineName ?? "Rutina")}</h1>
          <p className="text-base text-muted-foreground mt-1">{done} de {total} series hechas</p>
        </div>
        <div className="space-y-3">
          {groupForPreview(progress.exercises).map((g, i) =>
            g.kind === "circuit" ? (
              <CircuitOverviewCard
                key={g.blockId}
                blockName={g.blockName}
                rounds={g.rounds}
                exercises={g.exercises}
                allExercises={g.allExercises}
                current={position.exercise}
                onWatch={setVideo}
              />
            ) : (
              <ExerciseOverviewCard
                key={g.exercise.id}
                exercise={g.exercise}
                index={i}
                onWatch={() => setVideo(g.exercise)}
                highlight={g.exercise.id === position.exercise.id ? "current" : doneFor(g.exercise) >= g.exercise.targets.length ? "done" : undefined}
              />
            ),
          )}
        </div>
        {video && <VideoModal exercise={video} onClose={() => setVideo(null)} />}
      </div>
    )
  }

  if (rest) {
    return (
      <RestTimer
        seconds={rest.left}
        totalSeconds={rest.total}
        overtime={rest.overtime}
        upcoming={
          position.exercise.roundNumber
            ? `${position.exercise.exerciseName} · ronda ${position.exercise.roundNumber} de ${position.exercise.rounds}`
            : `${position.exercise.exerciseName} · serie ${position.target.setNumber} de ${position.exercise.targets.length}`
        }
        onSkip={skipRest}
        autoContinue={autoContinue}
        onToggleAutoContinue={setAutoContinue}
        onShowOverview={openOverview}
        withSidebar={withSidebar}
      />
    )
  }

  const { exercise: curEx, target: curTarget, exerciseIdx } = position
  const rmLbs = rms[curEx.exerciseId] ?? null

  return (
    <SetExecution
      key={curTarget.id}
      exercise={curEx}
      target={curTarget}
      exerciseIdx={exerciseIdx}
      totalExercises={progress.exercises.length}
      totalSetsGlobal={total}
      doneSetsGlobal={done}
      defaultWeight={calcWeight(curTarget.targetPercent, rmLbs)}
      exit={exit}
      onShowOverview={openOverview}
      onRecordSet={onRecordSet}
      onRecorded={(isLastSet) => {
        vibrate(60)
        if (!isLastSet) startRest(curEx.restSeconds ?? DEFAULT_REST_SECONDS)
      }}
      withSidebar={withSidebar}
    />
  )
}

// ─── Set execution ─────────────────────────────────────────────────────────────

function SetExecution({
  exercise, target, exerciseIdx, totalExercises, totalSetsGlobal, doneSetsGlobal,
  defaultWeight, exit, onRecordSet, onRecorded, onShowOverview, withSidebar,
}: {
  exercise: WorkoutExercise
  target: WorkoutTarget
  exerciseIdx: number
  totalExercises: number
  totalSetsGlobal: number
  doneSetsGlobal: number
  defaultWeight: string
  exit?: { href: string; label: string }
  onRecordSet: (input: RecordSetInput) => Promise<unknown>
  onRecorded: (isLastSet: boolean) => void
  onShowOverview: () => void
  withSidebar: boolean
}) {
  const isTime = isTimeTarget(target)
  const freeReps = !isTime && target.targetReps == null
  const [reps, setReps] = useState(8)
  const [showNotes, setShowNotes] = useState(false)
  const [timerPhase, setTimerPhase] = useState<CountdownPhase>("idle")
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const timerPreparing = isTime && timerPhase === "prepare"
  const timerRunning = isTime && (timerPhase === "running" || timerPhase === "paused")
  const timerFinished = isTime && timerPhase === "finished"
  const timerAlert = timerPreparing || timerFinished

  const progressPct = totalSetsGlobal > 0 ? Math.round((doneSetsGlobal / totalSetsGlobal) * 100) : 0
  const tempoText = exercise.tempo ? explainTempo(exercise.tempo) : null

  async function handleComplete() {
    if (saving) return
    setSaving(true)
    setFailed(false)
    try {
      await onRecordSet({
        exercise,
        target,
        reps: isTime ? 0 : target.targetReps ?? reps,
        weightLbs: defaultWeight || "0",
      })
      onRecorded(doneSetsGlobal + 1 >= totalSetsGlobal)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn("flex flex-col", screenHeight(withSidebar))}>
      {/* ── Cabecera: progreso ── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="h-2 bg-muted/40" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3 px-4 py-2">
          {exit ? <BackLink href={exit.href} label={exit.label} /> : <span />}
          <p className="text-base text-muted-foreground">
            Ejercicio <strong className="text-foreground">{exerciseIdx + 1}</strong> de {totalExercises}
          </p>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 w-full max-w-xl mx-auto px-4 pt-5 pb-40 space-y-5">
        <div className="space-y-1">
          {exercise.blockName && (
            <p className="text-base text-primary font-medium flex items-center gap-1.5">
              <RepeatIcon className="w-4 h-4" /> {exercise.blockName}
              {exercise.roundNumber
                ? ` · ronda ${exercise.roundNumber} de ${exercise.rounds}`
                : exercise.rounds > 1 && ` · ${exercise.rounds} vueltas`}
            </p>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold leading-tight">{exercise.exerciseName}</h1>
            {exercise.notes && (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="relative shrink-0 w-8 h-8 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 flex items-center justify-center cursor-pointer"
                aria-label="Ver indicaciones de tu entrenador"
              >
                <InfoIcon className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500" />
              </button>
            )}
          </div>
        </div>

        {exercise.youtubeVideoId ? (
          <YouTubePlayer
            videoId={exercise.youtubeVideoId}
            title={exercise.exerciseName}
            orientation={exercise.videoOrientation}
            large
            compact
          />
        ) : (
          <p className="text-base text-muted-foreground border border-dashed border-border rounded-2xl p-4">
            Este ejercicio no tiene video.
          </p>
        )}

        {/* Objetivo de la serie */}
        <div
          className={cn(
            "rounded-2xl border-2 bg-card p-5 text-center space-y-3 transition-colors duration-700",
            timerAlert ? "border-destructive/60" : timerRunning ? "border-emerald-500/60" : "border-primary/40",
          )}
        >
          <p
            className={cn(
              "text-xl font-semibold transition-colors duration-500",
              timerAlert ? "text-destructive" : timerRunning ? "text-emerald-500" : "text-primary",
            )}
          >
            Serie {target.setNumber} de {exercise.targets.length}
          </p>

          {isTime ? (
            <TimeCountdown
              seconds={target.targetDurationSeconds ?? 30}
              phase={timerPhase}
              onPhaseChange={setTimerPhase}
            />
          ) : freeReps ? (
            <div className="space-y-2">
              <p className="text-base text-muted-foreground">Haz las que puedas y anota cuántas fueron:</p>
              <RepsStepper value={reps} onChange={setReps} />
            </div>
          ) : (
            <p>
              <span className="block text-7xl font-bold leading-none tabular-nums">{target.targetReps}</span>
              <span className="block text-2xl mt-1">{target.targetReps === 1 ? "repetición" : "repeticiones"}</span>
            </p>
          )}

          {defaultWeight && (
            <p className="text-xl">
              con <strong>{defaultWeight} lbs</strong>
              <span className="text-base text-muted-foreground"> ({target.targetPercent}% de tu máximo)</span>
            </p>
          )}
        </div>

        {/* Indicaciones */}
        {(tempoText || exercise.restSeconds) && (
          <div className="space-y-2 text-base">
            {tempoText && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <TimerIcon className="w-5 h-5 mt-0.5 shrink-0" /> <span><strong className="text-foreground">Ritmo:</strong> {tempoText}</span>
              </p>
            )}
            {exercise.restSeconds && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <PauseIcon className="w-5 h-5 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground">Descanso:</strong> {formatDuration(exercise.restSeconds)}{" "}
                  {exercise.blockName ? "antes del siguiente ejercicio" : "entre series"}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {showNotes && exercise.notes && <NotesModal notes={exercise.notes} onClose={() => setShowNotes(false)} />}

      <ExecutionFooter
        primaryLabel={saving ? "Guardando…" : "Terminé esta serie"}
        primaryIcon={<CheckIcon className="w-7 h-7" strokeWidth={3} />}
        onPrimary={handleComplete}
        primaryPending={saving}
        primaryError={failed ? "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo." : undefined}
        onShowOverview={onShowOverview}
        withSidebar={withSidebar}
      />
    </div>
  )
}

// ─── Pie de página fijo (nunca se mueve ni desaparece al hacer scroll) ─────────

function ExecutionFooter({
  primaryLabel, primaryIcon, onPrimary, primaryPending, primaryError, primaryVariant = "primary", onShowOverview, withSidebar,
}: {
  primaryLabel: string
  primaryIcon: React.ReactNode
  onPrimary: () => void
  primaryPending?: boolean
  primaryError?: string
  primaryVariant?: "primary" | "destructive"
  onShowOverview: () => void
  withSidebar: boolean
}) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm",
      withSidebar && "lg:left-56",
    )}>
      <div className="max-w-xl mx-auto px-4 py-3 space-y-2">
        <button
          onClick={onPrimary}
          disabled={primaryPending}
          className={cn(
            "w-full flex items-center justify-center gap-3 min-h-16 rounded-2xl font-bold text-xl cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-50",
            primaryVariant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {primaryIcon} {primaryLabel}
        </button>
        {primaryError && <p className="text-base text-destructive text-center">{primaryError}</p>}
        <button
          onClick={onShowOverview}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
        >
          <ListIcon className="w-5 h-5" /> Ver toda la rutina
        </button>
      </div>
    </div>
  )
}

function RepsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-16 h-16 rounded-2xl border-2 border-border flex items-center justify-center cursor-pointer active:scale-95"
        aria-label="Una menos"
      >
        <MinusIcon className="w-7 h-7" />
      </button>
      <span className="text-6xl font-bold tabular-nums w-24">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-16 h-16 rounded-2xl border-2 border-border flex items-center justify-center cursor-pointer active:scale-95"
        aria-label="Una más"
      >
        <PlusIcon className="w-7 h-7" />
      </button>
    </div>
  )
}

type CountdownPhase = "idle" | "prepare" | "running" | "paused" | "finished"

function TimeCountdown({
  seconds, phase, onPhaseChange,
}: {
  seconds: number
  phase: CountdownPhase
  onPhaseChange: (phase: CountdownPhase) => void
}) {
  const [prepareLeft, setPrepareLeft] = useState(3)
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    if (phase !== "prepare") return
    vibrate(60)
    if (prepareLeft <= 1) {
      const id = setTimeout(() => {
        onPhaseChange("running")
        vibrate(120)
      }, 1000)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setPrepareLeft((prev) => prev - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, prepareLeft, onPhaseChange])

  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          onPhaseChange("finished")
          vibrate([300, 150, 300])
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, onPhaseChange])

  function handleStart() {
    setPrepareLeft(3)
    onPhaseChange("prepare")
  }

  function handleTogglePause() {
    onPhaseChange(phase === "running" ? "paused" : "running")
  }

  function handleReset() {
    onPhaseChange("idle")
    setPrepareLeft(3)
    setLeft(seconds)
  }

  const isPreparing = phase === "prepare"
  const isRunning = phase === "running" || phase === "paused"
  const finished = phase === "finished"
  const started = phase !== "idle"

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-2xl py-5 transition-colors duration-700",
          isPreparing && "bg-destructive/10",
          isRunning && "bg-emerald-500/10",
          finished && "bg-destructive/10",
        )}
      >
        <span
          className={cn(
            "block text-7xl font-bold leading-none tabular-nums transition-colors duration-500",
            isPreparing && "text-destructive",
            isRunning && "text-emerald-500",
            finished && "text-destructive",
          )}
        >
          {isPreparing
            ? prepareLeft
            : Math.floor(left / 60) > 0
              ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
              : left}
        </span>
        <span className="block text-2xl mt-1">
          {isPreparing ? "prepárate…" : finished ? "¡Tiempo!" : "segundos"}
        </span>
      </div>
      <div className="flex justify-center gap-3">
        {phase === "idle" && (
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-secondary text-lg font-semibold cursor-pointer"
          >
            <PlayIcon className="w-5 h-5" /> Empezar a contar
          </button>
        )}
        {isRunning && (
          <button
            type="button"
            onClick={handleTogglePause}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-secondary text-lg font-semibold cursor-pointer"
          >
            {phase === "running" ? <><PauseIcon className="w-5 h-5" /> Pausar</> : <><PlayIcon className="w-5 h-5" /> Seguir</>}
          </button>
        )}
        {started && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-border text-lg cursor-pointer"
          >
            <RotateCcwIcon className="w-5 h-5" /> Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Rest timer ────────────────────────────────────────────────────────────────

function formatClock(totalSeconds: number): string {
  return totalSeconds >= 60 ? `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}` : String(totalSeconds)
}

function RestTimer({
  seconds, totalSeconds, overtime, upcoming, onSkip, autoContinue, onToggleAutoContinue, onShowOverview, withSidebar,
}: {
  seconds: number
  totalSeconds: number
  overtime: number | null
  upcoming: string
  onSkip: () => void
  autoContinue: boolean
  onToggleAutoContinue: (v: boolean) => void
  onShowOverview: () => void
  withSidebar: boolean
}) {
  const isOvertime = overtime !== null
  const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0
  const circumference = 2 * Math.PI * 54

  return (
    <div className={cn("flex flex-col items-center justify-center gap-8 px-6 pt-8 pb-40 text-center", screenHeight(withSidebar))}>
      <div className="space-y-2">
        <p className="text-3xl font-bold">{isOvertime ? "¡Descanso terminado!" : "¡Bien hecho! Descansa"}</p>
        <p className="text-lg text-muted-foreground">
          {isOvertime ? "Continúa cuando estés listo." : "Respira tranquilo antes de la siguiente serie."}
        </p>
      </div>

      <div className="relative w-56 h-56" role="timer" aria-live="polite">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke="currentColor" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isOvertime ? 0 : circumference * (1 - pct / 100)}
            className={cn("transition-all duration-1000", isOvertime ? "text-destructive" : "text-primary")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-6xl font-bold tabular-nums", isOvertime && "text-destructive")}>
            {formatClock(isOvertime ? overtime! : seconds)}
          </span>
          <span className={cn("text-lg", isOvertime ? "text-destructive" : "text-muted-foreground")}>
            {isOvertime ? "descanso extra" : seconds >= 60 ? "minutos" : "segundos"}
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-muted/40 px-5 py-3 text-lg">
        <span className="text-muted-foreground">Lo siguiente: </span>
        <strong>{upcoming}</strong>
      </div>

      <label className="flex items-center gap-2 text-base text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={autoContinue}
          onChange={(e) => onToggleAutoContinue(e.target.checked)}
          className="w-5 h-5 accent-primary cursor-pointer"
          aria-label="Continuar automáticamente al terminar el descanso"
        />
        Continuar automáticamente
      </label>

      <ExecutionFooter
        primaryLabel={isOvertime ? "Siguiente" : "Ya descansé, continuar"}
        primaryIcon={<PlayIcon className="w-6 h-6 fill-current" />}
        onPrimary={onSkip}
        primaryVariant={isOvertime ? "destructive" : "primary"}
        onShowOverview={onShowOverview}
        withSidebar={withSidebar}
      />
    </div>
  )
}

// ─── All done ──────────────────────────────────────────────────────────────────

function AllDone({ onFinish, workoutId, children }: {
  onFinish: () => void
  workoutId: string
  children: React.ReactNode
}) {
  useEffect(() => {
    onFinish()
    // Solo al llegar aquí: `onFinish` cierra el entrenamiento y no debe repetirse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId])

  return <>{children}</>
}

/** Pantalla de felicitación reutilizable; el CTA lo pone quien la usa. */
export function WorkoutCelebration({
  exercises, sets, children, withSidebar = true,
}: {
  exercises: number
  sets: number
  children: React.ReactNode
  withSidebar?: boolean
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-8 px-6 py-8 text-center", screenHeight(withSidebar))}>
      <div className="w-28 h-28 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
        <CheckCircleIcon className="w-14 h-14 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">¡Rutina terminada!</h1>
        <p className="text-xl text-muted-foreground">
          Hiciste {exercises} ejercicios y {sets} series. ¡Excelente trabajo!
        </p>
      </div>
      {children}
    </div>
  )
}

// ─── Historial ─────────────────────────────────────────────────────────────────

export function WorkoutSummary({
  progress, back, note,
}: {
  progress: WorkoutProgress
  back?: { href: string; label: string }
  note?: React.ReactNode
}) {
  const [video, setVideo] = useState<WorkoutExercise | null>(null)
  const isCancelled = progress.status === "cancelled"
  const validSets = progress.exercises.reduce((s, ex) => s + ex.sets.filter((r) => r.status === "valid").length, 0)

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-6">
      {back && <BackLink href={back.href} label={back.label} />}

      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{sc(progress.routineName ?? "Rutina")}</h1>
        <p className="text-base text-muted-foreground">
          {sc(new Date(progress.startedAt).toLocaleString("es", { dateStyle: "full", timeStyle: "short" }))}
        </p>
      </div>

      {note}

      {isCancelled ? (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-base">Esta rutina fue cancelada por tu entrenador.</div>
      ) : validSets > 0 && (
        <div className="flex items-center gap-3 p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-2xl">
          <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
          <p className="text-lg font-medium">{validSets} series completadas</p>
        </div>
      )}

      <div className="space-y-3">
        {progress.exercises.map((ex, i) => (
          <div key={ex.id} className="space-y-0">
            <ExerciseOverviewCard exercise={ex} index={i} onWatch={() => setVideo(ex)} />
            {ex.sets.length > 0 && (
              <div className="mx-3 border border-t-0 border-border rounded-b-2xl divide-y divide-border">
                {ex.sets.map((s) => {
                  const target = ex.targets.find((t) => t.id === s.sessionSetTargetId)
                  return (
                    <div key={s.id} className={cn("flex items-center gap-4 px-4 py-3 text-base", s.status === "invalid" && "opacity-50")}>
                      <span className="text-muted-foreground w-20 shrink-0">Serie {s.setNumber}</span>
                      <span className="font-semibold">
                        {target && isTimeTarget(target) ? describeTarget(target) : `${s.reps} repeticiones`}
                      </span>
                      {Number(s.weightLbs) > 0 && <span className="text-muted-foreground">{s.weightLbs} lbs</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {video && <VideoModal exercise={video} onClose={() => setVideo(null)} />}
    </div>
  )
}
