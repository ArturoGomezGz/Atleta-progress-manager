import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/** true si el sistema pide reducir animaciones. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {})
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce)
    return () => sub.remove()
  }, [])
  return reduce
}
