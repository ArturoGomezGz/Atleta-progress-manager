import { Button } from "@/components/button"
import { MomentumTracker } from "@/components/momentum/momentum-tracker"
import { Text } from "@/components/text"
import { signOut, useSession } from "@/lib/auth"
import { colors } from "@/lib/theme"
import { trpc } from "@/lib/trpc"
import { useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react-native"
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native"

export default function ProfileScreen() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const { data, isLoading, isError, refetch, isRefetching } = trpc.sessions.myMomentum.useQuery()

  async function handleSignOut() {
    await signOut()
    queryClient.clear()
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={{ gap: 2 }}>
        <Text heading size={32}>{session?.user.name}</Text>
        <Text size={14} color={colors.mutedForeground}>{session?.user.email}</Text>
      </View>

      <Text size={13} weight="semibold" color={colors.mutedForeground} style={styles.eyebrow}>Momentum</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
      ) : isError || !data ? (
        <Text color={colors.mutedForeground}>No pudimos cargar tu momentum. Desliza hacia abajo para reintentar.</Text>
      ) : (
        <MomentumTracker completedAt={data} />
      )}

      <Button label="Cerrar sesión" variant="outline" icon={LogOut} onPress={handleSignOut} style={{ marginTop: 8 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
})
