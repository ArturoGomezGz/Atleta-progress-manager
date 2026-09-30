// Texto de una sola línea que, si no cabe, se recorre de derecha a izquierda en bucle
// (nombres largos de ejercicio). Si cabe se queda quieto; con "reducir movimiento"
// del sistema no se anima y se corta con puntos suspensivos.
import { Text } from "@/components/text"
import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, ScrollView, View } from "react-native"

const GAP = 44
const PX_PER_SECOND = 45

export function MarqueeText({ children, size, heading }: { children: string; size: number; heading?: boolean }) {
  const [boxW, setBoxW] = useState(0)
  const [textW, setTextW] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const x = useRef(new Animated.Value(0)).current

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
  }, [])

  const overflow = textW > 0 && boxW > 0 && textW > boxW + 1
  const animate = overflow && !reduceMotion

  useEffect(() => {
    x.setValue(0)
    if (!animate) return
    const distance = textW + GAP
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -distance, duration: (distance / PX_PER_SECOND) * 1000, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [animate, textW, children, x])

  if (reduceMotion) {
    return <Text heading={heading} size={size} numberOfLines={1} ellipsizeMode="tail">{children}</Text>
  }

  return (
    <View style={{ overflow: "hidden" }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} bounces={false}>
        <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
          <Text heading={heading} size={size} numberOfLines={1} onLayout={(e) => setTextW(e.nativeEvent.layout.width)}>{children}</Text>
          {animate && (
            <>
              <View style={{ width: GAP }} />
              <Text heading={heading} size={size} numberOfLines={1}>{children}</Text>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  )
}
