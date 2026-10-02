"use client"

// Conecta la sesión del atleta con el ejecutor de rutinas compartido
// (`@/components/workout-runner`), que es la misma pantalla que ve un invitado
// que llega por enlace.

import { OnboardingExploreLink } from "@/components/onboarding"
import {
  RoutinePreview,
  RoutinePreviewSkeleton,
  WorkoutCelebration,
  WorkoutRunner,
  WorkoutRunnerSkeleton,
  WorkoutSummary,
  type WorkoutProgress,
} from "@/components/workout-runner"
import { useSession } from "@/lib/auth"
import { setSignal, usePublishTourSignal } from "@/lib/tour-signals"
import { useFullscreenWhileMounted } from "@/lib/fullscreen-mode"
import { trpc } from "@/lib/trpc/client"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

export function AthleteSessionView({ sessionId }: { sessionId: string }) {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: authSession } = useSession()
  const userId = authSession?.user.id ?? ""

  const { data: progress, refetch, isLoading } = trpc.sessions.myProgress.useQuery(
    { sessionId },
    { refetchInterval: (q) => q.state.data?.status === "active" ? 8000 : false },
  )

  // Una rutina en curso se entrena sin sidebar/topbar. Antes eso lo pedía solo
  // WorkoutRunner, que se monta al terminar de cargar: se veía el esqueleto con el
  // menú puesto y, al llegar los datos, todo se corría a la izquierda. Si venimos de
  // "Mis rutinas" su estado ya está en caché, así que el modo enfocado se aplica al
  // entrar —antes del primer paint— y el esqueleto ya aparece en su lugar final.
  const utils = trpc.useUtils()
  const [listedStatus] = useState(
    () => utils.sessions.myList.getData({ teamId })?.find((s) => s.id === sessionId)?.status,
  )
  const status = progress?.status ?? listedStatus
  useFullscreenWhileMounted(status === "active")
  // Le avisa al tutorial en qué estado está este entrenamiento
  usePublishTourSignal("run.status", progress?.status)

  const { data: rms } = trpc.sessions.athleteRms.useQuery(
    { sessionId, athleteId: userId },
    { enabled: !!userId && (progress?.status === "active" || progress?.status === "completed") },
  )

  const activate = trpc.sessions.activate.useMutation({ onSuccess: () => refetch() })
  const recordSet = trpc.sessions.recordSet.useMutation()
  const completeSession = trpc.sessions.completeMySession.useMutation()

  const back = { href: `/teams/${teamId}/mis-rutinas`, label: "Hoy" }

  if (isLoading || !progress) {
    return status === "active" ? <WorkoutRunnerSkeleton withSidebar={false} /> : <RoutinePreviewSkeleton />
  }

  const typed = progress as unknown as WorkoutProgress

  if (typed.status === "scheduled") {
    return (
      <RoutinePreview
        progress={typed}
        back={back}
        onStart={() => activate.mutate({ id: sessionId })}
        starting={activate.isPending}
        error={activate.isError ? "No se pudo empezar. Inténtalo de nuevo." : undefined}
      />
    )
  }

  if (typed.status === "active") {
    return (
      <WorkoutRunner
        progress={typed}
        rms={rms ?? {}}
        exit={{ href: back.href, label: "Salir" }}
        withSidebar={false}
        onRecordSet={async ({ exercise, target, reps, weightLbs }) => {
          await recordSet.mutateAsync({
            sessionId,
            athleteId: userId,
            sessionExerciseId: exercise.id,
            sessionSetTargetId: target.id,
            setNumber: target.setNumber,
            reps,
            weightLbs,
          })
          // Sin await: el descanso arranca en cuanto la serie queda guardada
          refetch()
        }}
        onFinish={() => completeSession.mutate({ sessionId })}
        doneView={({ exercises, sets }) => (
          <WorkoutCelebration exercises={exercises} sets={sets}>
            <Link
              href={back.href}
              className="w-full max-w-sm flex items-center justify-center gap-2 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl"
            >
              <ArrowLeftIcon className="w-6 h-6" /> Volver a Hoy
            </Link>
            <TourWorkoutDone />
            <OnboardingExploreLink teamId={teamId} />
          </WorkoutCelebration>
        )}
      />
    )
  }

  return <WorkoutSummary progress={typed} back={back} />
}

/** Avisa al tutorial que se llegó a la pantalla final (el estado "completado" del servidor tarda en llegar). */
function TourWorkoutDone() {
  useEffect(() => {
    setSignal("run.done", true)
    return () => setSignal("run.done", undefined)
  }, [])
  return null
}
