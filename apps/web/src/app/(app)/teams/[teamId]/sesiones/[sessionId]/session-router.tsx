"use client"

import { useSession } from "@/lib/auth"
import { trpc } from "@/lib/trpc/client"
import { NormalSessionAthleteView } from "./normal-session-athlete-view"
import { SessionView } from "./session-view"

type Props = { sessionId: string; teamId: string }

export function SessionRouter({ sessionId, teamId }: Props) {
  const { data: authSession } = useSession()
  const { data: session } = trpc.sessions.get.useQuery({ id: sessionId })
  const { data: teams } = trpc.teams.list.useQuery()

  if (!session || !authSession) {
    return <div className="p-8 text-sm text-muted-foreground">Cargando sesión...</div>
  }

  const isCoach = teams?.find((t) => t.team.id === session.teamId)?.role === "coach"

  if (!isCoach && (session as any).sessionType === "normal") {
    return (
      <NormalSessionAthleteView
        sessionId={sessionId}
        teamId={teamId}
        userId={authSession.user.id}
      />
    )
  }

  return <SessionView sessionId={sessionId} />
}
