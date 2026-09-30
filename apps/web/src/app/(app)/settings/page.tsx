"use client"

import { authClient, signOut, useSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-provider"
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const THEME_OPTIONS = [
  { value: "light" as const,  icon: SunIcon,     label: "Claro"   },
  { value: "dark"  as const,  icon: MoonIcon,    label: "Oscuro"  },
  { value: "system" as const, icon: MonitorIcon, label: "Sistema" },
]

const MIN_PASSWORD_LENGTH = 8

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-xl bg-card p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function PasswordSection() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(false)
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
      return
    }
    if (next !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }
    setLoading(true)
    setError("")

    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })

    setLoading(false)
    if (result.error) {
      setError("No se pudo cambiar la contraseña. Verifica tu contraseña actual.")
      return
    }
    setCurrent("")
    setNext("")
    setConfirm("")
    setSuccess(true)
  }

  return (
    <Section title="Contraseña" description="Al cambiarla se cerrarán tus sesiones en otros dispositivos.">
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Contraseña actual</label>
          <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nueva contraseña</label>
          <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Confirmar nueva contraseña</label>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && <p className="text-sm text-primary">Contraseña actualizada.</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"
        >
          {loading ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </Section>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  return (
    <Section title="Apariencia" description="Elige el tema de la aplicación.">
      <div className="flex gap-2 max-w-sm">
        {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs transition-colors cursor-pointer ${
              theme === value
                ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
    </Section>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        {session && (
          <p className="text-sm text-muted-foreground mt-1">
            {session.user.name} · {session.user.email}
          </p>
        )}
      </div>

      <PasswordSection />
      <AppearanceSection />

      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-destructive hover:bg-muted/60 transition-colors cursor-pointer"
      >
        <LogOutIcon className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  )
}
