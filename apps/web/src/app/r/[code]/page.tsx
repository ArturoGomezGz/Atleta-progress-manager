import { use } from "react"
import { GuestWorkoutView } from "./guest-workout-view"

export default function SharedRoutinePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  return <GuestWorkoutView code={code.toUpperCase()} />
}
