import { betterFetch } from "@better-fetch/fetch"
import type { Session } from "better-auth/types"
import { NextResponse, type NextRequest } from "next/server"

// `/r` son las rutinas compartidas por enlace: se entrenan sin cuenta.
// La cuenta se pide al terminar, en /reclamar, que sí exige sesión.
const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/r"]

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
