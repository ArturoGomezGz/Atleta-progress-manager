"use client"

import { signIn, signUp } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AuthShell, EmailCollapse, GoogleIcon } from "../_components/auth-ui"
import { OAUTH_EXPIRED_MESSAGE, OAuthNotice, followOAuthRedirect, useOAuthFlow } from "../_components/oauth-flow"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? "/dashboard"
  // Conectar una app de IA (conector MCP): si el registro deja la sesión iniciada, sigue el flujo OAuth
  const oauth = useOAuthFlow()
  const loginHref = oauth.active ? `/login?${oauth.query}` : "/login"

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [emailInUse, setEmailInUse] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setEmailInUse(false)

    const result = await signUp.email({ name, email, password, callbackURL: redirectTo })

    if (result.error) {
      setEmailOpen(true)
      if (result.error.status === 422) {
        setEmailInUse(true)
      } else if (oauth.active && result.error.status === 400) {
        setError(OAUTH_EXPIRED_MESSAGE)
      } else {
        setError("Error al crear la cuenta. Inténtalo de nuevo.")
      }
      setLoading(false)
      return
    }

    // En modo OAuth, si el registro inició sesión, la respuesta trae la URL de consentimiento
    if (oauth.active && followOAuthRedirect(result.data)) return

    // Con AUTO_VERIFY_EMAIL (testing) el registro ya inicia sesión: no hay correo que confirmar.
    if (result.data?.token) {
      router.push(redirectTo)
      return
    }

    const verifyParams = new URLSearchParams({ email })
    if (redirectTo !== "/dashboard") verifyParams.set("redirect", redirectTo)
    router.push(`/verify-email?${verifyParams.toString()}`)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn.social({ provider: "google", callbackURL: redirectTo })
  }

  return (
    <AuthShell tagline={oauth.active ? "Conectar una app de IA" : "Progreso para atletas y coaches"} title="Crea tu cuenta">
      {oauth.active && <OAuthNotice clientName={oauth.clientName} />}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2.5 bg-foreground text-background rounded-lg px-4 min-h-[54px] text-base font-semibold hover:brightness-90 transition-all disabled:opacity-60"
      >
        <GoogleIcon />
        {googleLoading ? "Redirigiendo..." : "Registrarme con Google"}
      </button>

      <EmailCollapse open={emailOpen} onToggle={() => setEmailOpen((v) => !v)} label="Crear cuenta con correo">
      <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="register-name" className="text-sm font-medium text-foreground">Nombre</label>
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="register-email" className="text-sm font-medium text-foreground">Correo electrónico</label>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="register-password" className="text-sm font-medium text-foreground">Contraseña</label>
                  <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                {emailInUse && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                    <p className="text-sm text-foreground">Este correo ya tiene una cuenta.</p>
                    <div className="flex gap-3 text-sm">
                      <a href={loginHref} className="text-primary hover:brightness-110 font-medium">
                        Iniciar sesión
                      </a>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground rounded-lg px-4 min-h-[50px] text-[15px] font-semibold disabled:opacity-50 hover:brightness-110 transition-all"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </form>
      </EmailCollapse>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <a href={loginHref} className="text-primary hover:brightness-110 font-medium">
          Inicia sesión
        </a>
      </p>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
