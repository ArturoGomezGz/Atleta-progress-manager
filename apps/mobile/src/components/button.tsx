import { Text } from "@/components/text"
import { colors, radius, radiusLg } from "@/lib/theme"
import type { LucideIcon } from "lucide-react-native"
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

type Variant = "primary" | "destructive" | "secondary" | "outline" | "ghost"

type Props = {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: Variant
  /** `lg` es el botón grande del pie del ejecutor (min-h-16 text-xl en la web). */
  size?: "md" | "lg"
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.primaryForeground },
  destructive: { bg: colors.destructive, fg: "#ffffff" },
  secondary: { bg: colors.secondary, fg: colors.foreground },
  outline: { bg: "transparent", fg: colors.foreground, border: colors.border },
  ghost: { bg: "transparent", fg: colors.mutedForeground },
}

export function Button({ label, onPress, loading, disabled, variant = "primary", size = "md", icon: Icon, style }: Props) {
  const p = palette[variant]
  const lg = size === "lg"
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      style={({ pressed }) => [
        styles.base,
        lg ? styles.lg : styles.md,
        { backgroundColor: p.bg },
        p.border && { borderWidth: 1, borderColor: p.border },
        (disabled || loading) && styles.disabled,
        pressed && lg && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading
          ? <ActivityIndicator color={p.fg} />
          : Icon && <Icon color={p.fg} size={lg ? 26 : 20} strokeWidth={lg ? 2.75 : 2} />}
        <Text size={lg ? 20 : 16} weight={lg ? "bold" : "semibold"} color={p.fg}>{label}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  md: { borderRadius: radius, paddingVertical: 13, paddingHorizontal: 18 },
  lg: { borderRadius: radiusLg, minHeight: 64, paddingHorizontal: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  disabled: { opacity: 0.5 },
})
