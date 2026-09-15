"use client"

// Último paso del embudo del invitado: ya con cuenta (recién creada o existente),
// el entrenamiento anónimo que guardó el navegador se convierte en una sesión
// real de su historial. Llegan aquí desde /register?redirect=/reclamar.

import { clearGuestWorkout, readGuestWorkout } from "@/lib/guest-workout"
import { trpc } from "@/lib/trpc/client"
import { CheckCircleIcon, DumbbellIcon, LoaderCircleIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

export default function ClaimPage() {
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const claimed = useRef(false)

  const claim = trpc.share.claim.useMutation({ onSuccess: () => clearGuestWorkout() })

  useEffect(() => {
    setToken(readGuestWorkout()?.token ?? null)
    setChecked(true)
  }, [])

  useEffect(() => {
    if (!token || claimed.current) return
    claimed.current = true
    claim.mutate({ token })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!checked || claim.isPending) {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-4 py-12">
          <LoaderCircleIcon className="w-8 h-8 text-primary animate-spin" />
          <p className="text-base text-muted-foreground">Guardando tu entrenamiento…</p>
        </div>
      </Screen>
    )
  }

  // Sin token: abrió el enlace en otro navegador o limpió sus datos
  if (!token) {
    return (
      <Screen>
        <Card>
          <DumbbellIcon className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-semibold">No encontramos tu entrenamiento</p>
          <p className="text-base text-muted-foreground">
            Solo podemos recuperarlo desde el mismo navegador donde hiciste la rutina.
            Tu cuenta ya está lista: puedes empezar desde aquí.
          </p>
          <Link href="/dashboard" className="inline-block text-base text-primary font-medium">Ir a Atleta</Link>
        </Card>
      </Screen>
    )
  }

  if (claim.isError) {
    return (
      <Screen>
        <Card>
          <p className="text-lg font-semibold">No pudimos guardar tu entrenamiento</p>
          <p className="text-base text-muted-foreground">{claim.error.message}</p>
          <Link href="/dashboard" className="inline-block text-base text-primary font-medium">Ir a Atleta</Link>
        </Card>
      </Screen>
    )
  }

  if (claim.isSuccess) {
    const { teamId, teamName, joinedTeam, personalTeam } = claim.data
    return (
      <Screen>
        <Card>
          <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-xl font-bold">¡Tu entrenamiento está guardado!</p>
          <p className="text-base text-muted-foreground">
            {joinedTeam
              ? `Ya formas parte de ${teamName}. Tu entrenador podrá asignarte rutinas y seguir tu progreso.`
              : personalTeam
                ? "Lo guardamos en tu espacio personal. Cuando tu entrenador te invite a su equipo, podrás entrenar con él."
                : `Lo guardamos en ${teamName ?? "tu equipo"}.`}
          </p>
          <Link
            href={`/teams/${teamId}/mis-rutinas`}
            className="w-full inline-flex items-center justify-center min-h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg"
          >
            Ver mis rutinas
          </Link>
        </Card>
      </Screen>
    )
  }

  return <Screen><LoaderCircleIcon className="w-8 h-8 text-primary animate-spin mx-auto" /></Screen>
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-2xl p-8 space-y-4 bg-card text-center">{children}</div>
}
