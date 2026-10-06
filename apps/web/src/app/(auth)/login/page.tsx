"use client"

import { authClient, signIn } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AuthShell, EmailCollapse, GoogleIcon } from "../_components/auth-ui"

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
  const [emailOpen, setEmailOpen] = useState(false)

  const redirectTo = searchParams.get("redirect") ?? "/dashboard"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setUnverified(false)

    const result = await signIn.email({ email, password })

    if (result.error) {
      setEmailOpen(true)
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

  const registerHref = `/register${redirectTo !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`

  return (
    <AuthShell tagline="Progreso para atletas y coaches" title="Entra a tu cuenta">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2.5 bg-foreground text-background rounded-lg px-4 min-h-[54px] text-base font-semibold hover:brightness-90 transition-all disabled:opacity-60"
      >
        <GoogleIcon />
        {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
      </button>

      <EmailCollapse open={emailOpen} onToggle={() => setEmailOpen((v) => !v)} label="Usar correo y contraseña">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-medium text-foreground">Contraseña</label>
              <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
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
            className="w-full bg-primary text-primary-foreground rounded-lg px-4 min-h-[50px] text-[15px] font-semibold disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>
      </EmailCollapse>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <a href={registerHref} className="text-primary hover:brightness-110 font-medium">
          Regístrate
        </a>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
