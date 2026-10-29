# Notificaciones push

Avisos al teléfono del atleta por Firebase Cloud Messaging (FCM). Hoy hay un solo aviso:
**el entrenador le asigna un entrenamiento** (también al programarlo para otra fecha o al asignar
un plan). Solo Android. Ideas para después: aviso de racha en riesgo, recordatorios.

## Cómo funciona

1. La app (`apps/mobile/src/lib/push.ts`, hook `usePushRegistration` en el layout de `(app)`) crea el
   canal «Entrenamientos asignados», pide el permiso (Android 13+), obtiene el token nativo de FCM con
   `getDevicePushTokenAsync` y lo guarda con `notifications.registerDevice`. Si FCM renueva el token,
   lo vuelve a mandar. Al cerrar sesión llama `notifications.unregisterDevice`.
2. Los tokens viven en la tabla `push_device` (un usuario, varios teléfonos; el token es único y pasa
   al usuario que lo registró último).
3. Al asignar (`sessions.create`, `sessions.createMany`, `plans.schedule` y, por reutilizarlos, las
   herramientas MCP) la API llama a `notifyWorkoutAssigned` (`apps/api/src/services/push.ts`) **después**
   de confirmar la transacción y sin esperar: un fallo de FCM nunca rompe la asignación. No avisa al
   coach que se asigna a sí mismo. Un plan manda un solo aviso, no uno por sesión.
4. El envío usa la API HTTP v1 de FCM con `fetch` y la cuenta de servicio (JWT RS256 → token OAuth,
   cacheado); no hay SDK de Firebase. Los tokens que FCM rechaza (app desinstalada) se borran.
5. Al tocar el aviso, la app abre la vista previa de la sesión (`sessionId` en los datos); si son
   varias sesiones o un plan, queda en la lista. Con la app abierta el aviso también se muestra.

## Configuración (una vez)

En la consola de Firebase del proyecto:

1. **Agregar dos apps Android**: `com.atleta.app` (producción) y `com.atleta.app.testing` (testing).
   Descarga el `google-services.json` (trae las dos). No hace falta registrar SHA-1.
2. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**: el JSON de la
   cuenta de servicio. La API de Cloud Messaging (v1) debe estar habilitada (lo está por defecto).

Variables y secretos:

| Dónde | Nombre | Valor |
|---|---|---|
| Railway (API de producción y de testing) | `FIREBASE_SERVICE_ACCOUNT` | El JSON de la cuenta de servicio (tal cual, o en base64). Sin él, la API no envía nada |
| GitHub → Settings → Secrets → Actions | `GOOGLE_SERVICES_JSON` | El contenido del `google-services.json`. Los workflows `android-apk*.yml` lo escriben en `apps/mobile/` antes de compilar; sin él avisan y el APK sale sin push |
| Local | `apps/mobile/google-services.json` | Para correr `expo prebuild` en tu máquina (ignorado por git) |

La clave de la cuenta de servicio es secreta: no se sube al repositorio. La migración
`0006_swift_carnage.sql` crea `push_device`; la API la aplica sola al arrancar.

## Probar

Instala el APK de testing con push, inicia sesión como atleta (acepta el permiso), y desde otra cuenta
de coach asigna un entrenamiento a ese atleta: debe llegar el aviso. Prueba también con la app cerrada,
con un plan, y cerrando sesión (ya no debe llegar).
