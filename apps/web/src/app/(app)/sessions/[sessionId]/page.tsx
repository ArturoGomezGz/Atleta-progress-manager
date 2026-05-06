import { SessionView } from "./session-view"

export default function SessionPage({ params }: { params: { sessionId: string } }) {
  return <SessionView sessionId={params.sessionId} />
}
