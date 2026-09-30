import { sessionDateLabel } from "@/lib/dates"
import { Text } from "@/components/text"
import { colors, radiusLg } from "@/lib/theme"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { router } from "expo-router"
import { ChevronRight, Play, Users } from "lucide-react-native"
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View } from "react-native"

type Pending = RouterOutputs["sessions"]["myPending"][number]

export default function PendingScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = trpc.sessions.myPending.useQuery()

  const active = data?.filter((s) => s.status === "active") ?? []
  const scheduled = data?.filter((s) => s.status === "scheduled") ?? []
  const sections = [
    { title: "En curso", data: active },
    { title: "Pendientes", data: scheduled },
  ].filter((s) => s.data.length > 0)

  return (
    <>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          renderSectionHeader={({ section }) => (
            <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item }) => <SessionCard session={item} />}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text heading size={28} center>{isError ? "No pudimos cargar tus rutinas" : "Todo al día"}</Text>
              <Text color={colors.mutedForeground} center>
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
      <View style={{ flex: 1, gap: 2 }}>
        <Text size={14} color={inProgress ? colors.primary : colors.mutedForeground} weight={inProgress ? "semibold" : "regular"}>
          {sessionDateLabel(session.scheduledDate, session.startedAt)}
        </Text>
        <Text heading size={26}>{session.routineName ?? "Sesión libre"}</Text>
        <View style={styles.team}>
          <Users size={15} color={colors.mutedForeground} />
          <Text size={14} color={colors.mutedForeground}>{session.teamName}</Text>
        </View>
      </View>
      {inProgress ? (
        <View style={styles.playBtn}><Play size={20} color={colors.primaryForeground} fill={colors.primaryForeground} /></View>
      ) : (
        <ChevronRight size={24} color={colors.mutedForeground} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  sectionTitle: { textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radiusLg,
    padding: 16,
    overflow: "hidden",
  },
  cardActive: { borderColor: colors.primary, borderWidth: 2 },
  team: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
})
