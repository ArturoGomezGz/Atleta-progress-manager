import { Button } from "@/components/button"
import { Text } from "@/components/text"
import { colors } from "@/lib/theme"
import { Modal, Pressable, StyleSheet, View } from "react-native"

type Props = {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación en hoja inferior (modal), para acciones que no se pueden deshacer. */
export function ConfirmSheet({ visible, title, message, confirmLabel, loading, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={loading ? undefined : onCancel} accessibilityLabel="Cerrar" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grab} />
        <Text heading size={28}>{title}</Text>
        <Text color={colors.mutedForeground}>{message}</Text>
        <View style={styles.actions}>
          <Button label="Cancelar" variant="outline" onPress={onCancel} disabled={loading} style={styles.btn} />
          <Button label={confirmLabel} variant="destructive" onPress={onConfirm} loading={loading} style={styles.btn} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 18,
    paddingBottom: 28,
    gap: 10,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, minHeight: 48 },
})
