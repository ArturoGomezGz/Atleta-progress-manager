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
validarla contra `trustedOrigins`. La API no instala `@better-auth/expo`: pnpm le
resolvería Expo y React Native como peers y la imagen de Docker de la API
crecería ~370 MB. Si la app llega a usar Google, hará falta el plugin oficial.

El registro y la verificación de correo siguen en la web.

## Build (APK de prueba)

El workflow `.github/workflows/android-apk.yml` compila un APK apuntando a la API
de testing y lo publica como pre-release de GitHub (`android-preview-<n>`). Corre
en cada push a `master` que toque `apps/mobile`, o a mano desde Actions. Va firmado con la llave de depuración: sirve para instalar a mano, no
para la tienda. Para que el login funcione, la API de testing debe tener los
cambios de la app desplegados.

Alternativa con EAS: `eas.json` tiene el perfil `preview`, que genera un APK instalable:
`npx eas-cli@latest build --platform android --profile preview`
(requiere cuenta de Expo). El paquete Android es `com.atleta.app`.

## Deploys

La API y la web no copian `apps/mobile` en sus Dockerfiles. En Railway conviene
configurar "watch paths" para que un commit que solo toca `apps/mobile` no
redespliegue la API ni la web.
