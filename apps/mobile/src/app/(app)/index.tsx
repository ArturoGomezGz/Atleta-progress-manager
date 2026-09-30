import { signOut } from "@/lib/auth"
import { sessionDateLabel } from "@/lib/dates"
import { colors, radius } from "@/lib/theme"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useQueryClient } from "@tanstack/react-query"
import { router, Stack } from "expo-router"
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native"

type Pending = RouterOutputs["sessions"]["myPending"][number]

export default function PendingScreen() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch, isRefetching } = trpc.sessions.myPending.useQuery()

  async function handleSignOut() {
    await signOut()
    queryClient.clear()
  }

  const active = data?.filter((s) => s.status === "active") ?? []
  const scheduled = data?.filter((s) => s.status === "scheduled") ?? []
  const sections = [
    { title: "En curso", data: active },
    { title: "Pendientes", data: scheduled },
  ].filter((s) => s.data.length > 0)

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={handleSignOut} hitSlop={12}>
              <Text style={styles.headerAction}>Salir</Text>
            </Pressable>
          ),
        }}
      />
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => <SessionCard session={item} />}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{isError ? "No pudimos cargar tus rutinas" : "Todo al día"}</Text>
              <Text style={styles.emptyText}>
                {isError ? "Desliza hacia abajo para reintentar." : "No tienes rutinas pendientes. Tu coach te asignará la próxima."}
              </Text>
            </View>
          }
        />
      )}
    </>
  )
}

function SessionCard({ session }: { session: Pending }) {
  const inProgress = session.status === "active"
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/session/[id]", params: { id: session.id } })}
      android_ripple={{ color: "rgba(255,255,255,0.08)" }}
      style={[styles.card, inProgress && styles.cardActive]}
    >
      <Text style={styles.cardDate}>{sessionDateLabel(session.scheduledDate, session.startedAt)}</Text>
      <Text style={styles.cardTitle}>{session.routineName ?? "Sesión libre"}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardTeam}>{session.teamName}</Text>
        <Text style={styles.cardAction}>{inProgress ? "Continuar" : "Empezar"}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  headerAction: { color: colors.mutedForeground, fontSize: 16 },
  sectionTitle: { color: colors.mutedForeground, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: 16,
    gap: 4,
    overflow: "hidden",
  },
  cardActive: { borderColor: colors.primary },
  cardDate: { color: colors.mutedForeground, fontSize: 13 },
  cardTitle: { color: colors.foreground, fontSize: 18, fontWeight: "600" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  cardTeam: { color: colors.mutedForeground, fontSize: 14 },
  cardAction: { color: colors.primary, fontSize: 15, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { color: colors.foreground, fontSize: 18, fontWeight: "600" },
  emptyText: { color: colors.mutedForeground, fontSize: 15, textAlign: "center" },
})
