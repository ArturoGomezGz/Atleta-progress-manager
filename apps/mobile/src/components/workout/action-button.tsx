// Botones del pie del ejecutor. Siempre van en pareja a la misma altura:
// el secundario (apoyo, casi siempre "Atrás") a la izquierda y el primario
// (avanzar) a la derecha, con el doble de ancho.
import { Text } from "@/components/text"
import { colors, radiusLg } from "@/lib/theme"
import type { LucideIcon } from "lucide-react-native"
import { Pressable, StyleSheet } from "react-native"

export type ActionTone = "primary" | "success" | "destructive"

const TONES: Record<ActionTone, string> = {
  primary: colors.primary,
  success: colors.success,
  destructive: colors.destructive,
}

export function PrimaryAction({ label, icon: Icon, tone = "primary", disabled, onPress }: {
  label: string
  icon?: LucideIcon
  tone?: ActionTone
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      style={({ pressed }) => [
        styles.base, styles.primary, { backgroundColor: TONES[tone] },
        disabled && styles.disabled,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {Icon && <Icon size={24} color="#fff" strokeWidth={2.75} />}
      <Text size={18} weight="bold" color="#fff" numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

export function SecondaryAction({ label, icon: Icon, disabled, onPress }: {
  label: string
  icon?: LucideIcon
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "rgba(255,255,255,0.1)" }}
      style={({ pressed }) => [styles.base, styles.secondary, disabled && styles.disabled, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {Icon && <Icon size={20} color={colors.foreground} />}
      <Text size={16} weight="medium" numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 56, borderRadius: radiusLg, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingHorizontal: 10, overflow: "hidden",
  },
  primary: { flex: 2 },
  secondary: { flex: 1, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.4 },
})
