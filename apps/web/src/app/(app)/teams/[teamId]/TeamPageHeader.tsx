"use client"

import { trpc } from "@/lib/trpc/client"
import { usePathname } from "next/navigation"

export function TeamPageHeader() {
  const pathname = usePathname()
  const { data: teams } = trpc.teams.list.useQuery()

  const teamId = pathname.match(/^\/teams\/([^/]+)/)?.[1] ?? null
  const team = teams?.find((t) => t.team.id === teamId)

  if (!team?.team.logoDataUrl) return null

  return (
    <div className="flex items-center gap-2.5 px-6 py-2.5 border-b border-border/50 bg-card/40">
      <img
        src={team.team.logoDataUrl}
        alt={team.team.name}
        className="w-5 h-5 rounded-md object-contain shrink-0"
      />
      <span className="text-xs font-medium text-muted-foreground tracking-wide truncate">
        {team.team.name}
      </span>
    </div>
  )
}
