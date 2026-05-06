import { use } from "react"
import { SessionView } from "./session-view"

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  return <SessionView sessionId={sessionId} />
}
