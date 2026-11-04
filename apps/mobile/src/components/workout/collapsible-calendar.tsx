// Calendario de la pestaña Workouts: muestra solo la semana seleccionada (sin scroll lateral). Al arrastrar
// hacia abajo se despliega el mes completo en una cuadrícula; en el mes, deslizar a los lados cambia de mes y
// arrastrar hacia arriba (o elegir un día) vuelve a la semana. El botón de la manija hace lo mismo con un toque.
import { Text } from "@/components/text"
import { addMonthsISO, dayNumber, longDateLabel, monthGrid, monthYearLabel, startOfMonthISO, weekdayShort, weekDays } from "@/lib/dates"
import { colors } from "@/lib/theme"
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from "react-native"

export type DotKind = "done" | "today" | "plan" | "rest"

const WEEK_H = 78
const GRID_ROW_H = 52
const WEEKDAY_ROW_H = 26
const MONTH_H = WEEKDAY_ROW_H + GRID_ROW_H * 6
const RANGE = MONTH_H - WEEK_H
const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"]

export const dotText = (k: DotKind) => (k === "done" ? "hecho" : k === "today" ? "con pendientes" : k === "plan" ? "planeado" : "descanso")

export function Dot({ kind, onPrimary }: { kind: DotKind; onPrimary?: boolean }) {
  const style =
    kind === "done" ? { backgroundColor: colors.success }
    : kind === "today" ? { backgroundColor: onPrimary ? "#fff" : colors.primary }
    : kind === "plan" ? { borderWidth: 1.5, borderColor: onPrimary ? "#fff" : "#5a6576" }
    : { backgroundColor: colors.border }
  return <View style={[styles.dot, style]} />
}

type Props = {
  today: string
  selected: string
  /** Primer día del mes que muestra la cuadrícula. */
  month: string
  dotOf: (date: string) => DotKind
  reduceMotion: boolean
  onPick: (date: string) => void
  onMonthChange: (monthStart: string) => void
}

export function CollapsibleCalendar({ today, selected, month, dotOf, reduceMotion, onPick, onMonthChange }: Props) {
  const exp = useRef(new Animated.Value(0)).current // 0 = semana, 1 = mes
  const expValue = useRef(0)
  const slide = useRef(new Animated.Value(0)).current // desplazamiento horizontal de la cuadrícula
  const [expanded, setExpanded] = useState(false)
  const [width, setWidth] = useState(0)

  // Referencias vivas para el PanResponder (se crea una sola vez)
  const live = useRef({ month, selected, width, expanded, reduceMotion, onMonthChange })
  live.current = { month, selected, width, expanded, reduceMotion, onMonthChange }

  useEffect(() => {
    const id = exp.addListener(({ value }) => { expValue.current = value })
    return () => exp.removeListener(id)
  }, [exp])

  // Al volver a la semana, el mes mostrado pasa a ser el del día indicado (por defecto, el seleccionado)
  const animateTo = (target: 0 | 1, day?: string) => {
    setExpanded(target === 1)
    if (target === 0) live.current.onMonthChange(startOfMonthISO(day ?? live.current.selected))
    if (live.current.reduceMotion) return exp.setValue(target)
    Animated.timing(exp, { toValue: target, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }

  const changeMonth = (dir: 1 | -1) => {
    const next = addMonthsISO(live.current.month, dir)
    if (live.current.reduceMotion || live.current.width === 0) return live.current.onMonthChange(next)
    Animated.timing(slide, { toValue: -dir * live.current.width, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => {
      live.current.onMonthChange(next)
      slide.setValue(dir * live.current.width)
      Animated.timing(slide, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    })
  }

  const axis = useRef<"v" | "h" | null>(null)
  const startExp = useRef(0)
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        const vertical = Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx)
        const horizontal = live.current.expanded && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy)
        axis.current = vertical ? "v" : horizontal ? "h" : null
        return axis.current !== null
      },
      onPanResponderGrant: () => {
        exp.stopAnimation()
        startExp.current = expValue.current
      },
      onPanResponderMove: (_e, g) => {
        if (axis.current === "v") exp.setValue(Math.min(1, Math.max(0, startExp.current + g.dy / RANGE)))
        else if (axis.current === "h") slide.setValue(g.dx)
      },
      onPanResponderRelease: (_e, g) => {
        if (axis.current === "v") {
          const open = g.vy > 0.4 ? true : g.vy < -0.4 ? false : expValue.current > 0.5
          animateToRef.current(open ? 1 : 0)
        } else if (axis.current === "h") {
          if (Math.abs(g.dx) > 60 || Math.abs(g.vx) > 0.5) {
            slide.setValue(0)
            changeMonthRef.current(g.dx < 0 ? 1 : -1)
          } else {
            Animated.spring(slide, { toValue: 0, useNativeDriver: false }).start()
          }
        }
        axis.current = null
      },
      onPanResponderTerminate: () => {
        if (axis.current === "v") animateToRef.current(expValue.current > 0.5 ? 1 : 0)
        else Animated.spring(slide, { toValue: 0, useNativeDriver: false }).start()
        axis.current = null
      },
    }),
  ).current
  const animateToRef = useRef(animateTo)
  animateToRef.current = animateTo
  const changeMonthRef = useRef(changeMonth)
  changeMonthRef.current = changeMonth

  const week = useMemo(() => weekDays(selected), [selected])
  const grid = useMemo(() => monthGrid(month), [month])
  const monthPrefix = month.slice(0, 7)
  const thisMonth = startOfMonthISO(today)

  const height = exp.interpolate({ inputRange: [0, 1], outputRange: [WEEK_H, MONTH_H] })
  const weekOpacity = exp.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: "clamp" })
  const gridOpacity = exp.interpolate({ inputRange: [0.3, 1], outputRange: [0, 1], extrapolate: "clamp" })
  const navOpacity = exp.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1], extrapolate: "clamp" })

  const pick = (d: string) => {
    onPick(d)
    if (expanded) animateTo(0, d)
    else onMonthChange(startOfMonthISO(d))
  }

  return (
    <View {...pan.panHandlers} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      <View style={styles.head}>
        <Text size={14} weight="semibold">{monthYearLabel(month)}</Text>
        <View style={styles.headRight}>
          <Animated.View style={[styles.nav, { opacity: navOpacity }]} pointerEvents={expanded ? "auto" : "none"}>
            <Pressable onPress={() => changeMonth(-1)} accessibilityRole="button" accessibilityLabel="Mes anterior" hitSlop={8} style={styles.navBtn}>
              <ChevronLeft size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable onPress={() => changeMonth(1)} accessibilityRole="button" accessibilityLabel="Mes siguiente" hitSlop={8} style={styles.navBtn}>
              <ChevronRight size={20} color={colors.mutedForeground} />
            </Pressable>
          </Animated.View>
          {(selected !== today || month !== thisMonth) && (
            <Pressable onPress={() => pick(today)} accessibilityRole="button" accessibilityLabel="Ir a hoy" hitSlop={8} style={styles.todayBtn}>
              <Text size={12} weight="semibold" color={colors.primary}>Hoy</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Animated.View style={{ height, overflow: "hidden" }}>
        {/* Semana */}
        <Animated.View
          style={[styles.week, { opacity: weekOpacity }]}
          pointerEvents={expanded ? "none" : "auto"}
          accessibilityElementsHidden={expanded}
          importantForAccessibility={expanded ? "no-hide-descendants" : "auto"}
        >
          {week.map((d) => {
            const isToday = d === today
            const on = d === selected
            const dot = dotOf(d)
            return (
              <Pressable
                key={d}
                onPress={() => pick(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${isToday ? "Hoy, " : ""}${longDateLabel(d)}, ${dotText(dot)}`}
                style={[styles.pill, on && (isToday ? styles.pillSelToday : styles.pillSel)]}
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
        </Animated.View>

        {/* Mes */}
        <Animated.View
          style={[styles.month, { opacity: gridOpacity }]}
          pointerEvents={expanded ? "auto" : "none"}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        >
          <View style={styles.weekdays}>
            {WEEKDAY_INITIALS.map((w) => (
              <Text key={w} size={11} weight="semibold" color={colors.mutedForeground} center style={styles.weekdayCell}>{w}</Text>
            ))}
          </View>
          <Animated.View style={[styles.gridWrap, { transform: [{ translateX: slide }] }]}>
            {grid.map((d) => {
              const isToday = d === today
              const on = d === selected
              const inMonth = d.startsWith(monthPrefix)
              const dot = dotOf(d)
              return (
                <Pressable
                  key={d}
                  onPress={() => pick(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${isToday ? "Hoy, " : ""}${longDateLabel(d)}, ${dotText(dot)}`}
                  style={styles.cell}
                >
                  <View style={[styles.cellInner, on && (isToday ? styles.pillSelToday : styles.pillSel), !inMonth && { opacity: 0.4 }]}>
                    <Text size={16} weight={isToday ? "bold" : "medium"} color={on && isToday ? "#fff" : isToday ? colors.primary : colors.foreground}>
                      {dayNumber(d)}
                    </Text>
                    <Dot kind={dot} onPrimary={on && isToday} />
                  </View>
                </Pressable>
              )
            })}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Pressable
        onPress={() => animateTo(expanded ? 0 : 1)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Mostrar solo la semana" : "Mostrar el mes completo"}
        hitSlop={{ top: 4, bottom: 8, left: 40, right: 40 }}
        style={styles.handle}
      >
        <View style={styles.handleBar} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  headRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  nav: { flexDirection: "row", alignItems: "center" },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  todayBtn: { minHeight: 36, paddingHorizontal: 8, justifyContent: "center" },
  upper: { textTransform: "uppercase", letterSpacing: 0.5 },
  week: { position: "absolute", top: 0, left: 0, right: 0, height: WEEK_H, flexDirection: "row", gap: 4, paddingVertical: 4 },
  pill: {
    flex: 1,
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
  month: { position: "absolute", top: 0, left: 0, right: 0, height: MONTH_H },
  weekdays: { flexDirection: "row", height: WEEKDAY_ROW_H, alignItems: "center" },
  weekdayCell: { flex: 1 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: GRID_ROW_H, alignItems: "center", justifyContent: "center" },
  cellInner: {
    width: 42,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  handle: { height: 22, alignItems: "center", justifyContent: "center" },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
})
