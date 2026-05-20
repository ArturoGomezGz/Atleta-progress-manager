import { redirect } from "next/navigation"

export default async function SesionesRedirect({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  redirect(`/teams/${teamId}/rutinas`)
}
