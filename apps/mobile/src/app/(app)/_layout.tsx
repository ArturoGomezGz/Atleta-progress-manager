import { colors, fonts } from "@/lib/theme"
import { Stack } from "expo-router"

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.heading, fontSize: 24 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ title: "" }} />
      {/* El ejecutor ocupa toda la pantalla; se sale con su botón "Salir" */}
      <Stack.Screen name="train/[id]" options={{ headerShown: false, gestureEnabled: false, animation: "slide_from_bottom" }} />
    </Stack>
  )
}
