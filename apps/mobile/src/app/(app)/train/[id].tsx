// Ejecutor de la rutina: serie en curso → descanso → siguiente serie, hasta terminar.
// Mismo flujo que WorkoutRunner de la web (apps/web/src/components/workout-runner.tsx),
// con lo nativo del teléfono: pantalla siempre encendida, pitidos, vibración y un
// aviso del sistema si el descanso termina con la app en segundo plano.
import { Button } from "@/components/button"
import { Text } from "@/components/text"
import { RoutineCards } from "@/components/workout/cards"
import { RestTimer } from "@/components/workout/rest-timer"
import { SetExecution } from "@/components/workout/set-execution"
import type { CountdownPhase } from "@/components/workout/time-countdown"
import { useSession } from "@/lib/auth"
import { feedback, prepareSounds, setSoundEnabled, useSoundEnabled } from "@/lib/feedback"
import { cancelTimerAlert, ensureNotificationPermission, scheduleTimerAlert } from "@/lib/notifications"
import { colors, radiusLg } from "@/lib/theme"
import { trpc } from "@/lib/trpc"
import { useRemainingMs, useSecondTicks } from "@/lib/use-countdown"
import {
  calcWeight, DEFAULT_REST_SECONDS, doneSets, findCurrentPosition, groupForPreview, sc, totalSets,
  type WorkoutExercise, type WorkoutTarget,
} from "@/lib/workout"
import { useKeepAwake } from "expo-keep-awake"
import { router, useLocalSearchParams } from "expo-router"
import { ArrowLeft, Check, CheckCircle, List, MessageSquare, Play, Volume2, VolumeX, X } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

type Rest = { endAt: number; total: number; upcoming: string }

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
    onSettled: () => utils.sessions.myPending.invalidate(),
  })

  const [rest, setRest] = useState<Rest | null>(null)
  // Apagado al empezar cada sesión; si el atleta lo activa, sigue activo en los siguientes descansos
  const [autoContinue, setAutoContinue] = useState(false)
  const [overview, setOverview] = useState(false)
  const [notes, setNotes] = useState(false)
  const [reps, setReps] = useState(8)
  const [timerPhase, setTimerPhase] = useState<CountdownPhase>("idle")
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const restAlert = useRef<Promise<string | null> | null>(null)
  const soundOn = useSoundEnabled()

  useEffect(() => {
    prepareSounds()
    ensureNotificationPermission()
    return () => cancelTimerAlert(restAlert.current)
  }, [])

  const position = progress ? findCurrentPosition(progress.exercises) : null
  const targetId = position?.target.id
  useEffect(() => { setReps(8); setTimerPhase("idle"); setFailed(false) }, [targetId])

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
    setRest(null)
  }, [])

  useEffect(() => {
    if (rest && restMs != null && restMs <= 0 && autoContinue) endRest()
  }, [rest, restMs, autoContinue, endRest])

  function startRest(seconds: number, upcoming: string) {
    const endAt = Date.now() + seconds * 1000
    setRest({ endAt, total: seconds, upcoming })
    restAlert.current = scheduleTimerAlert(endAt, "Descanso terminado", `Sigue: ${upcoming}`)
  }

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
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { confirmExit(); return true })
    return () => sub.remove()
  }, [confirmExit, finished])

  // ─── Fin de la rutina ───
  const completedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!finished || !progress || completedFor.current === progress.id) return
    completedFor.current = progress.id
    endRest()
    feedback.go()
    feedback.setDone()
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
    return (
      <SafeAreaView style={styles.celebration}>
        <View style={styles.bigCheck}><CheckCircle size={60} color={colors.success} /></View>
        <View style={{ gap: 8 }}>
          <Text heading size={44} center>¡Rutina terminada!</Text>
          <Text size={20} center color={colors.mutedForeground}>
            Hiciste {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"} y {done} series. ¡Excelente trabajo!
          </Text>
        </View>
        <Button
          label="Volver a mis rutinas"
          icon={ArrowLeft}
          size="lg"
          style={{ alignSelf: "stretch" }}
          onPress={() => router.dismissTo("/")}
        />
      </SafeAreaView>
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

  const { exercise, target, exerciseIdx } = position
  const weight = calcWeight(target.targetPercent, rms?.[exercise.exerciseId])
  const pct = total > 0 ? done / total : 0
  const restOvertime = restMs != null && restMs <= 0

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
      const nextPos = findCurrentPosition(next)
      const restFor = exercise.restSeconds ?? DEFAULT_REST_SECONDS
      if (nextPos && restFor > 0) startRest(restFor, upcomingLabel(nextPos))
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* ── Cabecera: progreso ── */}
      <View style={styles.header}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <View style={styles.headerRow}>
          <Pressable onPress={confirmExit} style={styles.headerBtn} hitSlop={8}>
            <X size={22} color={colors.mutedForeground} />
            <Text size={16} color={colors.mutedForeground}>Salir</Text>
          </Pressable>
          <Text size={16} color={colors.mutedForeground}>
            Ejercicio <Text size={16} weight="bold">{exerciseIdx + 1}</Text> de {progress.exercises.length}
          </Text>
          <Pressable
            onPress={() => setSoundEnabled(!soundOn)}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityLabel={soundOn ? "Silenciar sonidos" : "Activar sonidos"}
          >
            {soundOn ? <Volume2 size={22} color={colors.foreground} /> : <VolumeX size={22} color={colors.mutedForeground} />}
          </Pressable>
        </View>
      </View>

      {/* ── Contenido ── */}
      {rest && restMs != null ? (
        <RestTimer
          remainingMs={restMs}
          totalSeconds={rest.total}
          upcoming={rest.upcoming}
          autoContinue={autoContinue}
          onToggleAutoContinue={setAutoContinue}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SetExecution
            key={target.id}
            exercise={exercise}
            target={target}
            weight={weight}
            reps={reps}
            onRepsChange={setReps}
            timerPhase={timerPhase}
            onTimerPhaseChange={setTimerPhase}
            onShowNotes={() => setNotes(true)}
          />
        </ScrollView>
      )}

      {/* ── Pie fijo ── */}
      <View style={styles.footer}>
        {rest ? (
          <Button
            label={restOvertime ? "Siguiente" : "Ya descansé, continuar"}
            icon={Play}
            size="lg"
            variant={restOvertime ? "destructive" : "primary"}
            onPress={endRest}
          />
        ) : (
          <>
            <Button label={saving ? "Guardando…" : "Terminé esta serie"} icon={Check} size="lg" loading={saving} onPress={handleComplete} />
            {failed && <Text size={15} color={colors.destructive} center>No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.</Text>}
          </>
        )}
        <Button label="Ver toda la rutina" icon={List} variant="ghost" onPress={() => setOverview(true)} />
      </View>

      {/* ── Toda la rutina ── */}
      <Modal visible={overview} animationType="slide" onRequestClose={() => setOverview(false)}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={[styles.content, { gap: 16 }]}>
              <Pressable onPress={() => setOverview(false)} style={styles.backLink} hitSlop={8}>
                <ArrowLeft size={20} color={colors.mutedForeground} />
                <Text size={16} color={colors.mutedForeground}>{rest ? "Volver al descanso" : "Volver al ejercicio"}</Text>
              </Pressable>
              <View>
                <Text heading size={34}>{sc(progress.routineName ?? "Rutina")}</Text>
                <Text size={16} color={colors.mutedForeground}>{done} de {total} series hechas</Text>
              </View>
              <RoutineCards exercises={progress.exercises} current={exercise} />
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

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
  progressTrack: { height: 8, backgroundColor: colors.mutedSoft },
  progressFill: { height: "100%", backgroundColor: colors.primary },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 8, minWidth: 44 },
  content: { padding: 16, paddingTop: 20, paddingBottom: 24 },
  footer: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 4,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
  },
  backLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  notesCard: {
    width: "100%", maxWidth: 400, borderRadius: radiusLg, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.warningBorder, padding: 20, gap: 12,
  },
  notesHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  celebration: { flex: 1, alignItems: "center", justifyContent: "center", gap: 32, padding: 24, backgroundColor: colors.background },
  bigCheck: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: colors.successSoft,
    borderWidth: 2, borderColor: "rgba(16,185,129,0.4)", alignItems: "center", justifyContent: "center",
  },
})
