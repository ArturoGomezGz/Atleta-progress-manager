// Tarjetas de ejercicio y de circuito: vista previa, "ver toda la rutina" y resumen.
// Mismo diseño que ExerciseOverviewCard / CircuitOverviewCard de la web.
import { Text } from "@/components/text"
import { VideoThumb } from "@/components/workout/video"
import { colors, radiusLg } from "@/lib/theme"
import { doneFor, groupForPreview, type WorkoutExercise } from "@/lib/workout"
import { summarizeTargets } from "@/lib/workout-text"
import { CheckCircle, MessageSquare, Play, Repeat } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"

function DoneLine({ done, total, small }: { done: number; total: number; small?: boolean }) {
  if (done === 0) return null
  const finished = done >= total
  const color = finished ? colors.success : colors.primary
  return (
    <View style={styles.inline}>
      <CheckCircle size={small ? 16 : 20} color={color} />
      <Text size={small ? 14 : 16} weight="medium" color={color}>
        {finished ? "Terminado" : `${done} de ${total} series hechas`}
      </Text>
    </View>
  )
}

function Notes({ notes, small }: { notes: string; small?: boolean }) {
  return (
    <View style={[styles.inline, { alignItems: "flex-start" }]}>
      <MessageSquare size={16} color={colors.mutedForeground} style={{ marginTop: small ? 2 : 4 }} />
      <Text size={small ? 14 : 16} color={colors.mutedForeground} style={{ flex: 1 }}>{notes}</Text>
    </View>
  )
}

export function ExerciseCard({ exercise, index, highlight, showProgress = true, onWatch }: {
  exercise: WorkoutExercise
  index: number
  highlight?: "current" | "done"
  showProgress?: boolean
  onWatch: (exercise: WorkoutExercise) => void
}) {
  const videoId = exercise.youtubeVideoId
  const done = doneFor(exercise)
  const total = exercise.targets.length
  return (
    <View style={[styles.card, highlight === "current" && styles.current]}>
      <View style={styles.row}>
        {videoId ? (
          <Pressable onPress={() => onWatch(exercise)} accessibilityLabel={`Ver video de ${exercise.exerciseName}`}>
            <VideoThumb videoId={videoId} vertical={exercise.videoOrientation === "vertical"} style={{ width: 128 }} />
          </Pressable>
        ) : (
          <View style={styles.badge}>
            <Text heading size={26} color={colors.mutedForeground}>{index + 1}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={14} color={colors.mutedForeground}>Ejercicio {index + 1}</Text>
          <Text size={18} weight="semibold">{exercise.exerciseName}</Text>
          <Text size={16}>{summarizeTargets(exercise.targets)}</Text>
        </View>
      </View>
      {(exercise.notes || (showProgress && done > 0)) && (
        <View style={styles.footer}>
          {exercise.notes && <Notes notes={exercise.notes} />}
          {showProgress && <DoneLine done={done} total={total} />}
        </View>
      )}
      {videoId && (
        <Pressable onPress={() => onWatch(exercise)} style={styles.watch} android_ripple={{ color: colors.primarySoft }}>
          <Play size={20} color={colors.primary} />
          <Text size={16} weight="semibold" color={colors.primary}>Ver cómo se hace</Text>
        </Pressable>
      )}
    </View>
  )
}

export function CircuitCard({ blockName, rounds, exercises, allExercises, current, showProgress = true, onWatch }: {
  blockName: string
  rounds: number
  exercises: WorkoutExercise[]
  allExercises: WorkoutExercise[]
  current?: WorkoutExercise
  showProgress?: boolean
  onWatch: (exercise: WorkoutExercise) => void
}) {
  const active = current && allExercises.some((ex) => ex.id === current.id) ? current : null
  const totalTargets = allExercises.reduce((s, ex) => s + ex.targets.length, 0)
  const totalDone = allExercises.reduce((s, ex) => s + doneFor(ex), 0)
  const isDone = showProgress && totalTargets > 0 && totalDone >= totalTargets

  return (
    <View style={[styles.card, active && styles.current]}>
      <View style={styles.circuitHeader}>
        <View style={styles.inline}>
          <Repeat size={16} color={colors.primary} />
          <Text weight="semibold">{blockName}</Text>
        </View>
        {isDone ? (
          <View style={[styles.pill, { backgroundColor: colors.successSoft }]}>
            <CheckCircle size={14} color={colors.success} />
            <Text size={13} weight="medium" color={colors.success}>Completado</Text>
          </View>
        ) : (
          <View style={styles.pill}>
            <Text size={13} weight="medium" color={colors.primary}>
              {active?.roundNumber ? `Ronda ${active.roundNumber} de ${rounds}` : `× ${rounds} ${rounds === 1 ? "ronda" : "rondas"}`}
            </Text>
          </View>
        )}
      </View>
      {exercises.map((ex, i) => {
        const entries = allExercises.filter((e) => e.exerciseId === ex.exerciseId)
        const done = entries.reduce((s, e) => s + doneFor(e), 0)
        const total = entries.reduce((s, e) => s + e.targets.length, 0)
        return (
          <View
            key={ex.id}
            style={[
              styles.circuitRow,
              i > 0 && styles.divider,
              active?.exerciseId === ex.exerciseId && { backgroundColor: colors.primarySoft },
            ]}
          >
            {ex.youtubeVideoId ? (
              <Pressable onPress={() => onWatch(ex)} accessibilityLabel={`Ver video de ${ex.exerciseName}`}>
                <VideoThumb videoId={ex.youtubeVideoId} vertical={ex.videoOrientation === "vertical"} playSize={30} style={{ width: 96 }} />
              </Pressable>
            ) : (
              <View style={[styles.thumbEmpty, { width: 96 }]} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={16} weight="semibold">{ex.exerciseName}</Text>
              <Text size={16}>{summarizeTargets(ex.targets)}</Text>
              {ex.notes && <Notes notes={ex.notes} small />}
              {showProgress && <DoneLine done={done} total={total} small />}
            </View>
          </View>
        )
      })}
    </View>
  )
}

/** Lista completa de la rutina, agrupando circuitos. */
export function RoutineCards({ exercises, current, showProgress = true, onWatch }: {
  exercises: WorkoutExercise[]
  current?: WorkoutExercise
  showProgress?: boolean
  onWatch: (exercise: WorkoutExercise) => void
}) {
  return (
    <View style={{ gap: 12 }}>
      {groupForPreview(exercises).map((g, i) =>
        g.kind === "circuit" ? (
          <CircuitCard
            key={g.blockId + i}
            blockName={g.blockName}
            rounds={g.rounds}
            exercises={g.exercises}
            allExercises={g.allExercises}
            current={current}
            showProgress={showProgress}
            onWatch={onWatch}
          />
        ) : (
          <ExerciseCard
            key={g.exercise.id}
            exercise={g.exercise}
            index={i}
            showProgress={showProgress}
            onWatch={onWatch}
            highlight={current?.id === g.exercise.id ? "current" : undefined}
          />
        ),
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusLg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "hidden" },
  current: { borderColor: colors.primary, borderWidth: 2 },
  row: { flexDirection: "row", gap: 12, padding: 12 },
  badge: {
    width: 64, height: 64, borderRadius: 12, backgroundColor: colors.muted,
    alignItems: "center", justifyContent: "center",
  },
  footer: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  circuitHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(71,142,255,0.05)",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.primarySoft,
  },
  circuitRow: { flexDirection: "row", gap: 12, padding: 12 },
  thumbEmpty: { aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: colors.muted },
  watch: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
})
