"use client"

// Login y registro dentro de un flujo OAuth del conector MCP (Claude, ChatGPT…). El servidor
// de autorización manda a /login con la query firmada (`client_id`, …, `exp`, `sig`). Con ella,
// `oauthProviderClient` (lib/auth.ts) agrega `oauth_query` a signIn/signUp y la respuesta trae la
// siguiente URL del flujo (consentimiento o vuelta a la app), a la que el cliente navega solo.
// Por eso, en este modo, las páginas no hacen router.push tras iniciar sesión y conservan la
// query completa en los enlaces entre /login y /register. Ver docs/mcp.md.

import { authClient } from "@/lib/auth"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export function useOAuthFlow() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("client_id")
  const active = searchParams.has("sig") && !!clientId
  const [clientName, setClientName] = useState<string | null>(null)

  useEffect(() => {
    if (!active || !clientId) return
    let cancelled = false
    // Antes de iniciar sesión, el nombre de la app sale de la query firmada
    authClient.oauth2
      .publicClientPrelogin({ client_id: clientId })
      .then((res) => {
        const name = (res.data as { client_name?: string } | null)?.client_name
        if (!cancelled && name) setClientName(name)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active, clientId])

  return {
    active,
    clientName,
    /** Query completa (con la firma) para enlazar entre /login y /register sin perder el flujo. */
    query: active ? searchParams.toString() : "",
  }
}

/** Si la respuesta trae la siguiente URL del flujo OAuth, navega a ella. */
export function followOAuthRedirect(data: unknown): boolean {
  const next = data as { redirect?: boolean; url?: unknown } | null
  if (next?.redirect && typeof next.url === "string") {
    window.location.href = next.url
    return true
  }
  return false
}

export const OAUTH_EXPIRED_MESSAGE = "El enlace para conectar la app expiró. Vuelve a conectar Atleta desde la app."

export function OAuthNotice({ clientName }: { clientName: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
      Inicia sesión para conectar <strong className="font-semibold">{clientName ?? "la app"}</strong> con tu cuenta de Atleta.
      Después podrás revisar qué permisos pide.
    </div>
  )
}
