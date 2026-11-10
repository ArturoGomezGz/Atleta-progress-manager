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
//    navegador (en el dominio de BETTER_AUTH_URL, ver el rebote `hop`) y redirige a Google; sin
//    ella el callback falla con `state_mismatch`.
// 3. Hook tras `/callback/:id`: si better-auth redirige a un deep link de la app (esquema
//    confiable, no http/https), se le agrega `?cookie=` con la sesión para que la app la guarde.

const AUTHORIZATION_HOST = "accounts.google.com"
const AUTHORIZATION_PATH = "/o/oauth2/v2/auth"

/**
 * Valida que la URL sea la pantalla de autorización de Google (https, host y ruta exactos, sin
 * puerto ni credenciales) y, si se conoce, que el client_id sea el de esta API. Devuelve la URL
 * normalizada (`href`), que es a la que se redirige, o null si no es válida.
 */
export function allowedAuthorizationURL(value: string, clientId?: string): string | null {
  if (value.includes("\\")) return null // la barra invertida se interpreta como "/" y confunde al parser
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null
  if (url.hostname !== AUTHORIZATION_HOST || url.pathname !== AUTHORIZATION_PATH) return null
  if (clientId && url.searchParams.get("client_id") !== clientId) return null
  return url.href
}

const expoAuthorizationProxy = createAuthEndpoint(
  "/expo-authorization-proxy",
  {
    method: "GET",
    query: z.object({
      authorizationURL: z.string().max(4096),
      oauthState: z.string().max(512).optional(),
      hop: z.literal("1").optional(),
    }),
    metadata: HIDE_METADATA,
  },
  async (ctx) => {
    const { authorizationURL, oauthState, hop } = ctx.query
    const target = allowedAuthorizationURL(authorizationURL, process.env.GOOGLE_CLIENT_ID)
    if (!target) throw new APIError("BAD_REQUEST", { message: "authorizationURL no permitida" })

    // La app abre este endpoint por el dominio de la API, pero Google vuelve al callback del dominio
    // web (BETTER_AUTH_URL) y la cookie de estado solo viaja a quien la fijó. Por eso el primer salto
    // rebota, sin cookies, al mismo endpoint en BETTER_AUTH_URL (destino fijo; el web reenvía
    // /api/auth/* a la API) y solo ahí, con hop=1, se fija la cookie y se redirige a Google.
    if (hop !== "1") {
      const next = new URLSearchParams({ authorizationURL: target, hop: "1" })
      if (oauthState) next.set("oauthState", oauthState)
      return ctx.redirect(`${ctx.context.baseURL}/expo-authorization-proxy?${next}`)
    }

    if (oauthState) {
      // Estrategia de estado en cookie: la app ya tiene la cookie `oauth_state` y la fija aquí.
      const cookie = ctx.context.createAuthCookie("oauth_state", { maxAge: 600 })
      ctx.setCookie(cookie.name, oauthState, cookie.attributes)
      return ctx.redirect(target)
    }
    const state = new URL(target).searchParams.get("state")
    if (!state) throw new APIError("BAD_REQUEST", { message: "Falta el estado OAuth" })
    const cookie = ctx.context.createAuthCookie("state", { maxAge: 300 })
    await ctx.setSignedCookie(cookie.name, state, ctx.context.secret, cookie.attributes)
    return ctx.redirect(target)
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
