# App móvil (Android)

`apps/mobile` es una app Expo (React Native) solo para el atleta y solo para
entrenar: ver las rutinas pendientes y ejecutarlas. No planea, no edita, no
muestra historial. Por ahora solo Android.

## Estado

- Hecho: login con correo y contraseña, lista de rutinas pendientes de todos los
  equipos (`sessions.myPending`), vista previa de la sesión (`sessions.myProgress`).
- Siguiente: ejecutor nativo (series, temporizador de descanso en segundo plano,
  notificaciones locales, sonidos, vibración, pantalla encendida) y cola offline
  para las series registradas.

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
en cada push a `feature/mobile-android` que toque `apps/mobile`, o a mano desde
Actions. Va firmado con la llave de depuración: sirve para instalar a mano, no
para la tienda. Para que el login funcione, la API de testing debe tener los
cambios de la app desplegados.

Alternativa con EAS: `eas.json` tiene el perfil `preview`, que genera un APK instalable:
`npx eas-cli@latest build --platform android --profile preview`
(requiere cuenta de Expo). El paquete Android es `com.atleta.app`.

## Deploys

La API y la web no copian `apps/mobile` en sus Dockerfiles. En Railway conviene
configurar "watch paths" para que un commit que solo toca `apps/mobile` no
redespliegue la API ni la web.
