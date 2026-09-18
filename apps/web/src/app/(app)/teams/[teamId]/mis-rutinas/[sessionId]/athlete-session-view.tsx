"use client"

// Conecta la sesión del atleta con el ejecutor de rutinas compartido
// (`@/components/workout-runner`), que es la misma pantalla que ve un invitado
// que llega por enlace.

import {
  RoutinePreview,
  WorkoutCelebration,
  WorkoutRunner,
  WorkoutSummary,
  type WorkoutProgress,
} from "@/components/workout-runner"
import { useSession } from "@/lib/auth"
import { trpc } from "@/lib/trpc/client"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

export function AthleteSessionView({ sessionId }: { sessionId: string }) {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: authSession } = useSession()
  const userId = authSession?.user.id ?? ""

  const { data: progress, refetch, isLoading } = trpc.sessions.myProgress.useQuery(
    { sessionId },
    { refetchInterval: (q) => q.state.data?.status === "active" ? 8000 : false },
  )

  const { data: rms } = trpc.sessions.athleteRms.useQuery(
    { sessionId, athleteId: userId },
    { enabled: !!userId && (progress?.status === "active" || progress?.status === "completed") },
  )

  const activate = trpc.sessions.activate.useMutation({ onSuccess: () => refetch() })
  const recordSet = trpc.sessions.recordSet.useMutation()
  const completeSession = trpc.sessions.completeMySession.useMutation()

  const back = { href: `/teams/${teamId}/mis-rutinas`, label: "Mis rutinas" }

  if (isLoading || !progress) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <div className="h-6 w-28 bg-muted/40 rounded animate-pulse" />
        <div className="h-10 w-56 bg-muted/40 rounded animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted/40 rounded-2xl animate-pulse" />)}
      </div>
    )
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
              <ArrowLeftIcon className="w-6 h-6" /> Volver a mis rutinas
            </Link>
          </WorkoutCelebration>
        )}
      />
    )
  }

  return <WorkoutSummary progress={typed} back={back} />
}
