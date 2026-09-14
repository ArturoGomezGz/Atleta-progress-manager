"use client"

import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DashboardPage() {
  const router = useRouter()
  const { data: teams } = trpc.teams.list.useQuery()

  useEffect(() => {
    if (!teams || teams.length === 0) return
    // Si el usuario entrena en algún equipo, lo primero que necesita ver es su rutina
    const athleteTeam = teams.find((t) => t.role === "athlete")
    if (athleteTeam && !teams.some((t) => t.role === "coach")) {
      router.replace(`/teams/${athleteTeam.team.id}/mis-rutinas`)
    } else {
      router.replace(`/teams/${teams[0].team.id}/sesiones`)
    }
  }, [teams, router])

  if (teams === undefined) return null

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-lg">Todavía no perteneces a ningún equipo.</p>
          <p className="text-muted-foreground">
            Pídele a tu entrenador el enlace de invitación, o crea un equipo desde el menú.
          </p>
        </div>
      </div>
    )
  }

  return null
}
