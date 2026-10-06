"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""
  const redirectTo = searchParams.get("redirect") ?? "/dashboard"
  const loginHref = `/login${redirectTo !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-xl shadow-xl bg-card text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Estamos revisando tu cuenta
          </h1>
          <p className="text-sm text-muted-foreground">
            Recibimos tu registro{" "}
            {email && <span className="text-foreground font-medium">({email})</span>}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Activaremos tu acceso en unos minutos. Vuelve a iniciar sesión más tarde.
        </p>

        <a
          href={loginHref}
          className="block w-full border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Ir al inicio de sesión
        </a>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
