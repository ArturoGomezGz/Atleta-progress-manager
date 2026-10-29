// Notificaciones push (FCM): registra el teléfono en la API para que el entrenador pueda
// avisarle al atleta (hoy: cuando le asigna un entrenamiento). Ver docs/notificaciones.md.
import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { useEffect } from "react"
import { colors } from "@/lib/theme"
import { trpc } from "@/lib/trpc"

const CHANNEL = "assigned-workouts"
// Mismo id que ASSIGNMENTS_CHANNEL en apps/api/src/services/push.ts

let lastToken: string | null = null

async function ensureChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Entrenamientos asignados",
    description: "Te avisa cuando tu entrenador te asigna un entrenamiento.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: colors.primary,
  })
}

/** Token del último registro; sirve para darlo de baja al cerrar sesión. */
export const currentPushToken = () => lastToken

/** Abre la sesión asignada si el aviso la trae; si no, la app se queda en la lista. */
function openFromNotification(response: Notifications.NotificationResponse | null | undefined) {
  const sessionId = response?.notification.request.content.data?.sessionId
  if (typeof sessionId === "string") router.push({ pathname: "/session/[id]", params: { id: sessionId } })
}

/**
 * Con sesión iniciada: pide el permiso, registra el token de FCM en la API (y cuando FCM lo
 * renueva) y abre el entrenamiento al tocar el aviso. Sin Firebase configurado en el build
 * (sin google-services.json) falla en silencio y la app sigue sin push.
 */
export function usePushRegistration() {
  const register = trpc.notifications.registerDevice.useMutation()
  const response = Notifications.useLastNotificationResponse()

  useEffect(() => {
    let cancelled = false
    const send = (token: string) => {
      lastToken = token
      register.mutate({ token, platform: "android" })
    }
    ;(async () => {
      try {
        await ensureChannel()
        const current = await Notifications.getPermissionsAsync()
        const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)
        if (!granted || cancelled) return
        const { data } = await Notifications.getDevicePushTokenAsync()
        if (!cancelled && typeof data === "string") send(data)
      } catch {
        // Sin Firebase en el build o sin Play Services: la app funciona igual, sin push
      }
    })()
    const sub = Notifications.addPushTokenListener((t) => {
      if (typeof t.data === "string") send(t.data)
    })
    return () => {
      cancelled = true
      sub.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al tocar el aviso (con la app cerrada, en segundo plano o abierta)
  useEffect(() => {
    if (response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) openFromNotification(response)
  }, [response])
}
