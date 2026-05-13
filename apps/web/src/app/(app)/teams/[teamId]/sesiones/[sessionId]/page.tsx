import { use } from "react"
import { SessionRouter } from "./session-router"

export default function SessionPage({
  params,
}: {
  params: Promise<{ teamId: string; sessionId: string }>
}) {
  const { sessionId, teamId } = use(params)
  return <SessionRouter sessionId={sessionId} teamId={teamId} />
}
