import { redirect } from "next/navigation"

export default async function AparienciaPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  redirect(`/teams/${teamId}/equipo`)
}
