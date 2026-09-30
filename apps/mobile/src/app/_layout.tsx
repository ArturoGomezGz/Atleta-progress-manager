// Un import por peso: el índice de cada paquete arrastraría las 18 variantes al APK
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold"
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold"
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular"
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium"
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold"
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold"
import { useSession } from "@/lib/auth"
import { useFonts } from "expo-font"
import { colors } from "@/lib/theme"
import { TRPCProvider } from "@/lib/trpc"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { ActivityIndicator, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

export default function RootLayout() {
  // Mismas fuentes que la web; vienen dentro del APK, no se descargan
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
  })
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background }} />

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
