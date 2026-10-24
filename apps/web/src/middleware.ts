import { betterFetch } from "@better-fetch/fetch"
import type { Session } from "better-auth/types"
import { NextResponse, type NextRequest } from "next/server"

// `/r` son las rutinas compartidas por enlace: se entrenan sin cuenta.
// La cuenta se pide al terminar, en /reclamar, que sí exige sesión.
// `/oauth/consent` (conector MCP) llega con una query firmada que se perdería en un redirect
// al login; la sesión la exige better-auth al consentir.
const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/r", "/oauth"]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const { data: session } = await betterFetch<Session>("/api/auth/get-session", {
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: { cookie: request.headers.get("cookie") ?? "" },
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
  // `.well-known` es el discovery OAuth del conector MCP (lo piden los clientes, sin sesión).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|api/auth|api/telegram|trpc|\\.well-known).*)"],
}
