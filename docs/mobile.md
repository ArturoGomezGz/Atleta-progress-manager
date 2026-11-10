# App móvil (Android)

`apps/mobile` es una app Expo (React Native) solo para el atleta y solo para
entrenar: ver las rutinas pendientes y ejecutarlas. No planea, no edita, no
muestra historial. Por ahora solo Android.

## Estado

- Hecho:
  - Login con correo y contraseña.
  - Lista de rutinas pendientes de todos los equipos (`sessions.myPending`).
  - Vista previa de la sesión y botón para empezarla (`sessions.activate`) o continuarla.
  - Ejecutor de la rutina (`src/app/(app)/train/[id].tsx`), mismo flujo que el de la
    web: serie en curso → descanso → siguiente serie → pantalla final
    (`sessions.recordSet`, `sessions.completeMySession`). Incluye series por
    repeticiones, por tiempo y "las que puedas", circuitos por rondas, peso por %RM,
    indicaciones del coach y "ver toda la rutina".
  - Lo nativo: pantalla siempre encendida mientras se entrena (`expo-keep-awake`),
    pitidos 3-2-1 y alarma al terminar (`expo-audio`, se mezclan con la música y se
    pueden silenciar), vibración (`expo-haptics`) y una notificación del sistema si
    el descanso o una serie por tiempo termina con la app en segundo plano
    (`expo-notifications`, canal "Temporizador de entrenamiento").
  - Celebración al terminar la rutina (`src/components/workout/finish-celebration.tsx`,
    ~2,5 s): un anillo se llena con las series hechas, vuela al punto de hoy de la
    tarjeta "Esta semana" y la racha cuenta +1. Usa `sessions.myMomentum` (se invalida
    al completar la sesión) con `lib/momentum.ts`: "antes" = historial sin la sesión
    recién terminada, "después" = con ella. Todo es transform/opacity (más el
    `strokeDashoffset` del anillo) con Reanimated en el hilo de UI. Un toque salta al
    final; con movimiento reducido solo hay un fundido de 250 ms. Hápticos: Light al
    terminar, Success al cerrar el anillo, Medium al aterrizar hoy.
  - Mismas fuentes (Inter y Barlow Condensed) y colores que la web.
  - Videos de los ejercicios (`src/components/workout/video.tsx`): miniatura en
    las tarjetas con "Ver cómo se hace" (video a pantalla completa con la
    descripción) y reproductor en la serie en curso. Es el embed de YouTube dentro
    de un `react-native-webview`; YouTube exige un Referer, así que la página del
    iframe se carga con origen `https://com.atleta.app` (el id del paquete). Las
    URLs de YouTube salen de `@atleta/db/youtube`, igual que en la web.
  - Notificaciones push cuando el entrenador asigna un entrenamiento (FCM, `src/lib/push.ts`; ver [notificaciones.md](notificaciones.md)). Hace falta `google-services.json` en el build.
- Siguiente: cola offline para las series registradas.

Los temporizadores se calculan con la hora de fin, no restando segundos, así que
siguen siendo exactos si el teléfono se bloquea. En Android 14+ el sistema puede
retrasar un poco la notificación si no se concede "Alarmas y recordatorios" a la
app; con la pantalla encendida (lo normal durante la rutina) no afecta.

Los sonidos (`assets/sounds/*.wav`) son tonos generados; `rest_end.wav` también es
el sonido de la notificación (empaquetado por el plugin de `expo-notifications`).

## Correr en local

1. Levanta la API (`pnpm dev:api`) con su base de datos.
2. `cp apps/mobile/.env.example apps/mobile/.env` y ajusta `EXPO_PUBLIC_API_URL`
   (emulador: `http://10.0.2.2:3001`; teléfono: la IP de tu equipo en la red local).
3. `pnpm --filter @atleta/mobile start` y abre con Expo Go o el emulador (`a`).

Chequeos: `pnpm --filter @atleta/mobile typecheck`.

## Autenticación

La app usa el cliente de `@better-auth/expo`: guarda la cookie de sesión en
`expo-secure-store` y la manda en cada llamada tRPC (`src/lib/trpc.tsx`).

Como la app no envía cabecera `Origin`, el cliente manda `expo-origin: atleta://`
y la API la copia a `origin` (`apps/api/src/services/mobile-origin.ts`) para
validarla contra `trustedOrigins`.

**Continuar con Google.** El botón de `login.tsx` llama a `signIn.social` con
`callbackURL: "/"` y `errorCallbackURL: "/login"`, que el cliente convierte en deep
links del esquema de la app (`atleta://` en producción, `atleta-testing://` en la
variante de testing; `src/lib/auth.ts` lo lee de `app.config.ts`). Google se abre en
el navegador del sistema (`expo-web-browser`), que no tiene la cookie de estado OAuth
que dejó la petición de la app; sin ella el callback falla con `state_mismatch`. Por
eso la API replica, en el mismo plugin local, las dos piezas del plugin de servidor
de `@better-auth/expo` que hacen falta: `GET /api/auth/expo-authorization-proxy` y un
hook tras `/callback/:id` que, al redirigir a un deep link de la app, agrega
`?cookie=` con la sesión. No instalamos el paquete oficial: pnpm le resolvería Expo
y React Native como peers y la imagen de Docker de la API crecería ~370 MB. Al subir
`better-auth`, compara con `dist/index.mjs` del paquete oficial.

Dominio de la cookie y rebote (`hop`). La app abre el proxy por el dominio de la API
(`API_URL`), pero Google vuelve al dominio del web (`BETTER_AUTH_URL/api/auth/callback/google`)
y una cookie solo viaja al dominio que la fijó; sin más, el callback daría
`state_mismatch`. Por eso el primer salto del proxy no fija nada: valida la URL y
redirige una vez a `BETTER_AUTH_URL/api/auth/expo-authorization-proxy?...&hop=1`
(destino fijo; el web reenvía `/api/auth/*` a la API). Solo con `hop=1` se fija la
cookie de estado, ya en el dominio del web, y se redirige a Google. El URI de
redirección en Google sigue siendo el del web (ver [deploy.md](deploy.md)). En
desarrollo, el emulador debe poder abrir `BETTER_AUTH_URL` (p. ej. `adb reverse
tcp:3000 tcp:3000` si apunta a `localhost:3000`).

Validación: el proxy solo acepta `https://accounts.google.com/o/oauth2/v2/auth` (host y
ruta exactos, sin puerto ni credenciales, `client_id` igual a `GOOGLE_CLIENT_ID`) y
redirige a la URL normalizada; el hook solo reescribe destinos que no son http/https y
están en `trustedOrigins`. La API acepta `atleta://` y, con `MOBILE_APP_ORIGINS`,
`atleta-testing://` (solo en testing).

**Pendiente antes de producción: login-CSRF.** El proxy también es accesible por
`WEB/api/auth/...`, así que alguien podría iniciar un flujo de Google con su propia
cuenta y hacer que la víctima lo complete. Mitigación prevista (no implementada):
aceptar solo estados cuyo `verification` tenga un `callbackURL` que no sea http/https
y quitar la cookie de sesión del navegador (`set-cookie`) cuando el destino es un deep
link, dejándola solo en el parámetro `cookie`.

Estado: sin probar en dispositivo.

El registro con correo y la verificación siguen en la web; con Google la cuenta se
crea directo desde la app.

## Build (APK de prueba)

El workflow `.github/workflows/android-apk.yml` compila un APK apuntando a la API
de testing y lo publica como pre-release de GitHub (`android-preview-<n>`). Corre
en cada push a `testing` que toque `apps/mobile`, o a mano desde Actions (el de
producción sale de `master`, ver `android-apk-production.yml`). Al terminar (bien o mal) avisa por Telegram si existen los secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` de GitHub Actions (los mismos del bot de la API); sin ellos se omite. Va firmado con la llave de depuración: sirve para instalar a mano, no
para la tienda. Para que el login funcione, la API de testing debe tener los
cambios de la app desplegados.

### Testing y producción a la vez en el teléfono

Son dos apps distintas, así que se pueden instalar juntas (cada una con su sesión y sus datos):

| | Identificador | Nombre | Ícono | API |
|---|---|---|---|---|
| Producción | `com.atleta.app` | Atleta | `assets/` | producción |
| Testing | `com.atleta.app.testing` | Atleta Test | `assets/testing/` (franja ámbar «TESTING») | testing |

`app.config.ts` parte de `app.json` y, con `APP_VARIANT=testing` (lo define el workflow
`android-apk.yml`), cambia identificador, nombre e íconos. El esquema `atleta` es el
mismo en ambas: la API lo valida contra `trustedOrigins` y la app no usa enlaces
profundos. Los íconos de testing se generan con `python3 apps/mobile/scripts/testing-icons.py`
a partir de los de `assets/`; hay que volver a correrlo cuando cambien. Los íconos
actuales son los de la plantilla de Expo (provisionales).

Alternativa con EAS: `eas.json` tiene el perfil `preview`, que genera un APK instalable:
`npx eas-cli@latest build --platform android --profile preview`
(requiere cuenta de Expo). El paquete Android de producción es `com.atleta.app`.

## Deploys

La API y la web no copian `apps/mobile` en sus Dockerfiles. En Railway conviene
configurar "watch paths" para que un commit que solo toca `apps/mobile` no
redespliegue la API ni la web.
