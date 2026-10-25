import { betterFetch } from "@better-fetch/fetch"
import type { Session } from "better-auth/types"
import { NextResponse, type NextRequest } from "next/server"

// `/r` son las rutinas compartidas por enlace: se entrenan sin cuenta.
// La cuenta se pide al terminar, en /reclamar, que sí exige sesión.
// `/oauth/consent` (conector MCP) llega con una query firmada que se perdería en un redirect
// al login; la sesión la exige better-auth al consentir.
const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/r", "/oauth"]

// Rutas que next.config.ts reescribe a la API y que llegan a better-auth (límites de tasa por IP).
const API_PROXY_PATHS = ["/api/auth", "/.well-known"]

// Firma de las peticiones que el web reenvía a la API: con ella la API toma como IP del cliente la que
// el web puso en X-Forwarded-For (la del usuario) en vez de la IP de salida del web, que compartirían
// todos los usuarios en los límites de login. WEB_PROXY_SECRET no es NEXT_PUBLIC_: solo existe en el
// servidor y nunca llega al navegador. Ver docs/deploy.md ("IP del cliente y TRUST_PROXY").
const WEB_PROXY_HEADER = "x-atleta-web-proxy"

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isApiProxy(pathname: string) {
  return API_PROXY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Headers hacia la API: sin la firma que pudiera mandar el cliente y con la nuestra si hay secreto. */
function signedHeaders(source: Headers): Headers {
  const headers = new Headers(source)
  headers.delete(WEB_PROXY_HEADER)
  const secret = process.env.WEB_PROXY_SECRET
  if (secret) headers.set(WEB_PROXY_HEADER, secret)
  return headers
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Proxy a la API (rewrite de next.config.ts): sin sesión ni redirecciones, solo la firma
  if (isApiProxy(pathname)) return NextResponse.next({ request: { headers: signedHeaders(request.headers) } })

  if (isPublic(pathname)) return NextResponse.next()

  // La consulta de sesión también va firmada y con la IP del usuario: get-session tiene el límite
  // general de better-auth por IP y, sin esto, contaría a todos los usuarios como la IP del web
  const sessionHeaders = signedHeaders(new Headers({ cookie: request.headers.get("cookie") ?? "" }))
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor && process.env.WEB_PROXY_SECRET) sessionHeaders.set("x-forwarded-for", forwardedFor)
  const { data: session } = await betterFetch<Session>("/api/auth/get-session", {
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: sessionHeaders,
  })

  if (!session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // `/api/telegram` es el webhook del bot: lo llama Telegram, sin sesión ni redirecciones.
  // `/trpc` queda fuera: cada procedimiento autoriza por su cuenta (y los de
  // invitado son públicos a propósito). Si pasara por aquí, las llamadas de
  // quien no tiene sesión se redirigirían al login — y las de quien sí la
  // tiene pagarían una consulta de sesión extra por cada petición de datos.
  // Iconos y manifest de la app (`icon.svg`, `apple-icon.png`, `manifest.webmanifest`, `icons/`)
  // se piden sin sesión: el navegador los descarga también en el login.
  // `/api/auth` y `/.well-known` (discovery OAuth del conector MCP) sí pasan, pero solo para firmar la
  // petición que se reenvía a la API: nunca piden sesión ni redirigen (ver isApiProxy).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|api/telegram|trpc).*)"],
}
