import { Button } from "@/components/button"
import { colors, radius } from "@/lib/theme"
import { trpc } from "@/lib/trpc"
import { summarizeTargets } from "@/lib/workout-text"
import { Stack, useLocalSearchParams } from "expo-router"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

// Vista previa de la sesión. El botón "Entrenar" abrirá el ejecutor nativo
// (temporizador, sonidos, notificaciones) en el siguiente paso del MVP.
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isLoading, isError } = trpc.sessions.myProgress.useQuery({ sessionId: id })

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
  }
  if (isError || !data) {
    return <View style={styles.center}><Text style={styles.muted}>No pudimos cargar esta sesión.</Text></View>
  }

  const totalSets = data.exercises.reduce((n, ex) => n + ex.targets.length, 0)
  const doneSets = data.exercises.reduce((n, ex) => n + ex.sets.length, 0)

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <Stack.Screen options={{ title: data.routineName ?? "Sesión" }} />
      <FlatList
        data={data.exercises}
        keyExtractor={(ex) => ex.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.muted}>
            {data.exercises.length} ejercicios · {doneSets} de {totalSets} series hechas
          </Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.index}>{index + 1}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              {item.blockName && <Text style={styles.block}>{item.blockName}</Text>}
              <Text style={styles.name}>{item.exerciseName}</Text>
              <Text style={styles.muted}>{summarizeTargets(item.targets)}</Text>
            </View>
            {item.targets.length > 0 && item.sets.length >= item.targets.length && <Text style={styles.done}>✓</Text>}
          </View>
        )}
      />
      <View style={styles.footer}>
        <Button label="Entrenar (próximamente)" onPress={() => {}} disabled />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  list: { padding: 16, gap: 10 },
  muted: { color: colors.mutedForeground, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: 14,
  },
  index: { color: colors.mutedForeground, fontSize: 15, width: 20, textAlign: "center" },
  block: { color: colors.primary, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  name: { color: colors.foreground, fontSize: 16, fontWeight: "600" },
  done: { color: colors.primary, fontSize: 18, fontWeight: "700" },
  footer: { padding: 16, borderTopColor: colors.border, borderTopWidth: 1 },
})
