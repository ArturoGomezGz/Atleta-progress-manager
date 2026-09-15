"use client"

// Entrada por código para quien recibió la rutina dictada o por mensaje
// ("entra a atleta y pon ABCD2345") en vez del enlace completo.

import { DumbbellIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function EnterCodePage() {
  const router = useRouter()
  const [code, setCode] = useState("")

  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (clean.length !== 8) return
    router.push(`/r/${clean}`)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <DumbbellIcon className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>Atleta</h1>
          <p className="text-base text-muted-foreground">
            Escribe el código que te dio tu entrenador para empezar la rutina.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD2345"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            aria-label="Código de la rutina"
            className="w-full text-center text-2xl font-bold tracking-[0.3em] uppercase bg-card border-2 border-border rounded-2xl px-4 py-4 focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/40 placeholder:tracking-[0.3em]"
          />
          <button
            type="submit"
            disabled={clean.length !== 8}
            className="w-full min-h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg disabled:opacity-40 cursor-pointer"
          >
            Ver rutina
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta? <Link href="/login" className="text-primary font-medium">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
