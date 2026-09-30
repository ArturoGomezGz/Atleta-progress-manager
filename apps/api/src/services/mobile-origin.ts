import type { BetterAuthPlugin } from "better-auth"

// La app Android no manda cabecera Origin (no es un navegador) y better-auth
// rechaza sin ella las peticiones que usan cookies. El cliente de
// @better-auth/expo envía el esquema de la app en `expo-origin`; lo copiamos a
// `origin` para que se valide contra trustedOrigins ("atleta://").
//
// Es la única parte del plugin de servidor de @better-auth/expo que usa el MVP
// (solo correo y contraseña). No instalamos ese paquete en la API porque pnpm le
// resuelve Expo y React Native como peers y la imagen de Docker crece ~370 MB.
// Si la app llega a usar Google, hará falta el plugin oficial.
export const mobileOrigin = (): BetterAuthPlugin => ({
  id: "mobile-origin",
  async onRequest(request) {
    if (request.headers.get("origin")) return
    const expoOrigin = request.headers.get("expo-origin")
    if (!expoOrigin) return
    const headers = new Headers(request.headers)
    headers.set("origin", expoOrigin)
    return { request: new Request(request, { headers }) }
  },
})
