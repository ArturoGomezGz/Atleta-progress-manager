import { use } from "react"
import { AthleteSessionView } from "./athlete-session-view"

export default function AthleteSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  return <AthleteSessionView sessionId={sessionId} />
}
