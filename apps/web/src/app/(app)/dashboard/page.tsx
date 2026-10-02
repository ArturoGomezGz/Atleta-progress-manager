"use client"

import { readGuestWorkout } from "@/lib/guest-workout"
import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { NewTeamForm } from "../new-team-form"

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

  // Usuario sin equipos: se le crea "Mi equipo", salvo que venga a reclamar un
  // entrenamiento de invitado (su destino es /reclamar, no un equipo propio).
  useEffect(() => {
    if (teams === undefined || teams.length > 0 || ensureCalled.current) return
    if (readGuestWorkout()) return
    ensureCalled.current = true
    ensureDefault.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams])

  if (teams === undefined) return null
  // Mientras se crea el equipo por defecto (o ya se creó y vamos a él) no se muestra el estado vacío
  if (teams.length === 0 && (ensureDefault.isPending || ensureDefault.isSuccess)) return null

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="space-y-2">
            <p className="text-lg">Todavía no perteneces a ningún equipo.</p>
            <p className="text-muted-foreground">
              Pídele a tu entrenador el enlace de invitación, o crea tu propio equipo.
            </p>
          </div>
          <NewTeamForm className="space-y-2 text-left" />
        </div>
      </div>
    )
  }

  return null
}
