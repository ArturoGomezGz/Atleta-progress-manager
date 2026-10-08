// Cuerpo de la serie en curso, sin scroll: nombre del ejercicio (con carrusel si es
// largo), video y objetivo grande (repeticiones, tiempo o "las que puedas").
// Dos vistas, según la preferencia del atleta:
//  · split: video y objetivo se reparten el alto al 50-50.
//  · button: solo el objetivo; el video se abre a demanda en su lugar.
import { Text } from "@/components/text"
import { MarqueeText } from "@/components/workout/marquee-text"
import { CountdownFace, type SetCountdown } from "@/components/workout/time-countdown"
import { VideoPlayer } from "@/components/workout/video"
import { feedback } from "@/lib/feedback"
import { colors, radiusLg } from "@/lib/theme"
import type { TrainView } from "@/lib/train-view"
import { formatClock, type WorkoutExercise, type WorkoutTarget } from "@/lib/workout"
import { explainTempo, formatDuration, isTimeTarget, PER_SIDE_SUFFIX } from "@/lib/workout-text"
import { Info, Minus, Pause, Play, Plus, Repeat, Square, Timer } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

export function SetExecution({
  exercise, target, weight, reps, onRepsChange, countdown, reviewing, view,
  videoPlaying, onVideoPlayingChange, onShowNotes,
}: {
  exercise: WorkoutExercise
  target: WorkoutTarget
  /** Peso calculado con el %RM del atleta ("" si no aplica). */
  weight: string
  reps: number
  onRepsChange: (reps: number) => void
  countdown: SetCountdown
  /** Se está viendo una serie que ya se hizo (botón "Atrás"): solo lectura. */
  reviewing: boolean
  view: TrainView
  videoPlaying: boolean
  onVideoPlayingChange: (playing: boolean) => void
  onShowNotes: () => void
}) {
  const isTime = isTimeTarget(target)
  const freeReps = !isTime && target.targetReps == null
  const tempoText = exercise.tempo ? explainTempo(exercise.tempo) : null
  const hasVideo = !!exercise.youtubeVideoId
  const phase = reviewing ? "idle" : countdown.phase

  const perSide = !!exercise.perSide
  const alert = isTime && (phase === "prepare" || phase === "switch" || phase === "finished")
  const running = isTime && (phase === "running" || phase === "paused")

  const video = hasVideo ? (
    <VideoPlayer
      videoId={exercise.youtubeVideoId!}
      title={exercise.exerciseName}
      fill
      playing={videoPlaying}
      onPlayingChange={onVideoPlayingChange}
    />
  ) : null

  // En "button" el video ocupa el lugar del objetivo mientras se ve; en "split" siempre
  // tiene su mitad (si el ejercicio no trae video, el objetivo usa todo el espacio).
  const showVideoBox = hasVideo && (view === "split" || videoPlaying)
  const showTarget = !(view === "button" && videoPlaying)

  return (
    <View style={styles.wrap}>
      <View style={{ gap: 2 }}>
        {exercise.blockName ? (
          <View style={styles.inline}>
            <Repeat size={16} color={colors.primary} />
            <Text size={15} weight="medium" color={colors.primary} numberOfLines={1} style={{ flexShrink: 1 }}>
              {exercise.blockName}
              {exercise.roundNumber
                ? ` · ronda ${exercise.roundNumber} de ${exercise.rounds}`
                : exercise.rounds > 1 ? ` · ${exercise.rounds} vueltas` : ""}
            </Text>
          </View>
        ) : null}
        <View style={[styles.inline, { gap: 10 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <MarqueeText heading size={34}>{exercise.exerciseName}</MarqueeText>
          </View>
          {view === "button" && hasVideo && (
            <Pressable
              onPress={() => onVideoPlayingChange(!videoPlaying)}
              style={styles.roundBtn}
              hitSlop={8}
              accessibilityLabel={videoPlaying ? "Cerrar el video" : "Ver el video"}
            >
              {videoPlaying ? <Square size={16} color={colors.foreground} fill={colors.foreground} /> : <Play size={18} color={colors.foreground} fill={colors.foreground} />}
            </Pressable>
          )}
          {exercise.notes && (
            <Pressable onPress={onShowNotes} style={[styles.roundBtn, styles.notesBtn]} hitSlop={8} accessibilityLabel="Ver indicaciones de tu entrenador">
              <Info size={18} color={colors.warning} />
              <View style={styles.notesDot} />
            </Pressable>
          )}
        </View>
      </View>

      {showVideoBox && <View style={styles.half}>{video}</View>}

      {showTarget && (
        <TargetCard alert={alert} running={running} done={reviewing}>
          <Text size={18} weight="semibold" color={alert ? colors.destructive : running ? colors.success : colors.primary} center>
            Serie {target.setNumber} de {exercise.targets.length}{reviewing ? " · hecha" : ""}
            {perSide && isTime && !reviewing
              ? ` · ${phase === "switch" ? "cambia de lado" : phase === "finished" ? "ambos lados" : `lado ${countdown.side} de 2`}`
              : ""}
          </Text>
          {(h) => {
            const big = Math.max(44, Math.min(110, Math.round(h * 0.4)))
            return (
              <>
                {isTime ? (
                  <View style={{ alignItems: "center" }}>
                    <CountdownFace phase={phase} value={reviewing ? formatClock(target.targetDurationSeconds ?? 30) : countdown.value} size={big} />
                    {perSide && (
                      <Text size={15} color={colors.mutedForeground} center>
                        {formatDuration(target.targetDurationSeconds ?? 30)} {PER_SIDE_SUFFIX}
                      </Text>
                    )}
                  </View>
                ) : freeReps ? (
                  <View style={{ gap: 6 }}>
                    <Text size={15} color={colors.mutedForeground} center>
                      {perSide ? "Haz las que puedas con cada lado y anota cuántas fueron por lado:" : "Haz las que puedas y anota cuántas fueron:"}
                    </Text>
                    <RepsStepper value={reps} onChange={onRepsChange} disabled={reviewing} size={Math.min(big, 76)} />
                  </View>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Text heading size={big} center tabular style={{ lineHeight: Math.round(big * 1.02) }}>{target.targetReps}</Text>
                    <Text size={22} center>
                      {target.targetReps === 1 ? "repetición" : "repeticiones"}{perSide ? ` ${PER_SIDE_SUFFIX}` : ""}
                    </Text>
                    {perSide && h > 190 && (
                      <Text size={14} color={colors.mutedForeground} center>Lado 1 y luego lado 2, sin descanso entre lados</Text>
                    )}
                  </View>
                )}
                {weight !== "" && (
                  <Text size={18} center>
                    con <Text size={18} weight="bold">{weight} lbs</Text>
                    {h > 210 && <Text size={14} color={colors.mutedForeground}> ({target.targetPercent}% de tu máximo)</Text>}
                  </Text>
                )}
              </>
            )
          }}
        </TargetCard>
      )}

      {(tempoText || (exercise.restSeconds != null && exercise.restSeconds > 0)) && (
        <View style={styles.meta}>
          {tempoText && (
            <View style={styles.inline}>
              <Timer size={16} color={colors.mutedForeground} />
              <Text size={13} color={colors.mutedForeground} numberOfLines={1} style={{ flexShrink: 1 }}>
                <Text size={13} weight="bold" color={colors.mutedForeground}>Ritmo </Text>{exercise.tempo}
              </Text>
            </View>
          )}
          {exercise.restSeconds != null && exercise.restSeconds > 0 && (
            <View style={styles.inline}>
              <Pause size={16} color={colors.mutedForeground} />
              <Text size={13} color={colors.mutedForeground} numberOfLines={1}>
                <Text size={13} weight="bold" color={colors.mutedForeground}>Descanso </Text>{formatDuration(exercise.restSeconds)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

/**
 * Tarjeta del objetivo: ocupa el espacio sobrante y le pasa su alto a sus hijos para
 * que las cifras grandes se ajusten a pantallas chicas sin scroll.
 * El primer hijo es el encabezado fijo; el segundo, una función que recibe el alto.
 */
function TargetCard({ alert, running, done, children }: {
  alert: boolean
  running: boolean
  done: boolean
  children: [React.ReactNode, (height: number) => React.ReactNode]
}) {
  const [h, setH] = useState(220)
  const border = alert ? colors.destructiveBorder : running ? colors.successBorder : done ? colors.border : colors.primaryBorder
  const bg = alert ? colors.destructiveSoft : running ? colors.successSoft : colors.card
  return (
    <View style={[styles.target, styles.half, { borderColor: border, backgroundColor: bg }]} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {children[0]}
      {children[1](h)}
    </View>
  )
}

function RepsStepper({ value, onChange, disabled, size }: { value: number; onChange: (v: number) => void; disabled?: boolean; size: number }) {
  const step = (d: number) => { feedback.tap(); onChange(Math.max(0, value + d)) }
  return (
    <View style={[styles.inline, { justifyContent: "center", gap: 16 }]}>
      <Pressable disabled={disabled} onPress={() => step(-1)} style={[styles.stepBtn, disabled && { opacity: 0.4 }]} accessibilityLabel="Una menos" android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: false }}>
        <Minus size={26} color={colors.foreground} />
      </Pressable>
      <Text heading size={size} tabular center style={{ minWidth: 90, lineHeight: Math.round(size * 1.05) }}>{value}</Text>
      <Pressable disabled={disabled} onPress={() => step(1)} style={[styles.stepBtn, disabled && { opacity: 0.4 }]} accessibilityLabel="Una más" android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: false }}>
        <Plus size={26} color={colors.foreground} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  half: { flex: 1, minHeight: 0 },
  roundBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.muted, alignItems: "center", justifyContent: "center",
  },
  notesBtn: { borderColor: colors.warningBorder, backgroundColor: colors.warningSoft },
  notesDot: { position: "absolute", top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning },
  target: {
    borderRadius: radiusLg, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 8,
    gap: 4, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  meta: { flexDirection: "row", justifyContent: "center", gap: 18, flexWrap: "nowrap" },
  stepBtn: {
    width: 56, height: 56, borderRadius: radiusLg, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
})
