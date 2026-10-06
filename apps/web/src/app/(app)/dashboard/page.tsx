"use client"

import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

export default function DashboardPage() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: teams } = trpc.teams.list.useQuery()
  const ensureCalled = useRef(false)
  const ensureDefault = trpc.teams.ensureDefault.useMutation({
    onSuccess: async ({ teamId }) => {
      await utils.teams.list.invalidate()
      router.replace(`/teams/${teamId}/plantillas`)
    },
  })

  useEffect(() => {
    if (!teams || teams.length === 0) return
    // Si el usuario entrena en algún equipo, lo primero que necesita ver es su "Hoy"
    const athleteTeam = teams.find((t) => t.role === "athlete")
    if (athleteTeam && !teams.some((t) => t.role === "coach")) {
      router.replace(`/teams/${athleteTeam.team.id}/mis-rutinas`)
    } else {
      router.replace(`/teams/${teams[0].team.id}/plantillas`)
    }
  }, [teams, router])

  // Usuario sin equipos: se le crea "Mi equipo" solo, sin pedir nombre, y entra al onboarding.
  // Si falla se reintenta una vez; después se ofrece un botón para reintentar.
  useEffect(() => {
    if (teams === undefined || teams.length > 0 || ensureCalled.current) return
    ensureCalled.current = true
    ensureDefault.mutate(undefined, { onError: () => ensureDefault.mutate() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams])

  if (teams === undefined) return null
  // Mientras se crea el equipo por defecto (o ya se creó y vamos a él) no se muestra el estado vacío
  if (teams.length === 0 && (ensureDefault.isPending || ensureDefault.isSuccess)) return null

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center space-y-4 max-w-sm w-full">
          <p className="text-lg">No pudimos preparar tu equipo.</p>
          <button
            onClick={() => ensureDefault.mutate()}
            className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md font-medium cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return null
}
