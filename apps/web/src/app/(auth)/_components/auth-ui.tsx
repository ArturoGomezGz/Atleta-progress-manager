"use client"

import { ChevronDown, Mail } from "lucide-react"
import { useId, type ReactNode } from "react"

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/** Fondo atmosférico + marca "ATLETA" con línea dorada, y la columna del formulario. */
export function AuthShell({ tagline, title, children }: { tagline: string; title: string; children: ReactNode }) {
  return (
    <div className="auth-shell relative min-h-screen isolate overflow-hidden bg-background flex flex-col items-center px-5 pt-16 pb-6 sm:justify-center sm:pt-6">
      <div className="auth-bg" aria-hidden="true" />
      <header className="flex flex-col items-center gap-3 text-center">
        <p
          className="auth-wordmark font-extrabold text-6xl sm:text-8xl leading-[0.9] tracking-[0.06em] text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          ATLETA
        </p>
        <span className="auth-gold-line block h-1 w-14 rounded-full bg-gold" aria-hidden="true" />
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{tagline}</p>
      </header>
      <main className="w-full max-w-sm flex flex-col gap-3 mt-auto pt-8 sm:mt-10 sm:pt-0">
        <h1
          className="text-2xl font-bold text-center text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h1>
        {children}
      </main>
    </div>
  )
}

/**
 * Botón "Usar correo y contraseña" + el formulario, que se abre y cierra con
 * una transición de altura (0fr → 1fr) y fundido. Sin movimiento con prefers-reduced-motion.
 */
export function EmailCollapse({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  children: ReactNode
}) {
  const panelId = useId()
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-center gap-2 border border-border bg-card rounded-lg px-4 min-h-[50px] text-[15px] font-semibold text-foreground hover:bg-muted transition-colors"
      >
        <Mail className="w-[18px] h-[18px]" aria-hidden="true" />
        {label}
        <ChevronDown className="auth-chevron w-[18px] h-[18px]" data-open={open} aria-hidden="true" />
      </button>
      <div id={panelId} className="auth-collapse -mx-1" data-open={open} inert={!open}>
        <div className="auth-collapse-inner">
          <div className="px-1 pt-4 pb-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
