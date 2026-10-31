// Pestaña Workouts del atleta ("Opción C · Semana"): tira de días y, debajo, el detalle del día
// seleccionado con los bloques encadenados (calentamiento, principal, recuperación).
import { Button } from "@/components/button"
import { ConfirmSheet } from "@/components/confirm-sheet"
import { Text } from "@/components/text"
import { addDaysISO, dayNumber, inlineDateLabel, localDateISO, localTimeLabel, longDateLabel, monthRangeLabel, weekdayShort } from "@/lib/dates"
import { kindLabel, kindNoun, lockMessage, type LockReason } from "@/lib/session-kind"
import { colors, radius, radiusLg } from "@/lib/theme"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useReduceMotion } from "@/lib/use-reduce-motion"
import { router, useFocusEffect } from "expo-router"
import { Check, ChevronLeft, Eye, Inbox, Lock, Moon, Play, Users } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native"

type Item = RouterOutputs["sessions"]["myCalendar"][number]
type TileState = "active" | "done" | "locked" | "skipped" | "plan" | "eval"
type DotKind = "done" | "today" | "plan" | "rest"

const DAYS_BACK = 7
const DAYS_AHEAD = 14
const PILL_W = 48
const PILL_GAP = 6
const STRIP_PAD = 16
const CARD_DIM = "#0f1319"

const isPending = (i: Item) => i.status === "scheduled" || i.status === "active"
const isEval = (i: Item) => i.category === "evaluation"

export default function WorkoutsScreen() {
  const reduceMotion = useReduceMotion()
  const utils = trpc.useUtils()
  const [today, setToday] = useState(() => localDateISO())
  const [selected, setSelected] = useState<string | null>(null) // null = hoy
  const sel = selected ?? today
  const from = addDaysISO(today, -DAYS_BACK)
  const to = addDaysISO(today, DAYS_AHEAD)

  const { data, isLoading, isError, refetch, isRefetching } = trpc.sessions.myCalendar.useQuery({ from, to, localDate: today })

  // Al volver a la pestaña se recalcula "hoy" (por si cambió el día) y se refresca.
  const firstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      setToday(localDateISO())
      if (firstFocus.current) firstFocus.current = false
      else refetch()
    }, [refetch]),
  )

  // Aviso breve (toast)
  const [toast, setToast] = useState<{ msg: string; n: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast((t) => ({ msg, n: (t?.n ?? 0) + 1 }))
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // Sacudida de una tarjeta bloqueada: el objeto cambia en cada toque aunque sea la misma tarjeta.
  const [shake, setShake] = useState<{ id: string } | null>(null)
  const refuse = (id: string, msg: string) => {
    setShake({ id })
    showToast(msg)
  }

  const byDate = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of data ?? []) m.set(i.scheduledDate, [...(m.get(i.scheduledDate) ?? []), i])
    return m
  }, [data])

  const days = useMemo(
    () => Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, k) => addDaysISO(today, k - DAYS_BACK)),
    [today],
  )

  // Saltar / abandonar
  const [confirm, setConfirm] = useState<Item | null>(null)
  const skip = trpc.sessions.skipMyStep.useMutation({
    onSuccess: async () => {
      setConfirm(null)
      await Promise.all([utils.sessions.myCalendar.invalidate(), utils.sessions.myPending.invalidate()])
    },
    onError: (e) => {
      setConfirm(null)
      showToast(e.message)
    },
  })

  // Transición suave al cambiar de día
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (reduceMotion) return
    fade.setValue(0)
    Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [sel, reduceMotion, fade])

  const open = (id: string) => router.push({ pathname: "/session/[id]", params: { id } })
  const pickDay = (d: string) => setSelected(d === today ? null : d)

  const items = byDate.get(sel) ?? []

  return (
    <View style={styles.root}>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {!data || data.length === 0 ? (
            <View style={styles.empty}>
              <Text heading size={28} center>{isError ? "No pudimos cargar tus rutinas" : "Todo al día"}</Text>
              <Text color={colors.mutedForeground} center>
                {isError ? "Desliza hacia abajo para reintentar." : "No tienes rutinas pendientes. Tu coach te asignará la próxima."}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.stripHead}>
                <Text size={13} color={colors.mutedForeground}>{monthRangeLabel(days[0]!, days[days.length - 1]!)}</Text>
              </View>
              <DayStrip days={days} today={today} selected={sel} byDate={byDate} onPick={pickDay} />
              <Legend />
              <Animated.View
                style={{
                  opacity: fade,
                  transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                }}
              >
                <DayDetail
                  date={sel}
                  today={today}
                  items={items}
                  shake={shake}
                  reduceMotion={reduceMotion}
                  onOpen={open}
                  onRefuse={refuse}
                  onToast={showToast}
                  onSkip={setConfirm}
                />
                {sel !== today && (
                  <Pressable
                    onPress={() => setSelected(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Volver a hoy"
                    style={styles.back}
                  >
                    <ChevronLeft size={18} color={colors.mutedForeground} />
                    <Text weight="semibold" color={colors.mutedForeground}>Volver a hoy</Text>
                  </Pressable>
                )}
              </Animated.View>
            </>
          )}
        </ScrollView>
      )}

      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text size={14}>{toast.msg}</Text>
          </View>
        </View>
      )}

      <ConfirmSheet
        visible={confirm !== null}
        title={confirm?.status === "active" ? "Abandonar entrenamiento" : "Saltar bloque"}
        message={
          confirm?.status === "active"
            ? "Se cierra este entrenamiento y las series que ya registraste se conservan. Podrás seguir con el siguiente bloque."
            : "No harás este bloque hoy y se desbloquea el siguiente. Esta acción no se puede deshacer."
        }
        confirmLabel={confirm?.status === "active" ? "Abandonar" : "Saltar bloque"}
        loading={skip.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && skip.mutate({ sessionId: confirm.sessionId, localDate: today })}
      />
    </View>
  )
}

/* ---------- Tira de días ---------- */

function dotFor(date: string, today: string, items: Item[] | undefined): DotKind {
  const live = (items ?? []).filter((i) => i.status !== "cancelled")
  if (live.length === 0) return "rest"
  if (date > today) return "plan"
  return live.some(isPending) ? "today" : "done"
}

function DayStrip({ days, today, selected, byDate, onPick }: {
  days: string[]
  today: string
  selected: string
  byDate: Map<string, Item[]>
  onPick: (d: string) => void
}) {
  const ref = useRef<ScrollView>(null)
  const [width, setWidth] = useState(0)
  const centered = useRef(false)

  // Auto-scroll inicial: "Hoy" queda centrado
  useEffect(() => {
    if (width === 0 || centered.current) return
    centered.current = true
    const center = STRIP_PAD + DAYS_BACK * (PILL_W + PILL_GAP) + PILL_W / 2
    ref.current?.scrollTo({ x: Math.max(0, center - width / 2), animated: false })
  }, [width])

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      contentContainerStyle={styles.strip}
      accessibilityRole="tablist"
      accessibilityLabel="Días"
    >
      {days.map((d) => {
        const isToday = d === today
        const on = d === selected
        const dot = dotFor(d, today, byDate.get(d))
        return (
          <Pressable
            key={d}
            onPress={() => onPick(d)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${isToday ? "Hoy, " : ""}${longDateLabel(d)}, ${dotText(dot)}`}
            style={[
              styles.pill,
              on && (isToday ? styles.pillSelToday : styles.pillSel),
            ]}
          >
            <Text size={10} weight="semibold" color={on && isToday ? "#fff" : colors.mutedForeground} style={styles.upper}>
              {isToday ? "Hoy" : weekdayShort(d)}
            </Text>
            <Text heading size={22} color={on && isToday ? "#fff" : isToday ? colors.primary : colors.foreground}>
              {dayNumber(d)}
            </Text>
            <Dot kind={dot} onPrimary={on && isToday} />
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const dotText = (k: DotKind) => (k === "done" ? "hecho" : k === "today" ? "con pendientes" : k === "plan" ? "planeado" : "descanso")

function Dot({ kind, onPrimary }: { kind: DotKind; onPrimary?: boolean }) {
  const style =
    kind === "done" ? { backgroundColor: colors.success }
    : kind === "today" ? { backgroundColor: onPrimary ? "#fff" : colors.primary }
    : kind === "plan" ? { borderWidth: 1.5, borderColor: onPrimary ? "#fff" : "#5a6576" }
    : { backgroundColor: colors.border }
  return <View style={[styles.dot, style]} />
}

function Legend() {
  const entries: { kind: DotKind; label: string }[] = [
    { kind: "done", label: "Hecho" },
    { kind: "today", label: "Hoy" },
    { kind: "plan", label: "Planeado" },
    { kind: "rest", label: "Descanso" },
  ]
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {entries.map((e) => (
        <View key={e.kind} style={styles.legendItem}>
          <Dot kind={e.kind} />
          <Text size={11} color={colors.mutedForeground}>{e.label}</Text>
        </View>
      ))}
    </View>
  )
}

/* ---------- Detalle del día ---------- */

type DetailProps = {
  date: string
  today: string
  items: Item[]
  shake: { id: string } | null
  reduceMotion: boolean
  onOpen: (sessionId: string) => void
  onRefuse: (id: string, msg: string) => void
  onToast: (msg: string) => void
  onSkip: (item: Item) => void
}

function DayDetail({ date, today, items, shake, reduceMotion, onOpen, onRefuse, onToast, onSkip }: DetailProps) {
  const future = date > today
  const isToday = date === today
  const chain = items.filter((i) => !isEval(i))
  const evals = items.filter(isEval)

  // El activo: el que está en curso o, si no, el primer entrenamiento pendiente y no bloqueado.
  const activeItem = future
    ? undefined
    : chain.find((i) => i.status === "active") ?? chain.find((i) => i.status === "scheduled" && !i.locked)

  const stateOf = (i: Item): TileState => {
    if (i.status === "completed") return "done"
    if (i.status === "cancelled") return "skipped"
    if (future) return "plan"
    if (isEval(i)) return "eval"
    return i.sessionId === activeItem?.sessionId ? "active" : "locked"
  }

  const resolved = chain.filter((i) => i.status === "completed" || i.status === "cancelled").length
  const anyDone = items.some((i) => i.status === "completed")
  const allResolved = items.length > 0 && items.every((i) => i.status === "completed" || i.status === "cancelled")
  const completedDay = allResolved && anyDone

  const head = isToday ? `HOY · ${longDateLabel(date)}` : longDateLabel(date)
  const badge = future
    ? items.length > 0 ? "plan" : null
    : completedDay ? "done" : isToday && items.length > 0 ? "now" : null

  const header = (
    <View style={styles.dayHead}>
      <Text size={13} weight="semibold" color={isToday ? colors.primary : colors.mutedForeground} style={{ flexShrink: 1 }}>{head}</Text>
      {badge && <Badge kind={badge} />}
    </View>
  )

  if (items.length === 0) {
    return (
      <View>
        {header}
        <View style={styles.rest}>
          <Moon size={18} color={colors.mutedForeground} />
          <Text color={colors.mutedForeground}>Descanso. Sin entrenamiento.</Text>
        </View>
      </View>
    )
  }

  const renderTile = (i: Item, idx: number, list: Item[], inChain: boolean) => {
    const state = stateOf(i)
    const hint =
      state === "locked"
        ? i.lockReason === "ANOTHER_ACTIVE"
          ? lockMessage("ANOTHER_ACTIVE")
          : `Se desbloquea al terminar ${activeItem ? kindNoun(activeItem.kind) : "el bloque anterior"}`
        : undefined
    return (
      <View key={i.sessionId} style={!inChain && (idx > 0 || chain.length > 0) ? { marginTop: 12 } : undefined}>
        {inChain && idx > 0 && (
          <View style={styles.joint} accessibilityElementsHidden importantForAccessibility="no">
            <View style={[styles.jointLine, list[idx - 1]!.status === "completed" && { backgroundColor: colors.success }]} />
          </View>
        )}
        <Tile
          item={i}
          index={idx}
          numbered={inChain}
          state={state}
          hint={hint}
          shake={shake?.id === i.sessionId ? shake : null}
          reduceMotion={reduceMotion}
          canSkip={!future && !isEval(i) && (state === "active" || state === "locked")}
          onSkip={() => onSkip(i)}
          onPress={() => {
            if (state === "done") return onOpen(i.sessionId)
            if (state === "skipped") return onToast("Bloque saltado.")
            if (state === "plan") return onRefuse(i.sessionId, `Planeado. ${lockMessage("FUTURE", inlineDateLabel(date))}`)
            if (state === "locked") return onRefuse(i.sessionId, lockMessage(i.lockReason ?? "PREVIOUS_STEP_PENDING"))
            if (state === "eval" && i.locked) return onRefuse(i.sessionId, lockMessage(i.lockReason, inlineDateLabel(date)))
            onOpen(i.sessionId)
          }}
        />
      </View>
    )
  }

  return (
    <View>
      {header}
      {future && (
        <View style={styles.banner}>
          <Eye size={18} color={colors.mutedForeground} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={13} color={colors.mutedForeground}>
              Vista previa de solo lectura. Podrás empezarlo el {inlineDateLabel(date)}.
            </Text>
            <Pressable
              onPress={() => onOpen(items[0]!.sessionId)}
              accessibilityRole="button"
              accessibilityLabel="Ver vista previa"
              style={styles.linkBtn}
            >
              <Text size={13} weight="semibold" color={colors.primary}>Ver vista previa</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!future && chain.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <View style={styles.seg} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {chain.map((i) => {
              const s = stateOf(i)
              return (
                <View
                  key={i.sessionId}
                  style={[styles.segItem, s === "done" && { backgroundColor: colors.success }, s === "active" && { backgroundColor: colors.primary }, s === "skipped" && { backgroundColor: colors.mutedForeground }]}
                />
              )
            })}
          </View>
          <Text size={13} color={colors.mutedForeground}>{resolved} de {chain.length} {chain.length === 1 ? "bloque" : "bloques"}</Text>
        </View>
      )}

      <View style={styles.tiles}>
        {chain.map((i, idx) => renderTile(i, idx, chain, true))}
        {evals.map((i, idx) => renderTile(i, idx, evals, false))}
      </View>

      {completedDay && (
        <View style={styles.doneMsg}>
          <Check size={18} color={colors.success} />
          <Text size={14} color={colors.success} weight="medium">Día completado. Nada más por hoy.</Text>
        </View>
      )}
    </View>
  )
}

function Badge({ kind }: { kind: "now" | "done" | "plan" }) {
  const cfg = {
    now: { label: "Ahora", fg: colors.primary, bg: colors.primarySoft, border: colors.primaryBorder },
    done: { label: "Completado", fg: colors.success, bg: colors.successSoft, border: colors.successBorder },
    plan: { label: "Planeado", fg: colors.mutedForeground, bg: "transparent", border: colors.border },
  }[kind]
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {kind === "done" && <Check size={12} color={cfg.fg} />}
      <Text size={11} weight="semibold" color={cfg.fg}>{cfg.label}</Text>
    </View>
  )
}

/* ---------- Tarjeta de bloque ---------- */

function Tile({ item, index, numbered, state, hint, shake, reduceMotion, canSkip, onPress, onSkip }: {
  item: Item
  index: number
  numbered: boolean
  state: TileState
  hint?: string
  shake: { id: string } | null
  reduceMotion: boolean
  canSkip: boolean
  onPress: () => void
  onSkip: () => void
}) {
  const inProgress = item.status === "active"
  const evaluation = isEval(item)
  const kind = kindLabel(item.kind, item.category)

  // Sacudida al tocar un bloque bloqueado o planeado
  const x = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!shake || reduceMotion) return
    Animated.sequence([
      Animated.timing(x, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(x, { toValue: -5, duration: 70, useNativeDriver: true }),
      Animated.timing(x, { toValue: 5, duration: 70, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }, [shake, reduceMotion, x])

  // Pop del check cuando el bloque pasa a completado estando a la vista
  const scale = useRef(new Animated.Value(1)).current
  const wasDone = useRef(state === "done")
  useEffect(() => {
    const done = state === "done"
    if (done && !wasDone.current && !reduceMotion) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.35, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start()
    }
    wasDone.current = done
  }, [state, reduceMotion, scale])

  const right =
    state === "done" ? (item.completedAt ? `Hecho ${localTimeLabel(item.completedAt)}` : "Hecho")
    : state === "skipped" ? "Saltado"
    : item.scheduledTime

  const stateText =
    state === "done" ? "completado" : state === "skipped" ? "saltado" : state === "locked" ? "bloqueado"
    : state === "plan" ? "planeado" : inProgress ? "en curso" : state === "active" ? "siguiente" : "disponible"

  const dim = state === "done" || state === "locked" || state === "skipped"
  const noun = kindNoun(item.kind)

  return (
    <Animated.View
      style={[
        styles.tile,
        state === "active" && styles.tileActive,
        dim && styles.tileDim,
        state === "plan" && styles.tilePlan,
        state === "locked" && { opacity: 0.8 },
        { transform: [{ translateX: x }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${kind}, ${item.routineName ?? "Sesión libre"}, ${item.exerciseCount} ejercicios, ${stateText}`}
        style={styles.tileRow}
      >
        <Animated.View style={[styles.node, nodeStyle(state), { transform: [{ scale }] }]}>
          {state === "done" ? <Check size={16} color={colors.success} strokeWidth={3} />
            : state === "locked" ? <Lock size={14} color={colors.mutedForeground} />
            : <Text size={14} weight="bold" color={state === "active" ? colors.primary : colors.mutedForeground}>{numbered ? index + 1 : "E"}</Text>}
        </Animated.View>
        <View style={{ flex: 1, gap: 2 }}>
          <KindBadge label={kind} state={state} evaluation={evaluation} />
          <Text heading size={22} color={state === "active" || state === "eval" ? colors.foreground : "#b4bdca"} numberOfLines={2}>
            {item.routineName ?? "Sesión libre"}
          </Text>
          <Text size={13} color={colors.mutedForeground}>
            {item.exerciseCount} {item.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
          </Text>
          <View style={styles.team}>
            <Users size={14} color={colors.mutedForeground} />
            <Text size={13} color={colors.mutedForeground} numberOfLines={1} style={{ flexShrink: 1 }}>{item.teamName}</Text>
          </View>
        </View>
        {right ? <Text size={12} weight="medium" color={state === "done" ? colors.success : colors.mutedForeground}>{right}</Text> : null}
      </Pressable>

      {state === "active" && (
        <View style={styles.halo}>
          <Button
            label={inProgress ? "Continuar" : `Empezar ${noun}`}
            icon={Play}
            onPress={onPress}
            style={{ minHeight: 48 }}
          />
        </View>
      )}
      {state === "locked" && hint && (
        <View style={styles.hint}>
          <Lock size={13} color={colors.mutedForeground} />
          <Text size={12} color={colors.mutedForeground} style={{ flex: 1 }}>{hint}</Text>
        </View>
      )}
      {canSkip && (
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={inProgress ? "Abandonar entrenamiento" : "Saltar bloque"}
          style={styles.skipBtn}
        >
          <Text size={13} color={colors.mutedForeground}>{inProgress ? "Abandonar entrenamiento" : "Saltar bloque"}</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

function KindBadge({ label, state, evaluation }: { label: string; state: TileState; evaluation: boolean }) {
  const fg = evaluation ? colors.warning : state === "active" ? colors.primary : state === "done" ? colors.success : colors.mutedForeground
  return <Text size={11} weight="semibold" color={fg} style={styles.upper}>{label}</Text>
}

function nodeStyle(state: TileState) {
  if (state === "done") return { backgroundColor: colors.successSoft, borderColor: colors.successBorder }
  if (state === "active") return { backgroundColor: colors.primarySoft, borderColor: colors.primary }
  return { backgroundColor: "transparent", borderColor: colors.border }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingTop: 4, paddingBottom: 32, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  upper: { textTransform: "uppercase", letterSpacing: 0.5 },
  stripHead: { paddingHorizontal: 16, paddingBottom: 4 },
  strip: { paddingHorizontal: STRIP_PAD, paddingVertical: 4, gap: PILL_GAP },
  pill: {
    width: PILL_W,
    height: 70,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillSel: { backgroundColor: colors.card, borderColor: colors.border },
  pillSelToday: { backgroundColor: colors.primary, borderColor: colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 16, marginBottom: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  rest: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: radiusLg, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 16, marginTop: 6, padding: 12, borderRadius: radius, borderWidth: 1, borderStyle: "dashed", borderColor: "#5a6576" },
  linkBtn: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  seg: { flexDirection: "row", gap: 4, marginHorizontal: 16, marginBottom: 6 },
  segItem: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  tiles: { marginTop: 14, paddingHorizontal: 16 },
  joint: { height: 14, alignItems: "center" },
  jointLine: { width: 2, flex: 1, backgroundColor: colors.border },
  tile: { borderRadius: radiusLg, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginTop: 0 },
  tileActive: { borderWidth: 2, borderColor: colors.primary },
  tileDim: { backgroundColor: CARD_DIM, borderColor: "#1d232d" },
  tilePlan: { backgroundColor: "transparent", borderStyle: "dashed" },
  tileRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  node: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  team: { flexDirection: "row", alignItems: "center", gap: 6 },
  halo: { borderRadius: radiusLg, padding: 3, backgroundColor: colors.primarySoft },
  hint: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 44 },
  skipBtn: { minHeight: 44, alignItems: "center", justifyContent: "center", marginBottom: -6 },
  doneMsg: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 14 },
  back: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44, marginTop: 16, marginHorizontal: 16, borderRadius: radius, borderWidth: 1, borderColor: colors.border },
  toastWrap: { position: "absolute", left: 16, right: 16, bottom: 16 },
  toast: { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 12 },
})

