import type { BetterAuthPlugin } from "better-auth"
import { HIDE_METADATA } from "better-auth"
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api"
import { z } from "zod"

// Plugin local para la app Android. Replica, sin instalar el paquete, la parte del plugin de
// servidor de @better-auth/expo (v1.6.9) que necesita la app: correo y contraseña, y "Continuar
// con Google". No instalamos ese paquete en la API porque pnpm le resuelve Expo y React Native
// como peers y la imagen de Docker crece ~370 MB. Al subir better-auth, revisa que siga
// coincidiendo con `dist/index.mjs` del paquete oficial.
//
// 1. `onRequest`: la app no manda cabecera Origin (no es un navegador) y better-auth rechaza sin
//    ella las peticiones que usan cookies. El cliente envía el esquema de la app en `expo-origin`;
//    se copia a `origin` para validarlo contra trustedOrigins ("atleta://").
// 2. `GET /expo-authorization-proxy`: el flujo OAuth se abre en el navegador del sistema, que no
//    tiene la cookie de estado que dejó el sign-in/social de la app. Este endpoint la fija en el
//    navegador y redirige a Google; sin ella el callback falla con `state_mismatch`.
// 3. Hook tras `/callback/:id`: si better-auth redirige a un deep link de la app (esquema
//    confiable, no http/https), se le agrega `?cookie=` con la sesión para que la app la guarde.

// Hosts a los que el proxy puede redirigir. Solo Google está activo en auth.ts.
const AUTHORIZATION_HOSTS = new Set(["accounts.google.com"])

/** El proxy solo reenvía a la pantalla de autorización de un proveedor conocido, por https. */
export function isAllowedAuthorizationURL(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === "https:" && !url.username && !url.password && !url.port && AUTHORIZATION_HOSTS.has(url.hostname)
}

const expoAuthorizationProxy = createAuthEndpoint(
  "/expo-authorization-proxy",
  {
    method: "GET",
    query: z.object({ authorizationURL: z.string().max(4096), oauthState: z.string().max(512).optional() }),
    metadata: HIDE_METADATA,
  },
  async (ctx) => {
    const { authorizationURL, oauthState } = ctx.query
    if (!isAllowedAuthorizationURL(authorizationURL)) {
      throw new APIError("BAD_REQUEST", { message: "authorizationURL no permitida" })
    }
    if (oauthState) {
      // Estado guardado en base de datos: la cookie `oauth_state` ya la tiene la app.
      const cookie = ctx.context.createAuthCookie("oauth_state", { maxAge: 600 })
      ctx.setCookie(cookie.name, oauthState, cookie.attributes)
      return ctx.redirect(authorizationURL)
    }
    const state = new URL(authorizationURL).searchParams.get("state")
    if (!state) throw new APIError("BAD_REQUEST", { message: "Falta el estado OAuth" })
    const cookie = ctx.context.createAuthCookie("state", { maxAge: 300 })
    await ctx.setSignedCookie(cookie.name, state, ctx.context.secret, cookie.attributes)
    return ctx.redirect(authorizationURL)
  },
)

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
  endpoints: { expoAuthorizationProxy },
  hooks: {
    after: [
      {
        matcher: (context) => !!context.path?.startsWith("/callback/"),
        handler: createAuthMiddleware(async (ctx) => {
          const headers = ctx.context.responseHeaders
          const location = headers?.get("location")
          if (!location) return
          let redirect: URL
          try {
            redirect = new URL(location)
          } catch {
            return
          }
          // Solo deep links de la app: las redirecciones web se dejan como están
          if (redirect.protocol === "http:" || redirect.protocol === "https:") return
          if (!ctx.context.isTrustedOrigin(location)) return
          const cookie = headers?.get("set-cookie")
          if (!cookie) return
          redirect.searchParams.set("cookie", cookie)
          ctx.setHeader("location", redirect.toString())
        }),
      },
    ],
  },
})
