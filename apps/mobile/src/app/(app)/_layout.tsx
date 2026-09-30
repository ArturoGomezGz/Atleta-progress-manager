import { colors } from "@/lib/theme"
import { Stack } from "expo-router"

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mis rutinas" }} />
      <Stack.Screen name="session/[id]" options={{ title: "" }} />
    </Stack>
  )
}
