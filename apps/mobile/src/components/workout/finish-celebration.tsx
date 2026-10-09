// Celebración al terminar la rutina ("Opción C · Momento a pantalla completa", ~2,5 s):
// un anillo grande se llena con las series hechas, se encoge hasta el punto de HOY en la
// tarjeta "Esta semana", la racha explota con la llama y aparecen el título y los números.
// Todo es transform/opacity (más el strokeDashoffset del anillo) sobre valores compartidos de
// Reanimated, así que corre en el hilo de UI. Un toque en cualquier parte salta al estado final;
// con movimiento reducido solo hay un fundido de 250 ms.
import { Button } from "@/components/button"
import { Text } from "@/components/text"
import { feedback } from "@/lib/feedback"
import { computeMomentum, DAY_LABELS, type Momentum } from "@/lib/momentum"
import { colors, radiusLg } from "@/lib/theme"
import { trpc } from "@/lib/trpc"
import { ArrowLeft, Check, Flame } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation, Easing, interpolate, interpolateColor, useAnimatedProps, useAnimatedReaction,
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Circle } from "react-native-svg"
import { scheduleOnRN } from "react-native-worklets"

// Línea de tiempo (ms) del mockup
const T1 = 120 // el anillo empieza a llenarse
const T2 = 820 // anillo completo
const T3 = 1120 // el anillo viaja al día de hoy
const T4 = 1560 // aterriza
const T5 = 1600 // racha, título y números
const FLIGHT = T4 - T3
const REVEAL_AT = T5 - T3 // desde que sale el anillo
const BUTTON_AT = 600
const DATA_WAIT = 1500 // cuánto se espera el momentum antes de seguir sin la tarjeta

const SIZE = 200
const STROKE = 14
const R = 88 // radio del trazo; el círculo sólido del aterrizaje usa 100
const CIRC = 2 * Math.PI * R
const DOT = 28

const EO = Easing.bezier(0.2, 0.8, 0.2, 1)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export type Completion = {
  /** Ya se sabe cómo quedó guardada la sesión (éxito, error o ya estaba completa). */
  settled: boolean
  /** Fecha de término que devolvió completeMySession. */
  completedAt: string | null
  /** La sesión ya estaba completa al abrir esta pantalla (no se llamó a completeMySession). */
  alreadyCompleted: boolean
  failed: boolean
}

type Snapshot = { before: Momentum; after: Momentum; todayIdx: number }

// "Antes" = historial sin la sesión recién terminada; "después" = con ella. Sin doble conteo.
function buildSnapshot(data: string[] | undefined, c: Completion, now: Date): Snapshot | null {
  if (!data || !c.settled) return null
  let past: string[]
  let current: string[]
  if (c.completedAt) {
    const t = new Date(c.completedAt).getTime()
    past = data.filter((iso) => new Date(iso).getTime() !== t)
    current = [...past, new Date(t).toISOString()]
  } else if (c.alreadyCompleted) {
    // La consulta viene de más reciente a más antigua: la primera es la que se acaba de terminar
    past = data.slice(1)
    current = data
  } else {
    past = data
    current = [...data, now.toISOString()]
  }
  return {
    before: computeMomentum(past, now),
    after: computeMomentum(current, now),
    todayIdx: (now.getDay() + 6) % 7,
  }
}

// Anima p de 0 a 1 cuando `go` es true; con `skipped` queda en 1 de inmediato.
function useReveal(go: boolean, skipped: boolean, delay: number, duration: number, easing = EO) {
  const p = useSharedValue(0)
  useEffect(() => {
    if (skipped) {
      cancelAnimation(p)
      p.value = 1
    } else if (go) {
      p.value = withDelay(delay, withTiming(1, { duration, easing }))
    }
  }, [go, skipped, delay, duration, easing, p])
  return p
}

type RevealProps = { go: boolean; skipped: boolean; delay: number; dist?: number; dur?: number; style?: StyleProp<ViewStyle>; children: ReactNode }

function Reveal({ go, skipped, delay, dist = 14, dur = 380, style, children }: RevealProps) {
  const p = useReveal(go, skipped, delay, dur)
  const a = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * dist }] }))
  return <Animated.View style={[style, a]}>{children}</Animated.View>
}

type RollProps = { from: number | string; to: number | string; p: SharedValue<number>; size: number; heading?: boolean; weight?: "bold"; color?: string }

// Cifra que sube y deja entrar la nueva (dos textos apilados dentro de una ventana de una línea)
function Roll({ from, to, p, size, heading, weight, color }: RollProps) {
  const lh = Math.round(size * (heading ? 1.15 : 1.45))
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -lh * Math.min(1, p.value) }] }))
  return (
    <View style={{ height: lh, overflow: "hidden" }}>
      <Animated.View style={a}>
        <Text size={size} heading={heading} weight={weight} color={color} tabular style={{ lineHeight: lh }}>{from}</Text>
        <Text size={size} heading={heading} weight={weight} color={color} tabular style={{ lineHeight: lh }}>{to}</Text>
      </Animated.View>
    </View>
  )
}

type WeekValues = {
  card: SharedValue<number> // fundido de la tarjeta (tiempo)
  shown: SharedValue<number> // fundido por tener datos
  flash: SharedValue<number> // borde primario
  fill: SharedValue<number> // relleno del punto de hoy
  pulse: SharedValue<number> // escala del aterrizaje
  ring: SharedValue<number> // anillo que se expande
  check: SharedValue<number> // palomita
  count: SharedValue<number> // contador "X de 7"
}

function WeekCard({ snap, v, dotRef }: { snap: Snapshot | null; v: WeekValues; dotRef: React.RefObject<View | null> }) {
  const days = (snap ?? { after: computeMomentum([]), todayIdx: -1 }).after.weekDays
  const todayIdx = snap?.todayIdx ?? -1
  const from = snap?.before.daysThisWeek ?? 0
  const to = snap?.after.daysThisWeek ?? 0

  const cardA = useAnimatedStyle(() => ({
    opacity: v.card.value * v.shown.value,
    borderColor: interpolateColor(v.flash.value, [0, 1], [colors.border, colors.primary]),
  }))
  const fillA = useAnimatedStyle(() => ({ opacity: v.fill.value, transform: [{ scale: v.pulse.value }] }))
  const ringA = useAnimatedStyle(() => ({
    opacity: interpolate(v.ring.value, [0, 1], [0.95, 0]),
    transform: [{ scale: interpolate(v.ring.value, [0, 1], [1, 2.7]) }],
  }))
  const checkA = useAnimatedStyle(() => ({ opacity: v.check.value }))

  return (
    <Animated.View style={[styles.card, cardA]}>
      <View style={styles.between}>
        <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.eyebrow}>Esta semana</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Roll from={from} to={to} p={v.count} size={14} weight="bold" />
          <Text size={14} weight="bold">de 7</Text>
        </View>
      </View>
      <View style={[styles.between, { marginTop: 16 }]}>
        {days.map((d, i) => {
          const today = i === todayIdx
          return (
            <View key={i} style={{ alignItems: "center", gap: 8 }}>
              {today ? (
                <View ref={dotRef} collapsable={false} style={styles.dot}>
                  <Animated.View style={[StyleSheet.absoluteFill, styles.dotFillLayer, fillA]} />
                  <Animated.View style={[StyleSheet.absoluteFill, styles.dotRing, ringA]} />
                  <Animated.View style={[styles.dotCheck, checkA]}><Check size={16} color={colors.primaryForeground} strokeWidth={3.2} /></Animated.View>
                </View>
              ) : (
                <View style={[styles.dot, d.count > 0 ? styles.dotDone : d.future ? styles.dotFuture : null]}>
                  {d.count > 0 && <Check size={16} color={colors.primaryForeground} strokeWidth={3.2} />}
                </View>
              )}
              <Text size={12} color={today ? colors.foreground : colors.mutedForeground} weight={today ? "bold" : "regular"}>{DAY_LABELS[i]}</Text>
            </View>
          )
        })}
      </View>
    </Animated.View>
  )
}

export function FinishCelebration({
  exerciseCount, setCount, completion, onBack,
}: { exerciseCount: number; setCount: number; completion: Completion; onBack: () => void }) {
  const reduced = useReducedMotion()
  const { data } = trpc.sessions.myMomentum.useQuery()
  const mountedAt = useRef(new Date())

  const [snap, setSnap] = useState<Snapshot | null>(null)
  const snapRef = useRef<Snapshot | null>(null)
  const [skipped, setSkipped] = useState(reduced)
  const [revealed, setRevealed] = useState(reduced)
  const [unitDone, setUnitDone] = useState(reduced)
  const [btnReady, setBtnReady] = useState(reduced)
  const [settled, setSettled] = useState(reduced)
  const [count, setCount_] = useState(reduced ? setCount : 0)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }, [])
  const phase = useRef({ t3: false, landed: false, flown: false, gaveUp: false, skipped: reduced })

  const ringBox = useRef<View>(null)
  const dotRef = useRef<View>(null)

  // ── Valores compartidos ──
  const root = useSharedValue(reduced ? 0 : 1)
  const ringIn = useSharedValue(0)
  const fillP = useSharedValue(0)
  const pop = useSharedValue(1)
  const glow = useSharedValue(1)
  const labelOut = useSharedValue(0)
  const okIn = useSharedValue(0)
  const flight = useSharedValue(0)
  const solid = useSharedValue(0)
  const ringGone = useSharedValue(0)
  const dx = useSharedValue(0)
  const dy = useSharedValue(0)
  const btn = useSharedValue(0)
  const week: WeekValues = {
    card: useSharedValue(0), shown: useSharedValue(0), flash: useSharedValue(0), fill: useSharedValue(0),
    pulse: useSharedValue(1), ring: useSharedValue(1), check: useSharedValue(0), count: useSharedValue(0),
  }
  const { card: wCard, shown: wShown, flash: wFlash, fill: wFill, pulse: wPulse, ring: wRing, check: wCheck, count: wCount } = week

  // Contador del anillo: se actualiza solo al cambiar de número (máx. N renders)
  useAnimatedReaction(
    () => Math.round(setCount * fillP.value),
    (v, prev) => { if (v !== prev) scheduleOnRN(setCount_, v) },
  )

  // Estado final de la semana (sin animar)
  const settleWeek = useCallback(() => {
    cancelAnimation(wFlash); cancelAnimation(wPulse); cancelAnimation(wRing); cancelAnimation(wCount)
    wCard.value = 1; wFlash.value = 0; wFill.value = 1; wPulse.value = 1; wRing.value = 1; wCheck.value = 1; wCount.value = 1
  }, [wCard, wCheck, wCount, wFill, wFlash, wPulse, wRing])

  // Aterrizaje de hoy en la tarjeta
  const touchdown = useCallback(() => {
    ringGone.value = 1
    wFill.value = 1
    wCheck.value = 1
    wPulse.value = withSequence(withTiming(1.28, { duration: 170, easing: EO }), withTiming(1, { duration: 250, easing: EO }))
    wRing.value = 0
    wRing.value = withDelay(80, withTiming(1, { duration: 650, easing: Easing.out(Easing.quad) }))
    wFlash.value = withSequence(withTiming(1, { duration: 200, easing: Easing.linear }), withTiming(0, { duration: 600, easing: Easing.linear }))
    wCount.value = withDelay(40, withTiming(1, { duration: 440, easing: Easing.bezier(0.34, 1.2, 0.64, 1) }))
    feedback.land()
  }, [ringGone, wCheck, wCount, wFill, wFlash, wPulse, wRing])

  const land = useCallback(() => {
    if (phase.current.landed || phase.current.skipped) return
    phase.current.landed = true
    const go = (x: number, y: number) => {
      if (phase.current.skipped) return
      phase.current.flown = true
      dx.value = x
      dy.value = y
      flight.value = withTiming(1, { duration: FLIGHT, easing: Easing.bezier(0.65, 0, 0.25, 1) })
      solid.value = withDelay(120, withTiming(1, { duration: 260 }))
      later(touchdown, FLIGHT)
      later(() => setRevealed(true), REVEAL_AT)
      later(() => setUnitDone(true), REVEAL_AT + 180 + 150)
      later(() => setSettled(true), REVEAL_AT + 380 + 140 + 360)
    }
    // Posición del punto de hoy respecto al centro del anillo, medida justo antes de volar
    ringBox.current?.measureInWindow((rx, ry, rw, rh) => {
      dotRef.current?.measureInWindow((x, y, w, h) => go(x + w / 2 - (rx + rw / 2), y + h / 2 - (ry + rh / 2)))
    })
    // Si no hay dónde medir, sigue sin el viaje
    later(() => {
      if (phase.current.skipped || phase.current.flown) return
      phase.current.gaveUp = true
      ringGone.value = withTiming(1, { duration: 200 })
      later(() => setRevealed(true), 200)
      later(() => setSettled(true), 200 + 1000)
    }, 300)
  }, [dx, dy, flight, later, ringGone, solid, touchdown])

  const maybeLand = useCallback(() => {
    const ph = phase.current
    if (ph.skipped || ph.landed || ph.gaveUp || !ph.t3) return
    if (snapRef.current) land()
  }, [land])

  // Sin datos a tiempo: el anillo se desvanece y la celebración sigue sin la tarjeta
  const giveUp = useCallback(() => {
    const ph = phase.current
    if (ph.skipped || ph.landed || ph.gaveUp) return
    ph.gaveUp = true
    ringGone.value = withTiming(1, { duration: 250 })
    later(() => setRevealed(true), 250)
    later(() => setSettled(true), 250 + 1000)
  }, [later, ringGone])

  // Momentum listo: se congela una sola vez para que las cifras no cambien a media animación
  useEffect(() => {
    if (snapRef.current) return
    const s = buildSnapshot(data, completion, mountedAt.current)
    if (!s) return
    snapRef.current = s
    setSnap(s)
    wShown.value = withTiming(1, { duration: 260 })
    if (phase.current.skipped || phase.current.gaveUp) settleWeek()
    else maybeLand()
  }, [data, completion, maybeLand, settleWeek, wShown])

  // Secuencia principal
  useEffect(() => {
    const timerList = timers.current
    if (reduced) {
      feedback.setDone()
      root.value = withTiming(1, { duration: 250, easing: Easing.linear })
      btn.value = 1
      wCard.value = 1
      wFill.value = 1
      wCheck.value = 1
      wCount.value = 1
      ringGone.value = 1
      return
    }
    feedback.finish()
    ringIn.value = withDelay(60, withSpring(1, { damping: 12, stiffness: 150 }))
    fillP.value = withDelay(T1, withTiming(1, { duration: T2 - T1, easing: Easing.bezier(0.45, 0, 0.25, 1) }))
    later(() => {
      feedback.setDone()
      pop.value = withSequence(withTiming(1.1, { duration: 120 }), withTiming(1, { duration: 220 }))
      glow.value = 0
      glow.value = withTiming(1, { duration: 700 })
      labelOut.value = withTiming(1, { duration: 160, easing: Easing.linear })
      okIn.value = withDelay(60, withSpring(1, { damping: 11, stiffness: 190 }))
    }, T2)
    wCard.value = withDelay(1000, withTiming(1, { duration: 260, easing: Easing.linear }))
    later(() => { phase.current.t3 = true; maybeLand() }, T3)
    later(giveUp, T3 + DATA_WAIT)
    btn.value = withDelay(BUTTON_AT, withTiming(1, { duration: 260, easing: Easing.linear }))
    later(() => setBtnReady(true), BUTTON_AT)
    return () => { timerList.forEach(clearTimeout); timerList.length = 0 }
    // Solo al montar: la secuencia no se reinicia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Un toque salta al estado final
  function skip() {
    if (phase.current.skipped) return
    phase.current.skipped = true
    timers.current.forEach(clearTimeout)
    timers.current.length = 0
    ;[ringIn, fillP, pop, glow, labelOut, okIn, flight, solid, ringGone, btn].forEach(cancelAnimation)
    ringGone.value = 1
    fillP.value = 1
    glow.value = 1
    btn.value = 1
    settleWeek()
    setCount_(setCount)
    setSkipped(true)
    setRevealed(true)
    setUnitDone(true)
    setBtnReady(true)
    setSettled(true)
  }

  // ── Estilos animados ──
  const rootA = useAnimatedStyle(() => ({ opacity: root.value }))
  const ringA = useAnimatedStyle(() => {
    const scale = (0.6 + 0.4 * ringIn.value) * pop.value * (1 + (DOT / SIZE - 1) * flight.value)
    return {
      opacity: Math.min(1, ringIn.value) * (1 - ringGone.value),
      transform: [{ translateX: dx.value * flight.value }, { translateY: dy.value * flight.value }, { scale }],
    }
  })
  const glowA = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - glow.value) * (1 - ringGone.value),
    transform: [{ scale: 0.9 + glow.value }],
  }))
  const labelA = useAnimatedStyle(() => ({ opacity: 1 - labelOut.value }))
  const okA = useAnimatedStyle(() => ({ opacity: Math.min(1, okIn.value), transform: [{ scale: 0.4 + 0.6 * okIn.value }] }))
  const progressProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - fillP.value) }))
  const solidProps = useAnimatedProps(() => ({ opacity: solid.value }))
  const btnA = useAnimatedStyle(() => ({ opacity: btn.value }))
  const shownA = useAnimatedStyle(() => ({ opacity: week.shown.value }))

  // Racha: sale con rebote, la llama se mueve y el número rueda
  const streakP = useReveal(revealed, skipped, 0, 480)
  const flameP = useReveal(revealed, skipped, 120, 600)
  const dailyRoll = useReveal(revealed, skipped, 180, 440)
  const streakA = useAnimatedStyle(() => ({
    opacity: interpolate(streakP.value, [0, 0.6], [0, 1], "clamp"),
    transform: [{ scale: interpolate(streakP.value, [0, 0.6, 1], [0.4, 1.14, 1]) }],
  }))
  const flameA = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(flameP.value, [0, 0.3, 0.6, 1], [0, -12, 8, 0])}deg` },
      { scale: interpolate(flameP.value, [0, 0.3, 0.6, 1], [1, 1.25, 1.1, 1]) },
    ],
  }))

  const b = snap?.before.dailyStreak ?? 0
  const a = snap?.after.dailyStreak ?? 0
  const unit = (n: number) => (n === 1 ? "día de racha" : "días de racha")

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View style={[styles.fill, rootA]}>
        <Pressable style={styles.fill} onPress={skip} disabled={settled} accessible={false}>
          <View style={styles.layer}>
            <WeekCard snap={snap} v={week} dotRef={dotRef} />

            <Animated.View style={[styles.mid, shownA]}>
              <Animated.View style={[styles.streak, streakA]}>
                <Animated.View style={flameA}><Flame size={46} color={colors.warning} strokeWidth={2} /></Animated.View>
                <Roll from={b} to={a} p={dailyRoll} size={76} heading />
                <Text size={16} color={colors.mutedForeground} style={styles.streakLabel}>{unitDone ? unit(a) : unit(b)}</Text>
              </Animated.View>
            </Animated.View>
            <View style={styles.titleBox}>
              <Reveal go={revealed} skipped={skipped} delay={260}>
                <Text heading size={40} center>¡Rutina terminada!</Text>
              </Reveal>
              <Reveal go={revealed} skipped={skipped} delay={320} dist={10} dur={360}>
                <Text size={16} center color={colors.mutedForeground}>
                  Hiciste {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"} y {setCount} {setCount === 1 ? "serie" : "series"}. ¡Excelente trabajo!
                </Text>
              </Reveal>
            </View>

            <View style={styles.tiles}>
              {[
                { v: exerciseCount, k: "Ejercicios" },
                { v: setCount, k: "Series" },
                { v: snap ? snap.after.weeklyStreak : "–", k: "Semanas seguidas" },
              ].map((t, i) => (
                <Reveal key={t.k} go={revealed} skipped={skipped} delay={380 + i * 70} dist={16} dur={360} style={styles.tile}>
                  <Text heading size={32} center>{t.v}</Text>
                  <Text size={12} center color={colors.mutedForeground}>{t.k}</Text>
                </Reveal>
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <Animated.View style={btnA}>
              <Button label="Volver a mis rutinas" icon={ArrowLeft} size="lg" disabled={!btnReady} onPress={onBack} />
            </Animated.View>
          </View>

          {/* Anillo: capa por encima de todo; no recibe toques */}
          <View pointerEvents="none" style={styles.ringSlot}>
            <View ref={ringBox} collapsable={false} style={styles.ringBox}>
              <Animated.View style={[styles.glow, glowA]} />
              <Animated.View style={[styles.ring, ringA]}>
                <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: [{ rotate: "-90deg" }] }}>
                  <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill={colors.primary} animatedProps={solidProps} />
                  <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={colors.secondary} strokeWidth={STROKE} />
                  <AnimatedCircle
                    cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={colors.primary} strokeWidth={STROKE}
                    strokeLinecap="round" strokeDasharray={CIRC} animatedProps={progressProps}
                  />
                </Svg>
                <Animated.View style={[styles.ringCenter, labelA]}>
                  <Text heading size={68} tabular center style={{ lineHeight: 72 }}>{count}</Text>
                  <Text size={14} color={colors.mutedForeground}>de {setCount} {setCount === 1 ? "serie" : "series"}</Text>
                </Animated.View>
                <Animated.View style={[styles.ringCenter, okA]}>
                  <Check size={84} color={colors.primaryForeground} strokeWidth={2.6} />
                </Animated.View>
              </Animated.View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1, overflow: "hidden" },
  layer: { flex: 1, padding: 20, gap: 14 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radiusLg, padding: 20 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.6 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: colors.primary },
  dotFuture: { backgroundColor: "transparent", borderWidth: 2, borderStyle: "dashed", borderColor: colors.border },
  dotFillLayer: { borderRadius: DOT / 2, backgroundColor: colors.primary },
  dotRing: { borderRadius: DOT / 2, borderWidth: 2, borderColor: colors.primary },
  dotCheck: { position: "absolute", alignItems: "center", justifyContent: "center" },
  mid: { alignItems: "center", paddingTop: 20 },
  streak: { flexDirection: "row", alignItems: "center", gap: 10 },
  streakLabel: { maxWidth: 110, lineHeight: 20 },
  titleBox: { gap: 8, alignItems: "stretch" },
  tiles: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radiusLg,
    paddingVertical: 14, paddingHorizontal: 8, gap: 4,
  },
  ringSlot: { position: "absolute", left: 0, right: 0, top: "43%", marginTop: -SIZE / 2, alignItems: "center" },
  ringBox: { width: SIZE, height: SIZE },
  ring: { width: SIZE, height: SIZE },
  glow: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.primary },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
})
