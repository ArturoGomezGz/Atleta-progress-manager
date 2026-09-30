// Avisos locales del ejecutor. Si el atleta bloquea el teléfono o cambia de app
// durante un descanso, el sistema le avisa cuando termina aunque la app esté
// dormida. Con la app abierta no se muestran: ahí suenan los sonidos propios.
import * as Notifications from "expo-notifications"
import { colors } from "@/lib/theme"

const CHANNEL = "workout-timer"
// Mismo archivo que assets/sounds/rest_end.wav, empaquetado por el plugin de expo-notifications
const SOUND = "rest_end.wav"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

let channelReady: Promise<unknown> | null = null

function ensureChannel() {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Temporizador de entrenamiento",
    description: "Te avisa cuando termina un descanso o una serie por tiempo.",
    importance: Notifications.AndroidImportance.HIGH,
    sound: SOUND,
    vibrationPattern: [0, 300, 150, 300],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: colors.primary,
  }).catch(() => {})
  return channelReady
}

/** Pide permiso de notificaciones (Android 13+) la primera vez que se entrena. */
export async function ensureNotificationPermission() {
  await ensureChannel()
  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.granted || !current.canAskAgain) return current.granted
    return (await Notifications.requestPermissionsAsync()).granted
  } catch {
    return false
  }
}

/** Programa el aviso de fin; devuelve su id para cancelarlo si el atleta sigue antes. */
export async function scheduleTimerAlert(endAt: number, title: string, body: string): Promise<string | null> {
  const seconds = Math.round((endAt - Date.now()) / 1000)
  if (seconds < 1) return null
  await ensureChannel()
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: SOUND, color: colors.primary, priority: Notifications.AndroidNotificationPriority.MAX },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL },
    })
  } catch {
    return null
  }
}

export function cancelTimerAlert(id: Promise<string | null> | null) {
  id?.then((v) => { if (v) return Notifications.cancelScheduledNotificationAsync(v) }).catch(() => {})
}
