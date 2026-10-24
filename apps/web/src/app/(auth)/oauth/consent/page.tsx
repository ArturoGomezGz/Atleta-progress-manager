"use client"

// Consentimiento del conector MCP: una app de IA (Claude, ChatGPT…) pide acceso a la cuenta.
// Llega desde el servidor de autorización con la query firmada (`client_id`, `scope`, …, `sig`);
// `authClient.oauth2.consent` la reenvía sola (oauthProviderClient) y la respuesta trae la URL de
// vuelta a la app, con el código o con access_denied. Sin el flag `mcp` solo se puede cancelar.

import { authClient, useSession } from "@/lib/auth"
import { useFeatures } from "@/lib/features"
import { MCP_SCOPE_LABELS, knownScopes } from "@/lib/mcp-scopes"
import { CheckIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { AuthShell } from "../../_components/auth-ui"
import { followOAuthRedirect } from "../../_components/oauth-flow"

type PublicClient = { client_name?: string; client_uri?: string; logo_uri?: string }

function hostOf(uri: string | undefined): string | null {
  if (!uri) return null
  try {
    return new URL(uri).host
  } catch {
    return null
  }
}

function ConsentForm() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("client_id")
  const signed = searchParams.has("sig") && !!clientId
  const scopes = knownScopes((searchParams.get("scope") ?? "").split(" "))

  const { data: session, isPending: sessionPending } = useSession()
  const { has, isLoading: featuresLoading } = useFeatures()
  const mcpEnabled = has("mcp")

  const [client, setClient] = useState<PublicClient | null>(null)
  const [clientError, setClientError] = useState(false)
  const [submitting, setSubmitting] = useState<"accept" | "deny" | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!signed || !clientId || !session) return
    let cancelled = false
    authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then((res) => {
        if (cancelled) return
        if (res.error) setClientError(true)
        else setClient(res.data as PublicClient)
      })
      .catch(() => !cancelled && setClientError(true))
    return () => {
      cancelled = true
    }
  }, [signed, clientId, session])

  async function decide(accept: boolean) {
    setSubmitting(accept ? "accept" : "deny")
    setError("")
    const res = await authClient.oauth2.consent({ accept })
    if (res.error) {
      setError(
        res.error.status === 400
          ? "El enlace para conectar la app expiró. Vuelve a conectar Atleta desde la app."
          : "No se pudo completar la conexión. Intenta de nuevo.",
      )
      setSubmitting(null)
      return
    }
    if (!followOAuthRedirect(res.data)) setSubmitting(null)
  }

  if (!signed) {
    return (
      <AuthShell tagline="Conectar una app de IA" title="Enlace no válido">
        <p className="text-sm text-muted-foreground text-center">
          Este enlace de conexión está incompleto. Vuelve a conectar Atleta desde la app de IA.
        </p>
      </AuthShell>
    )
  }

  if (!sessionPending && !session) {
    return (
      <AuthShell tagline="Conectar una app de IA" title="Tu sesión terminó">
        <p className="text-sm text-muted-foreground text-center">
          Vuelve a conectar Atleta desde la app de IA para iniciar sesión otra vez.
        </p>
      </AuthShell>
    )
  }

  const name = client?.client_name?.trim() || "Una app"
  const host = hostOf(client?.client_uri)
  const loading = sessionPending || featuresLoading || (!client && !clientError)

  return (
    <AuthShell tagline="Conectar una app de IA" title={`${name} quiere acceder a tu cuenta`}>
      {clientError && (
        <p className="text-destructive text-sm text-center">No encontramos esta app. Vuelve a conectar Atleta desde la app de IA.</p>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm text-muted-foreground space-y-0.5">
          {host && (
            <p>
              Sitio de la app: <span className="text-foreground font-medium">{host}</span>
            </p>
          )}
          {session && (
            <p>
              Cuenta: <span className="text-foreground font-medium">{session.user.email}</span>
            </p>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">Podrá:</p>
        <ul className="space-y-2.5">
          {scopes.map((scope) => (
            <li key={scope} className="flex gap-2.5">
              <CheckIcon className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">{MCP_SCOPE_LABELS[scope].title}</p>
                <p className="text-xs text-muted-foreground">{MCP_SCOPE_LABELS[scope].description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          La app tendrá los mismos permisos que tú en cada equipo. Puedes desconectarla cuando quieras en
          Cuenta → Conectar IA.
        </p>
      </div>

      {!loading && !mcpEnabled && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm text-foreground">El conector para apps de IA aún no está disponible para tu cuenta.</p>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {mcpEnabled && !clientError && (
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={loading || submitting !== null}
          className="w-full bg-primary text-primary-foreground rounded-lg px-4 min-h-[50px] text-[15px] font-semibold disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"
        >
          {submitting === "accept" ? "Conectando..." : "Permitir"}
        </button>
      )}
      <button
        type="button"
        onClick={() => decide(false)}
        disabled={sessionPending || submitting !== null}
        className="w-full border border-border bg-card rounded-lg px-4 min-h-[50px] text-[15px] font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
      >
        {submitting === "deny" ? "Cancelando..." : "Cancelar"}
      </button>
    </AuthShell>
  )
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  )
}
