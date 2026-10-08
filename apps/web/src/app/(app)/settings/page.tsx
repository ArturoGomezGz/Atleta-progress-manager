"use client"

import { authClient, signOut, useSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-provider"
import { BadgeCheckIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
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

const ghostButtonClass =
  "border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="border border-border rounded-xl bg-card divide-y divide-border">{children}</div>
    </section>
  )
}

function Row({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function PasswordField({
  id, label, value, onChange, autoComplete, show,
}: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; show: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <input id={id} type={show ? "text" : "password"} required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  )
}

function PasswordRow() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH

  function close() {
    setOpen(false)
    setCurrent("")
    setNext("")
    setConfirm("")
    setShow(false)
    setError("")
  }

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
    close()
    setSuccess(true)
  }

  return (
    <div>
      <Row
        title="Contraseña"
        description={success ? "Contraseña actualizada." : "Al cambiarla se cerrarán tus sesiones en otros dispositivos."}
      >
        <button
          type="button"
          onClick={() => (open ? close() : (setSuccess(false), setOpen(true)))}
          aria-expanded={open}
          aria-controls="password-form"
          className={ghostButtonClass}
        >
          {open ? "Cancelar" : "Cambiar"}
        </button>
      </Row>
      {open && (
        <form id="password-form" onSubmit={handleSubmit} className="space-y-3 max-w-sm px-4 pb-4">
          <PasswordField id="current-password" label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" show={show} />
          <PasswordField id="new-password" label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" show={show} />
          {tooShort && <p className="text-xs text-muted-foreground">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>}
          <PasswordField id="confirm-password" label="Confirmar nueva contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" show={show} />
          {mismatch && <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>}

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-primary" />
            Mostrar contraseñas
          </label>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all cursor-pointer"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      )}
    </div>
  )
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  return (
    <div role="group" aria-label="Tema" className="inline-flex gap-0.5 p-0.5 rounded-lg border border-border bg-background">
      {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
            theme === value
              ? "bg-card text-foreground font-medium ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}

function initialsOf(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  const user = session?.user
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-MX", { month: "long", year: "numeric" })
    : null

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Cuenta</h1>

      {user && (
        <div className="border border-border rounded-xl bg-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 text-primary text-lg font-bold flex items-center justify-center shrink-0">
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {user.emailVerified && (
                <span className="inline-flex items-center gap-1 text-primary font-medium">
                  <BadgeCheckIcon className="w-3.5 h-3.5" /> Correo verificado
                </span>
              )}
              {memberSince && <span>Miembro desde {memberSince}</span>}
            </p>
          </div>
        </div>
      )}

      <Group title="Preferencias">
        <Row title="Tema" description="Cómo se ve la aplicación en este dispositivo.">
          <ThemeSwitch />
        </Row>
      </Group>

      <Group title="Seguridad">
        <PasswordRow />
      </Group>

      <Group title="Sesión">
        <Row title="Cerrar sesión" description="Salir en este dispositivo.">
          <button type="button" onClick={handleSignOut} className={`${ghostButtonClass} flex items-center gap-2 text-destructive`}>
            <LogOutIcon className="w-4 h-4" />
            Cerrar sesión
          </button>
        </Row>
      </Group>
    </div>
  )
}
