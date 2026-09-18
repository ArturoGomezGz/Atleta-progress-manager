"use client"

import { WelcomeOnboarding } from "@/components/welcome-onboarding"
import { onReopenOnboarding } from "@/lib/onboarding-bus"
import { trpc } from "@/lib/trpc/client"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

// No se muestra la bienvenida encima de una rutina en curso — nadie quiere un
// modal sobre una serie que se está registrando en el gimnasio.
function isWorkoutRoute(pathname: string) {
  if (/^\/sessions\/[^/]+$/.test(pathname)) return true
  const sesiones = pathname.match(/\/sesiones\/([^/]+)$/)
  if (sesiones && sesiones[1] !== "new") return true
  if (/\/mis-rutinas\/[^/]+$/.test(pathname)) return true
  return false
}

function extractTeamId(pathname: string): string | null {
  const m = pathname.match(/^\/teams\/([^/]+)/)
  return m ? m[1] : null
}

export function OnboardingGate() {
  const pathname = usePathname()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [forceOpen, setForceOpen] = useState(false)
  const markedRef = useRef(false)

  // Reapertura manual desde el menú de cuenta: no depende del flag de "ya visto".
  useEffect(() => onReopenOnboarding(() => {
    setDismissed(false)
    setForceOpen(true)
  }), [])

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: prefs } = trpc.preferences.get.useQuery()
  const utils = trpc.useUtils()
  const markSeen = trpc.preferences.markOnboardingSeen.useMutation({
    onSuccess: () => utils.preferences.get.invalidate(),
  })

  const currentTeamId = extractTeamId(pathname)
  const effectiveTeamId = currentTeamId ?? teams?.[0]?.team.id ?? null
  const currentTeam = teams?.find((t) => t.team.id === effectiveTeamId)
  const isCoach = currentTeam?.role !== "athlete"

  const hasTeam = teams !== undefined && teams.length > 0 && effectiveTeamId !== null
  const firstTime = prefs !== undefined && prefs.onboardingSeenAt === null

  const eligible = !dismissed && hasTeam && !isWorkoutRoute(pathname) && (firstTime || forceOpen)

  // Se marca como visto en cuanto se abre, no al cerrarse: si el usuario tiene
  // la app abierta en otro dispositivo, ese es el que no debe volver a mostrarlo.
  // Una reapertura manual no dispara esto otra vez: markedRef ya quedó en true
  // la primera vez, y el flag en servidor no necesita tocarse de nuevo.
  useEffect(() => {
    if (firstTime && eligible && !markedRef.current) {
      markedRef.current = true
      markSeen.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, firstTime])

  if (!eligible || !effectiveTeamId) return null

  return (
    <WelcomeOnboarding
      isCoach={isCoach}
      onDone={() => { setDismissed(true); setForceOpen(false) }}
      onNavigateToExplore={() => router.push(`/teams/${effectiveTeamId}/explorar`)}
    />
  )
}
