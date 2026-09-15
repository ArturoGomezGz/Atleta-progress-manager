import { use } from "react"
import { ShareLinkView } from "./share-link-view"

export default function ShareLinkPage({ params }: { params: Promise<{ teamId: string; routineId: string }> }) {
  const { teamId, routineId } = use(params)
  return <ShareLinkView teamId={teamId} routineId={routineId} />
}
