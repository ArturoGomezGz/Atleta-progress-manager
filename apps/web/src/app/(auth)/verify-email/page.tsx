"use client"

import { authClient } from "@/lib/auth"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    setLoading(true)
    setSent(false)
    await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" })
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-xl shadow-xl bg-card text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Revisa tu correo
          </h1>
          <p className="text-sm text-muted-foreground">
            Enviamos un enlace de verificación a{" "}
            {email && <span className="text-foreground font-medium">{email}</span>}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Haz clic en el enlace del email para activar tu cuenta. Puede tardar unos minutos.
        </p>

        <div className="space-y-3">
          {sent ? (
            <p className="text-sm text-primary">Email reenviado. Revisa tu bandeja de entrada.</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || !email}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Reenviar email"}
            </button>
          )}

          <a
            href="/login"
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Volver al inicio de sesión
          </a>
        </div>
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
