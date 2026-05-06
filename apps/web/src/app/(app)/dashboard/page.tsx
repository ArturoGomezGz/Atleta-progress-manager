"use client"

import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DashboardPage() {
  const router = useRouter()
  const { data: teams } = trpc.teams.list.useQuery()

  useEffect(() => {
    if (teams && teams.length > 0) {
      router.replace(`/teams/${teams[0].team.id}/sesiones`)
    }
  }, [teams, router])

  if (teams === undefined) return null

  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground text-sm">No perteneces a ningún equipo todavía.</p>
          <p className="text-muted-foreground text-xs">Crea uno usando el selector en la barra lateral.</p>
        </div>
      </div>
    )
  }

  return null
}
