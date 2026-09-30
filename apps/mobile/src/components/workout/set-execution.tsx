// Cuerpo de la serie en curso: nombre del ejercicio, objetivo grande y claro
// (repeticiones, tiempo o "las que puedas") e indicaciones del coach.
import { Text } from "@/components/text"
import { TimeCountdown, type CountdownPhase } from "@/components/workout/time-countdown"
import { feedback } from "@/lib/feedback"
import { colors, radiusLg } from "@/lib/theme"
import type { WorkoutExercise, WorkoutTarget } from "@/lib/workout"
import { explainTempo, formatDuration, isTimeTarget } from "@/lib/workout-text"
import { Info, Minus, Pause, Plus, Repeat, Timer } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"

export function SetExecution({ exercise, target, weight, reps, onRepsChange, timerPhase, onTimerPhaseChange, onShowNotes }: {
  exercise: WorkoutExercise
  target: WorkoutTarget
  /** Peso calculado con el %RM del atleta ("" si no aplica). */
  weight: string
  reps: number
  onRepsChange: (reps: number) => void
  timerPhase: CountdownPhase
  onTimerPhaseChange: (phase: CountdownPhase) => void
  onShowNotes: () => void
}) {
  const isTime = isTimeTarget(target)
  const freeReps = !isTime && target.targetReps == null
  const tempoText = exercise.tempo ? explainTempo(exercise.tempo) : null

  const alert = isTime && (timerPhase === "prepare" || timerPhase === "finished")
  const running = isTime && (timerPhase === "running" || timerPhase === "paused")
  const tone = alert ? colors.destructive : running ? colors.success : colors.primary

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        {exercise.blockName && (
          <View style={styles.inline}>
            <Repeat size={16} color={colors.primary} />
            <Text size={16} weight="medium" color={colors.primary}>
              {exercise.blockName}
              {exercise.roundNumber
                ? ` · ronda ${exercise.roundNumber} de ${exercise.rounds}`
                : exercise.rounds > 1 ? ` · ${exercise.rounds} vueltas` : ""}
            </Text>
          </View>
        )}
        <View style={[styles.inline, { gap: 10 }]}>
          <Text heading size={36} style={{ flexShrink: 1 }}>{exercise.exerciseName}</Text>
          {exercise.notes && (
            <Pressable onPress={onShowNotes} style={styles.notesBtn} hitSlop={8} accessibilityLabel="Ver indicaciones de tu entrenador">
              <Info size={18} color={colors.warning} />
              <View style={styles.notesDot} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.target, { borderColor: alert ? colors.destructiveBorder : running ? colors.successBorder : colors.primaryBorder }]}>
        <Text size={20} weight="semibold" color={tone} center>
          Serie {target.setNumber} de {exercise.targets.length}
        </Text>

        {isTime ? (
          <TimeCountdown
            seconds={target.targetDurationSeconds ?? 30}
            exerciseName={exercise.exerciseName}
            onPhaseChange={onTimerPhaseChange}
          />
        ) : freeReps ? (
          <View style={{ gap: 10 }}>
            <Text size={16} color={colors.mutedForeground} center>Haz las que puedas y anota cuántas fueron:</Text>
            <RepsStepper value={reps} onChange={onRepsChange} />
          </View>
        ) : (
          <View>
            <Text heading size={96} center tabular style={{ lineHeight: 100 }}>{target.targetReps}</Text>
            <Text size={24} center>{target.targetReps === 1 ? "repetición" : "repeticiones"}</Text>
          </View>
        )}

        {weight !== "" && (
          <Text size={20} center>
            con <Text size={20} weight="bold">{weight} lbs</Text>
            <Text size={16} color={colors.mutedForeground}> ({target.targetPercent}% de tu máximo)</Text>
          </Text>
        )}
      </View>

      {(tempoText || exercise.restSeconds) && (
        <View style={{ gap: 10 }}>
          {tempoText && (
            <View style={[styles.inline, { alignItems: "flex-start" }]}>
              <Timer size={20} color={colors.mutedForeground} style={{ marginTop: 2 }} />
              <Text size={16} color={colors.mutedForeground} style={{ flex: 1 }}>
                <Text size={16} weight="bold">Ritmo: </Text>{tempoText}
              </Text>
            </View>
          )}
          {exercise.restSeconds != null && exercise.restSeconds > 0 && (
            <View style={[styles.inline, { alignItems: "flex-start" }]}>
              <Pause size={20} color={colors.mutedForeground} style={{ marginTop: 2 }} />
              <Text size={16} color={colors.mutedForeground} style={{ flex: 1 }}>
                <Text size={16} weight="bold">Descanso: </Text>
                {formatDuration(exercise.restSeconds)} {exercise.blockName ? "antes del siguiente ejercicio" : "entre series"}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function RepsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const step = (d: number) => { feedback.tap(); onChange(Math.max(0, value + d)) }
  return (
    <View style={[styles.inline, { justifyContent: "center", gap: 20 }]}>
      <Pressable onPress={() => step(-1)} style={styles.stepBtn} accessibilityLabel="Una menos" android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: false }}>
        <Minus size={30} color={colors.foreground} />
      </Pressable>
      <Text heading size={72} tabular center style={{ width: 100 }}>{value}</Text>
      <Pressable onPress={() => step(1)} style={styles.stepBtn} accessibilityLabel="Una más" android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: false }}>
        <Plus size={30} color={colors.foreground} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  notesBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft, alignItems: "center", justifyContent: "center",
  },
  notesDot: { position: "absolute", top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning },
  target: {
    borderRadius: radiusLg, borderWidth: 2, backgroundColor: colors.card,
    padding: 20, gap: 12, alignItems: "center",
  },
  stepBtn: {
    width: 68, height: 68, borderRadius: radiusLg, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
})
