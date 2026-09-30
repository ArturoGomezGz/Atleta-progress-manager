import { useSession } from "@/lib/auth"
import { colors } from "@/lib/theme"
import { TRPCProvider } from "@/lib/trpc"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { ActivityIndicator, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TRPCProvider>
        <StatusBar style="light" />
        <RootStack />
      </TRPCProvider>
    </SafeAreaProvider>
  )
}

// Sin sesión solo existe la pantalla de login; con sesión, la app.
function RootStack() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const signedIn = !!session
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}
