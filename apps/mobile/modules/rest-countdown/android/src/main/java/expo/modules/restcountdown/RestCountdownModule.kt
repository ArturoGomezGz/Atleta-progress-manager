package expo.modules.restcountdown

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Notificación fija con cuenta regresiva nativa (cronómetro): el sistema la
// actualiza solo, con la pantalla bloqueada o la app dormida. Silenciosa: el
// sonido de fin lo da la alerta programada del canal "workout-timer".
class RestCountdownModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RestCountdown")

    Function("show") { endAtMs: Double, title: String, body: String, color: String? ->
      show(endAtMs.toLong(), title, body, color)
    }

    Function("clear") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Descanso en curso", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Cuenta regresiva del descanso mientras entrenas."
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  private fun show(endAtMs: Long, title: String, body: String, color: String?) {
    val remaining = endAtMs - System.currentTimeMillis()
    if (remaining <= 0) return
    ensureChannel()

    // Ícono monocromo que genera el plugin de expo-notifications; si no está, el de la app
    val small = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon

    // Al tocarla vuelve a la app tal como estaba (pantalla de entrenamiento)
    val tap = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(small)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(true)
      .setWhen(endAtMs)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      // Se quita sola al terminar: ahí toma el relevo la alerta de fin de descanso
      .setTimeoutAfter(remaining + 1000)
      .setContentIntent(tap)
    runCatching { if (color != null) builder.setColor(Color.parseColor(color)) }

    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones (Android 13+): el descanso sigue funcionando en la app
    }
  }

  companion object {
    private const val CHANNEL_ID = "rest-countdown"
    private const val NOTIFICATION_ID = 7301
  }
}
