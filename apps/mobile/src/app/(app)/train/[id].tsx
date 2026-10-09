// Ejecutor de la rutina: serie en curso → descanso → siguiente serie, hasta terminar.
// Todo cabe en una pantalla, sin scroll. El pie tiene dos botones a la misma altura:
// el secundario (izquierda) es casi siempre "Atrás" y el primario (derecha) avanza el flujo.
// Mismo flujo que WorkoutRunner de la web (apps/web/src/components/workout-runner.tsx),
// con lo nativo del teléfono: pantalla siempre encendida, pitidos, vibración y un
// aviso del sistema si el descanso termina con la app en segundo plano.
import { Button } from "@/components/button"
import { Text } from "@/components/text"
import { FinishCelebration } from "@/components/workout/finish-celebration"
import { PrimaryAction, SecondaryAction, type ActionTone } from "@/components/workout/action-button"
import { RestTimer } from "@/components/workout/rest-timer"
import { RoutineDrop } from "@/components/workout/routine-drop"
import { SetExecution } from "@/components/workout/set-execution"
import { useSetCountdown } from "@/components/workout/time-countdown"
import { VideoModal } from "@/components/workout/video"
import { useSession } from "@/lib/auth"
import { feedback, prepareSounds, setSoundEnabled, useSoundEnabled } from "@/lib/feedback"
import { cancelTimerAlert, ensureNotificationPermission, scheduleTimerAlert } from "@/lib/notifications"
import { clearRestCountdown, showRestCountdown } from "@/lib/rest-notification"
import { colors, radiusLg } from "@/lib/theme"
import { setTrainView, useTrainView } from "@/lib/train-view"
import { trpc } from "@/lib/trpc"
import { useRemainingMs, useSecondTicks } from "@/lib/use-countdown"
import {
  calcWeight, DEFAULT_REST_SECONDS, doneSets, findCurrentPosition, groupForPreview, sc, totalSets,
  type WorkoutExercise, type WorkoutTarget,
} from "@/lib/workout"
import { isTimeTarget } from "@/lib/workout-text"
import { useKeepAwake } from "expo-keep-awake"
import { router, useLocalSearchParams } from "expo-router"
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Columns2, MessageSquare, Pause, Play,
  RotateCcw, Rows2, SkipForward, Volume2, VolumeX, X,
} from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

type Rest = { endAt: number; total: number; upcoming: string }
// Paso del flujo: una serie o el descanso que sigue a esa serie (i = índice en la lista plana)
type Action = { label: string; icon: typeof Check; onPress: () => void; disabled?: boolean; tone?: ActionTone }
type Step = { kind: "set" | "rest"; i: number }

function upcomingLabel(p: { exercise: WorkoutExercise; target: WorkoutTarget }) {
  return p.exercise.roundNumber
    ? `${p.exercise.exerciseName} · ronda ${p.exercise.roundNumber} de ${p.exercise.rounds}`
    : `${p.exercise.exerciseName} · serie ${p.target.setNumber} de ${p.exercise.targets.length}`
}

export default function TrainScreen() {
  useKeepAwake()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: auth } = useSession()
  const userId = auth?.user.id ?? ""
  const utils = trpc.useUtils()

  // Se refresca por si el coach agrega o cancela ejercicios durante la sesión
  const { data: progress, isLoading, isError, refetch } = trpc.sessions.myProgress.useQuery(
    { sessionId: id },
    { refetchInterval: 15_000 },
  )
  const { data: rms } = trpc.sessions.athleteRms.useQuery({ sessionId: id, athleteId: userId }, { enabled: !!userId })
  const recordSet = trpc.sessions.recordSet.useMutation()
  const complete = trpc.sessions.completeMySession.useMutation({
    onSuccess: () => utils.sessions.myMomentum.invalidate(),
    onSettled: () => utils.sessions.myPending.invalidate(),
  })

  const [rest, setRest] = useState<Rest | null>(null)
  // Apagado al empezar cada sesión; si el atleta lo activa, sigue activo en los siguientes descansos
  const [autoContinue, setAutoContinue] = useState(false)
  const [overview, setOverview] = useState(false)
  const [notes, setNotes] = useState(false)
  const [video, setVideo] = useState<WorkoutExercise | null>(null)
  const [reps, setReps] = useState(8)
  // Paso (serie o descanso) que el atleta está repasando con "Atrás" (solo vista: no toca lo guardado).
  // id = la serie a la que pertenece el paso; en un descanso, la serie que lo precede
  const [viewStep, setViewStep] = useState<{ kind: Step["kind"]; id: string } | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { width } = useWindowDimensions()
  const view = useTrainView()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const restAlert = useRef<Promise<string | null> | null>(null)
  // Acción del pie que espera a que termine de cerrarse la rutina completa
  const pendingAction = useRef<{ which: "primary" | "secondary"; sig: string } | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const footerActions = useRef<{ primary: Action; secondary: Action; sig: string } | null>(null)
  const soundOn = useSoundEnabled()

  useEffect(() => {
    prepareSounds()
    ensureNotificationPermission()
    return () => {
      cancelTimerAlert(restAlert.current)
      clearRestCountdown()
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [])

  const position = progress ? findCurrentPosition(progress.exercises) : null

  // Todas las series en orden de ejecución; sirve para "Atrás" y para los rótulos del botón
  const flat = progress
    ? progress.exercises.flatMap((exercise, exerciseIdx) => exercise.targets.map((target) => ({ exercise, target, exerciseIdx })))
    : []
  // Pasos en orden: serie, su descanso (si el ejercicio descansa y no es la última serie), serie…
  const steps: Step[] = flat.flatMap((f, i) => {
    const out: Step[] = [{ kind: "set", i }]
    if (i < flat.length - 1 && (f.exercise.restSeconds ?? DEFAULT_REST_SECONDS) > 0) out.push({ kind: "rest", i })
    return out
  })
  const posIdx = position ? flat.findIndex((f) => f.target.id === position.target.id) : -1
  const liveIdx = steps.findIndex((st) => st.kind === "set" && st.i === posIdx)
  const viewIdx = viewStep ? steps.findIndex((st) => st.kind === viewStep.kind && flat[st.i].target.id === viewStep.id) : -1
  const reviewing = viewIdx >= 0 && viewIdx !== liveIdx
  // Un descanso en curso sin repasar es el que sigue a la última serie hecha
  const liveRestIdx = rest ? steps.findIndex((st) => st.kind === "rest" && st.i === posIdx - 1) : -1
  const stepIdx = reviewing ? viewIdx : liveRestIdx >= 0 ? liveRestIdx : liveIdx
  const step = steps[stepIdx]
  // En un descanso se muestra el encabezado de lo que viene después, igual que al hacerlo en vivo
  const shown = step ? flat[step.kind === "rest" ? step.i + 1 : step.i] ?? position : position
  const shownIdx = shown ? flat.findIndex((f) => f.target.id === shown.target.id) : -1

  const countdown = useSetCountdown(shown?.target.targetDurationSeconds ?? 30, shown?.exercise.exerciseName ?? "", !!shown?.exercise.perSide)
  const shownTargetId = shown?.target.id
  useEffect(() => {
    setReps(8)
    setFailed(false)
    setVideoPlaying(false)
    countdown.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownTargetId])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // ─── Descanso ───
  const restMs = useRemainingMs(rest?.endAt ?? null)
  const restSeconds = restMs == null ? null : Math.ceil(restMs / 1000)
  useSecondTicks(restSeconds, (s) => {
    if (s >= 1 && s <= 3) feedback.tick()
    if (s === 0) feedback.timeUp()
  })

  const endRest = useCallback(() => {
    cancelTimerAlert(restAlert.current)
    restAlert.current = null
    clearRestCountdown()
    setRest(null)
  }, [])

  // Siempre apunta al último render: el auto-continuar necesita el paso actual
  const finishRestRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (rest && restMs != null && restMs <= 0 && autoContinue) finishRestRef.current()
  }, [rest, restMs, autoContinue])

  function startRest(seconds: number, upcoming: string) {
    const endAt = Date.now() + seconds * 1000
    setRest({ endAt, total: seconds, upcoming })
    restAlert.current = scheduleTimerAlert(endAt, "Descanso terminado", `Sigue: ${upcoming}`)
    // También en descansos repasados con "Atrás": son un temporizador real. Al terminar se quita sola
    showRestCountdown(endAt, upcoming)
  }

  // ─── "Atrás" y "Siguiente" al repasar: solo cambian lo que se ve, nunca lo guardado ───
  // Un descanso repasado es solo un temporizador: no crea ni toca ninguna serie ni llama al servidor
  function goToStep(idx: number) {
    const st = steps[idx]
    if (!st) return
    endRest()
    countdown.reset()
    setVideoPlaying(false)
    if (idx === liveIdx) {
      setViewStep(null)
    } else if (st.kind === "rest") {
      const from = flat[st.i]
      const upcoming = flat[st.i + 1]
      setViewStep({ kind: "rest", id: from.target.id })
      startRest(from.exercise.restSeconds ?? DEFAULT_REST_SECONDS, upcomingLabel(upcoming))
    } else {
      setViewStep({ kind: "set", id: flat[st.i].target.id })
    }
  }
  const goBack = () => { if (stepIdx > 0) goToStep(stepIdx - 1) }
  const goNext = () => goToStep(stepIdx + 1)

  // Terminar el descanso: en vivo solo se cierra; repasando, sigue el paso que le toca
  function finishRest() {
    if (reviewing) goToStep(stepIdx + 1)
    else endRest()
  }
  finishRestRef.current = finishRest

  // ─── Salir ───
  const confirmExit = useCallback(() => {
    Alert.alert(
      "¿Salir del entrenamiento?",
      "Tu avance queda guardado. Puedes continuar después desde Mis rutinas.",
      [
        { text: "Seguir entrenando", style: "cancel" },
        { text: "Salir", style: "destructive", onPress: () => { endRest(); router.back() } },
      ],
    )
  }, [endRest])

  const finished = !!progress && (progress.status === "active" || progress.status === "completed") && !position
  useEffect(() => {
    if (finished) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pendingAction.current) return true // ya se está cerrando para ejecutar una acción
      if (overview) setOverview(false)
      else confirmExit()
      return true
    })
    return () => sub.remove()
  }, [confirmExit, finished, overview])

  // ─── Fin de la rutina ───
  const completedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!finished || !progress || completedFor.current === progress.id) return
    completedFor.current = progress.id
    endRest()
    // El sonido y los hápticos del cierre los maneja la celebración
    if (progress.status === "active") complete.mutate({ sessionId: progress.id })
  }, [finished, progress, complete, endRest])

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
  }
  if (isError || !progress) {
    return (
      <SafeAreaView style={[styles.center, { gap: 16, padding: 24 }]}>
        <Text size={18} center>No pudimos cargar tu rutina.</Text>
        <Button label="Reintentar" onPress={() => refetch()} />
        <Button label="Volver" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    )
  }

  const total = totalSets(progress.exercises)
  const done = doneSets(progress.exercises)

  if (finished) {
    const exerciseCount = groupForPreview(progress.exercises)
      .reduce((n, g) => n + (g.kind === "circuit" ? g.exercises.length : 1), 0)
    // Sin llamada a completeMySession y ya completa: se terminó antes de abrir esta pantalla
    const alreadyCompleted = progress.status === "completed" && complete.isIdle
    return (
      <FinishCelebration
        exerciseCount={exerciseCount}
        setCount={done}
        completion={{
          settled: alreadyCompleted || complete.isSuccess || complete.isError,
          completedAt: complete.data?.completedAt ? new Date(complete.data.completedAt).toISOString() : null,
          alreadyCompleted,
          failed: complete.isError,
        }}
        onBack={() => router.dismissTo("/")}
      />
    )
  }

  if (!position || progress.status !== "active") {
    // Aún no empieza (la vista previa la inicia) o el coach la canceló
    return (
      <SafeAreaView style={[styles.center, { gap: 16, padding: 24 }]}>
        <Text size={18} center>
          {progress.status === "cancelled" ? "Tu entrenador canceló esta rutina." : "Esta rutina aún no empieza."}
        </Text>
        <Button label="Volver" onPress={() => router.back()} />
      </SafeAreaView>
    )
  }

  const { exercise, target, exerciseIdx } = shown ?? position
  const weight = calcWeight(target.targetPercent, rms?.[exercise.exerciseId])
  const pct = total > 0 ? done / total : 0
  const restOvertime = restMs != null && restMs <= 0
  const isTime = isTimeTarget(target)
  const recorded = exercise.sets.find((set) => set.sessionSetTargetId === target.id)
  const shownReps = reviewing ? recorded?.reps ?? reps : reps

  async function handleComplete() {
    if (saving) return
    setSaving(true)
    setFailed(false)
    try {
      const set = await recordSet.mutateAsync({
        sessionId: id,
        athleteId: userId,
        sessionExerciseId: exercise.id,
        sessionSetTargetId: target.id,
        setNumber: target.setNumber,
        reps: target.setType === "time" ? 0 : target.targetReps ?? reps,
        weightLbs: weight || "0",
      })
      // La serie aparece hecha al instante; luego se confirma con el servidor
      const next = progress!.exercises.map((ex) => (ex.id === exercise.id ? { ...ex, sets: [...ex.sets, set] } : ex))
      utils.sessions.myProgress.setData({ sessionId: id }, (old) => (old ? { ...old, exercises: next } : old))
      utils.sessions.myProgress.invalidate({ sessionId: id })
      feedback.setDone()
      countdown.reset()
      const nextPos = findCurrentPosition(next)
      const restFor = exercise.restSeconds ?? DEFAULT_REST_SECONDS
      if (nextPos && restFor > 0) startRest(restFor, upcomingLabel(nextPos))
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  function startTimer() {
    // Al empezar el tiempo el video se detiene por completo (se desmonta el reproductor, con su audio)
    setVideoPlaying(false)
    countdown.start()
  }

  // ─── Botones del pie ───
  const isLast = shownIdx >= 0 && shownIdx === flat.length - 1
  const nextInFlat = flat[shownIdx + 1]
  const advanceLabel = isLast
    ? "Terminar rutina"
    : exercise.blockId
      ? nextInFlat && nextInFlat.exercise.blockId === exercise.blockId && nextInFlat.exercise.roundNumber === exercise.roundNumber
        && nextInFlat.exercise.id !== exercise.id
        ? "Siguiente ejercicio"
        : nextInFlat && nextInFlat.exercise.id === exercise.id ? "Serie hecha" : "Terminar ronda"
      : "Serie hecha"
  const advanceTone: ActionTone = isLast ? "success" : "primary"

  const back: Action = { label: "Atrás", icon: ArrowLeft, onPress: goBack, disabled: stepIdx <= 0 }
  let primary: Action
  let secondary: Action = back

  if (rest) {
    primary = { label: restOvertime ? "Siguiente" : "Ya descansé", icon: Play, tone: restOvertime ? "destructive" : "primary", onPress: finishRest }
  } else if (reviewing) {
    primary = { label: "Siguiente", icon: ArrowRight, onPress: goNext }
  } else if (isTime && countdown.phase === "idle") {
    primary = { label: "Empezar", icon: Play, onPress: startTimer }
  } else if (isTime && countdown.phase === "prepare") {
    primary = { label: "Preparando…", icon: Play, tone: "destructive", onPress: () => {}, disabled: true }
    secondary = { label: "Cancelar", icon: X, onPress: countdown.reset }
  } else if (isTime && countdown.phase === "switch") {
    // "Por cada lado": pausa corta entre lados; se puede empezar el lado 2 ya
    primary = { label: "Empezar lado 2", icon: Play, tone: "destructive", onPress: countdown.skipSide }
    secondary = { label: "Cancelar", icon: X, onPress: countdown.reset }
  } else if (isTime && countdown.phase === "running" && countdown.onFirstSide) {
    // Saltar lo que queda del lado 1 lleva al cambio de lado, no termina la serie
    primary = { label: "Terminar lado 1", icon: Check, tone: "success", onPress: countdown.skipSide }
    secondary = { label: "Pausar", icon: Pause, onPress: countdown.pause }
  } else if (isTime && countdown.phase === "running") {
    // Se puede saltar lo que queda del tiempo: la serie se guarda completa
    primary = { label: "Terminar ya", icon: Check, tone: "success", onPress: handleComplete, disabled: saving }
    secondary = { label: "Pausar", icon: Pause, onPress: countdown.pause }
  } else if (isTime && countdown.phase === "paused") {
    primary = { label: "Seguir", icon: Play, onPress: countdown.resume }
    secondary = { label: "Reiniciar", icon: RotateCcw, onPress: countdown.reset }
  } else if (isTime && countdown.phase === "finished") {
    primary = { label: saving ? "Guardando…" : advanceLabel, icon: Check, tone: "destructive", onPress: handleComplete, disabled: saving }
  } else {
    primary = { label: saving ? "Guardando…" : advanceLabel, icon: Check, tone: advanceTone, onPress: handleComplete, disabled: saving }
  }

  // Firma del paso actual: si cambia mientras se cierra la rutina, la acción ya no aplica
  const sig = `${stepIdx}|${rest ? "r" : "-"}|${countdown.phase}|${countdown.side}|${reviewing ? "v" : "-"}|${target.id}`
  footerActions.current = { primary, secondary, sig }

  // Con la rutina completa abierta, el botón primero la cierra y la acción corre al terminar la animación
  function runPending() {
    const p = pendingAction.current
    if (!p) return
    pendingAction.current = null
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    pendingTimer.current = null
    const latest = footerActions.current
    if (!latest || latest.sig !== p.sig) return
    const action = latest[p.which]
    if (!action.disabled) action.onPress()
  }

  function pressFooter(which: "primary" | "secondary") {
    if (pendingAction.current) return // toque doble mientras cierra: no se encola ni corre dos veces
    const action = which === "primary" ? primary : secondary
    if (action.disabled) return
    if (!overview) {
      action.onPress()
      return
    }
    pendingAction.current = { which, sig }
    setOverview(false)
    // Red de seguridad si el aviso de fin de animación nunca llega
    pendingTimer.current = setTimeout(runPending, 800)
  }

  function toggleOverview() {
    // Reabrir la rutina cancela la acción que estaba esperando
    pendingAction.current = null
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    pendingTimer.current = null
    setOverview((o) => !o)
  }

  const headerIconSize = 22
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* ── Cabecera: progreso ── */}
      <View style={styles.header}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <View style={styles.headerRow}>
          <Pressable onPress={confirmExit} style={styles.headerBtn} hitSlop={8} accessibilityLabel="Salir del entrenamiento">
            <X size={headerIconSize} color={colors.mutedForeground} />
            {width >= 390 && <Text size={16} color={colors.mutedForeground}>Salir</Text>}
          </Pressable>
          {/* Tocar "Ejercicio N de M" baja la rutina completa desde arriba */}
          <Pressable
            onPress={toggleOverview}
            style={styles.counter}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: overview }}
            accessibilityLabel="Ver toda la rutina"
          >
            <Text size={16} color={colors.mutedForeground} numberOfLines={1}>
              Ejercicio <Text size={16} weight="bold">{exerciseIdx + 1}</Text> de {progress.exercises.length}
            </Text>
            {overview ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
          </Pressable>
          <View style={styles.headerIcons}>
            <Pressable
              onPress={() => {
                const next = view === "split" ? "button" : "split"
                setTrainView(next)
                showToast(next === "split" ? "Vista 50-50: video y objetivo" : "Vista solo objetivo: video a demanda")
              }}
              style={[styles.iconBtn, view === "split" && styles.iconBtnOn]}
              hitSlop={4}
              accessibilityLabel={view === "split" ? "Cambiar a vista solo objetivo" : "Cambiar a vista 50-50"}
            >
              {view === "split"
                ? <Rows2 size={headerIconSize} color={colors.primary} />
                : <Columns2 size={headerIconSize} color={colors.mutedForeground} />}
            </Pressable>
            <Pressable
              onPress={() => {
                setAutoContinue(!autoContinue)
                showToast(autoContinue ? "Continuar automáticamente: apagado" : "Continuar automáticamente: activado")
              }}
              style={[styles.iconBtn, autoContinue && styles.iconBtnOn]}
              hitSlop={4}
              accessibilityLabel="Continuar automáticamente después del descanso"
              accessibilityState={{ selected: autoContinue }}
            >
              <SkipForward size={headerIconSize} color={autoContinue ? colors.primary : colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => setSoundEnabled(!soundOn)}
              style={styles.iconBtn}
              hitSlop={4}
              accessibilityLabel={soundOn ? "Silenciar sonidos" : "Activar sonidos"}
            >
              {soundOn ? <Volume2 size={headerIconSize} color={colors.foreground} /> : <VolumeX size={headerIconSize} color={colors.mutedForeground} />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Contenido (sin scroll) ── */}
      <View style={styles.body}>
        {rest && restMs != null ? (
          <RestTimer remainingMs={restMs} totalSeconds={rest.total} upcoming={rest.upcoming} />
        ) : (
          <SetExecution
            key={target.id}
            exercise={exercise}
            target={target}
            weight={weight}
            reps={shownReps}
            onRepsChange={setReps}
            countdown={countdown}
            reviewing={reviewing}
            view={view}
            videoPlaying={videoPlaying}
            onVideoPlayingChange={setVideoPlaying}
            onShowNotes={() => setNotes(true)}
          />
        )}

        {/* ── Toda la rutina: baja desde la cabecera ── */}
        <RoutineDrop
          open={overview}
          title={sc(progress.routineName ?? "Rutina")}
          done={done}
          total={total}
          exercises={progress.exercises}
          current={exercise}
          onWatch={setVideo}
          onClosed={runPending}
        />

        {toast && <View pointerEvents="none" style={styles.toast}><Text size={14}>{toast}</Text></View>}
      </View>

      {/* ── Pie fijo: secundario a la izquierda, primario a la derecha ── */}
      <View style={styles.footer}>
        {failed && <Text size={14} color={colors.destructive} center>No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.</Text>}
        <View style={styles.footerRow}>
          <SecondaryAction label={secondary.label} icon={secondary.icon} disabled={secondary.disabled} onPress={() => pressFooter("secondary")} />
          <PrimaryAction label={primary.label} icon={primary.icon} tone={primary.tone} disabled={primary.disabled} onPress={() => pressFooter("primary")} />
        </View>
      </View>

      <VideoModal exercise={video} onClose={() => setVideo(null)} />

      {/* ── Indicaciones del coach ── */}
      <Modal visible={notes && !!exercise.notes} transparent animationType="fade" onRequestClose={() => setNotes(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNotes(false)}>
          <Pressable style={styles.notesCard} onPress={() => {}}>
            <View style={styles.notesHeader}>
              <MessageSquare size={20} color={colors.warning} />
              <Text size={18} weight="semibold" style={{ flex: 1 }}>Indicaciones de tu entrenador</Text>
              <Pressable onPress={() => setNotes(false)} hitSlop={10} accessibilityLabel="Cerrar">
                <X size={20} color={colors.foreground} />
              </Pressable>
            </View>
            <Text size={16}>{exercise.notes}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { borderBottomWidth: 1, borderBottomColor: colors.border },
  progressTrack: { height: 6, backgroundColor: colors.mutedSoft },
  progressFill: { height: "100%", backgroundColor: colors.primary },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 8, minWidth: 40 },
  counter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, minWidth: 0 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconBtnOn: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  body: { flex: 1, minHeight: 0, overflow: "hidden" },
  toast: {
    position: "absolute", top: 8, alignSelf: "center", zIndex: 20, elevation: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 6,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
  },
  footerRow: { flexDirection: "row", gap: 10 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  notesCard: {
    width: "100%", maxWidth: 400, borderRadius: radiusLg, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.warningBorder, padding: 20, gap: 12,
  },
  notesHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
})
