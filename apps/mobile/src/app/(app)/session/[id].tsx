// Vista previa de la sesión: qué incluye la rutina y el botón para empezarla o
// continuarla. Si ya se terminó, muestra el resumen de lo que se hizo.
import { Button } from "@/components/button"
import { Text } from "@/components/text"
import { RoutineCards } from "@/components/workout/cards"
import { VideoModal } from "@/components/workout/video"
import { ensureNotificationPermission } from "@/lib/notifications"
import { colors, radiusLg } from "@/lib/theme"
import { trpc } from "@/lib/trpc"
import { doneSets, groupForPreview, sc, totalSets, type WorkoutExercise } from "@/lib/workout"
import { useState } from "react"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { Calendar, CheckCircle, Play } from "lucide-react-native"
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const utils = trpc.useUtils()
  const [video, setVideo] = useState<WorkoutExercise | null>(null)
  const { data, isLoading, isError, refetch } = trpc.sessions.myProgress.useQuery({ sessionId: id })
  const activate = trpc.sessions.activate.useMutation({
    onSuccess: async () => {
      await Promise.all([refetch(), utils.sessions.myPending.invalidate()])
      router.push({ pathname: "/train/[id]", params: { id } })
    },
  })

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
  }
  if (isError || !data) {
    return (
      <View style={[styles.center, { gap: 16, padding: 24 }]}>
        <Text center color={colors.mutedForeground}>No pudimos cargar esta sesión.</Text>
        <Button label="Reintentar" onPress={() => refetch()} />
      </View>
    )
  }

  const total = totalSets(data.exercises)
  const done = doneSets(data.exercises)
  const exerciseCount = groupForPreview(data.exercises).reduce((n, g) => n + (g.kind === "circuit" ? g.exercises.length : 1), 0)
  const scheduled = data.status === "scheduled"
  const active = data.status === "active"

  async function start() {
    // Permiso para avisar cuando termine un descanso con el teléfono bloqueado
    await ensureNotificationPermission()
    if (scheduled) activate.mutate({ id })
    else router.push({ pathname: "/train/[id]", params: { id } })
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 6 }}>
          <Text heading size={36}>{sc(data.routineName ?? "Rutina")}</Text>
          <View style={styles.inline}>
            <Calendar size={18} color={colors.mutedForeground} />
            <Text color={colors.mutedForeground}>{exerciseCount} ejercicios · {total} series en total</Text>
          </View>
        </View>

        {scheduled && (
          <View style={styles.intro}>
            <Text size={16}>
              Antes de empezar, puedes tocar cada ejercicio para <Text weight="bold">ver el video</Text> de cómo se hace.
              Cuando estés listo, pulsa <Text weight="bold">Empezar rutina</Text>.
              La pantalla se mantendrá encendida y te avisaremos con sonido y vibración al terminar cada descanso.
            </Text>
          </View>
        )}
        {active && done > 0 && (
          <View style={styles.intro}>
            <Text size={16}>Llevas <Text weight="bold">{done} de {total}</Text> series. Sigue donde te quedaste.</Text>
          </View>
        )}
        {data.status === "completed" && (
          <View style={[styles.banner, { borderColor: "rgba(16,185,129,0.3)", backgroundColor: colors.successSoft }]}>
            <CheckCircle size={24} color={colors.success} />
            <Text size={18} weight="medium">Rutina terminada · {done} series completadas</Text>
          </View>
        )}
        {data.status === "cancelled" && (
          <View style={[styles.banner, { backgroundColor: colors.mutedSoft }]}>
            <Text>Esta rutina fue cancelada por tu entrenador.</Text>
          </View>
        )}

        <RoutineCards exercises={data.exercises} showProgress={!scheduled} onWatch={setVideo} />
      </ScrollView>

      <VideoModal exercise={video} onClose={() => setVideo(null)} />

      {(scheduled || active) && (
        <View style={styles.footer}>
          <Button
            label={activate.isPending ? "Preparando…" : scheduled ? "Empezar rutina" : "Continuar rutina"}
            icon={Play}
            size="lg"
            loading={activate.isPending}
            onPress={start}
          />
          {activate.isError && <Text size={15} color={colors.destructive} center>No se pudo empezar. Inténtalo de nuevo.</Text>}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 4, gap: 20 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  intro: { borderRadius: radiusLg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "rgba(71,142,255,0.2)", padding: 16 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radiusLg, borderWidth: 1, borderColor: colors.border, padding: 16 },
  footer: { padding: 16, paddingTop: 12, gap: 6, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
})
