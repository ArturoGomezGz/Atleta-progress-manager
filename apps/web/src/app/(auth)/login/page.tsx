"use client"

import { authClient, signIn } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [unverified, setUnverified] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const redirectTo = searchParams.get("redirect") ?? "/dashboard"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setUnverified(false)

    const result = await signIn.email({ email, password })

    if (result.error) {
      if (result.error.status === 403) {
        setUnverified(true)
      } else {
        setError("Correo o contraseña incorrectos")
      }
      setLoading(false)
      return
    }

    router.push(redirectTo)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn.social({ provider: "google", callbackURL: redirectTo })
  }

  async function handleResendVerification() {
    setResendSent(false)
    await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" })
    setResendSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-xl shadow-xl bg-card">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Atleta
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {unverified && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <p className="text-sm text-foreground">Debes verificar tu email antes de iniciar sesión.</p>
              {resendSent ? (
                <p className="text-sm text-primary">Email de verificación reenviado.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="text-sm text-primary hover:brightness-110 font-medium"
                >
                  Reenviar email de verificación
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <a href="/register" className="text-primary hover:brightness-110 font-medium">
            Regístrate
          </a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
