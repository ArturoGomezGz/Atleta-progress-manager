import { colors, radius } from "@/lib/theme"
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native"

type Props = {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: "primary" | "muted"
}

export function Button({ label, onPress, loading, disabled, variant = "primary" }: Props) {
  const primary = variant === "primary"
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      style={[
        styles.base,
        { backgroundColor: primary ? colors.primary : colors.muted },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading
        ? <ActivityIndicator color={colors.primaryForeground} />
        : <Text style={[styles.label, { color: primary ? colors.primaryForeground : colors.foreground }]}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { borderRadius: radius, paddingVertical: 14, alignItems: "center", overflow: "hidden" },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: "600" },
})
