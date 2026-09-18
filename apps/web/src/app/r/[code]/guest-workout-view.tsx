"use client"

// Rutina abierta por enlace: cualquiera puede entrenar sin cuenta.
// Solo al terminar se le invita a registrarse, y su entrenamiento se guarda
// en el historial de la cuenta nueva (ver `share.claim`).

import {
  RoutinePreview,
  WorkoutCelebration,
  WorkoutRunner,
  WorkoutSummary,
  type WorkoutProgress,
} from "@/components/workout-runner"
import { useSession } from "@/lib/auth"
import { clearGuestWorkout, readGuestWorkout, storeGuestWorkout } from "@/lib/guest-workout"
import { trpc } from "@/lib/trpc/client"
import { CheckCircleIcon, DumbbellIcon, LoaderCircleIcon, SparklesIcon, UserPlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function GuestWorkoutView({ code }: { code: string }) {
  const router = useRouter()
  const { data: authSession, isPending: sessionLoading } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)

  // Si ya había empezado esta rutina en este navegador, la retomamos donde quedó
  useEffect(() => {
    const stored = readGuestWorkout()
    if (stored?.code === code) setToken(stored.token)
    setRestored(true)
  }, [code])

  const preview = trpc.share.preview.useQuery({ code }, { enabled: restored && !token, retry: false })
  const workout = trpc.share.workout.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false },
  )

  const start = trpc.share.start.useMutation({
    onSuccess: ({ token: newToken }) => {
      storeGuestWorkout({ token: newToken, code })
      setToken(newToken)
    },
  })
  const recordSet = trpc.share.recordSet.useMutation()
  const complete = trpc.share.complete.useMutation()

  // "Empezar más tarde": si ya tiene cuenta, la rutina queda pendiente en "Mis
  // rutinas" sin necesidad de entrenarla como invitado; si no, primero inicia
  // sesión y desde ahí puede volver a decidir.
  const utils = trpc.useUtils()
  const savePending = trpc.share.saveAsPending.useMutation({
    onSuccess: async ({ teamId }) => {
      await utils.sessions.myList.invalidate({ teamId })
      router.push(`/teams/${teamId}/mis-rutinas`)
    },
  })
  function startLater() {
    if (!authSession) {
      router.push(`/login?redirect=${encodeURIComponent(`/r/${code}`)}`)
      return
    }
    savePending.mutate({ code })
  }

  // Solo descartamos el token si el servidor dice que ese entrenamiento ya no
  // existe. Ante un fallo de red lo conservamos: es lo único que guarda la
  // rutina a medias del invitado.
  useEffect(() => {
    if (token && workout.error?.data?.code === "NOT_FOUND") {
      clearGuestWorkout()
      setToken(null)
    }
  }, [token, workout.error])

  function restart() {
    clearGuestWorkout()
    setToken(null)
  }

  if (!restored || sessionLoading || (token ? workout.isLoading : preview.isLoading)) {
    return <CenteredScreen><LoaderCircleIcon className="w-8 h-8 text-primary animate-spin" /></CenteredScreen>
  }

  if (!token && preview.isError) {
    return (
      <CenteredScreen>
        <div className="border border-border rounded-2xl p-8 space-y-3 bg-card text-center max-w-sm">
          <DumbbellIcon className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-semibold">Este enlace ya no está disponible</p>
          <p className="text-base text-muted-foreground">
            Puede que tu entrenador lo haya desactivado. Pídele uno nuevo.
          </p>
          <Link href="/login" className="inline-block text-base text-primary font-medium">Ir a Atleta</Link>
        </div>
      </CenteredScreen>
    )
  }

  // ── Antes de empezar ──
  if (!token && preview.data) {
    const data = preview.data as unknown as WorkoutProgress & {
      teamName: string
      teamLogoDataUrl: string | null
      coachName: string
    }
    return (
      <RoutinePreview
        progress={data}
        withSidebar={false}
        onStart={() => start.mutate({ code })}
        starting={start.isPending}
        startLabel="Empezar ahora"
        secondaryAction={{
          label: "Empezar más tarde",
          onClick: startLater,
          pending: savePending.isPending,
        }}
        error={
          start.isError ? start.error.message
          : savePending.isError ? savePending.error.message
          : undefined
        }
        intro={
          <>
            No necesitas cuenta para entrenar. Toca cada ejercicio para <strong>ver el video</strong> y
            pulsa <strong>Empezar ahora</strong> cuando estés listo, o <strong>Empezar más tarde</strong> para
            guardarla como pendiente y hacerla cuando quieras.
          </>
        }
      >
        <SharedByHeader
          teamName={data.teamName}
          coachName={data.coachName}
          logoDataUrl={data.teamLogoDataUrl}
        />
      </RoutinePreview>
    )
  }

  if (!workout.data) return <CenteredScreen><LoaderCircleIcon className="w-8 h-8 text-primary animate-spin" /></CenteredScreen>

  const progress = workout.data as unknown as WorkoutProgress & { claimed: boolean }

  // ── Ya guardada en una cuenta: solo lectura ──
  if (progress.claimed) {
    return (
      <div className="max-w-xl mx-auto">
        <WorkoutSummary
          progress={progress}
          note={
            <div className="flex items-center gap-3 p-4 border border-primary/30 bg-primary/10 rounded-2xl">
              <CheckCircleIcon className="w-6 h-6 text-primary shrink-0" />
              <p className="text-base">Este entrenamiento ya está guardado en tu cuenta.</p>
            </div>
          }
        />
        <div className="px-4 pb-10 space-y-3">
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 min-h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg"
          >
            Ir a mis rutinas
          </Link>
          <button
            onClick={restart}
            className="w-full flex items-center justify-center min-h-12 rounded-2xl border border-border text-base font-medium cursor-pointer"
          >
            Hacer la rutina otra vez
          </button>
        </div>
      </div>
    )
  }

  // ── Entrenando ──
  return (
    <WorkoutRunner
      progress={progress}
      withSidebar={false}
      onRecordSet={async ({ exercise, target, reps, weightLbs }) => {
        await recordSet.mutateAsync({
          token: token!,
          exerciseOrder: exercise.order,
          setNumber: target.setNumber,
          reps,
          weightLbs,
        })
        // Sin await: el descanso arranca en cuanto la serie queda guardada
        workout.refetch()
      }}
      onFinish={() => complete.mutate({ token: token! })}
      doneView={({ exercises, sets }) => (
        <WorkoutCelebration exercises={exercises} sets={sets} withSidebar={false}>
          <SignUpCta loggedIn={!!authSession} token={token!} />
        </WorkoutCelebration>
      )}
    />
  )
}

// ─── Piezas propias del invitado ───────────────────────────────────────────────

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh flex items-center justify-center px-4">{children}</div>
}

function SharedByHeader({
  teamName, coachName, logoDataUrl,
}: {
  teamName: string
  coachName: string
  logoDataUrl: string | null
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {logoDataUrl ? (
        <img src={logoDataUrl} alt={teamName} className="w-12 h-12 rounded-xl object-cover overflow-hidden shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <DumbbellIcon className="w-6 h-6" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">Rutina compartida por</p>
        <p className="text-lg font-semibold truncate">{coachName} · {teamName}</p>
      </div>
    </div>
  )
}

/**
 * El momento de la conversión: el entrenamiento ya está hecho y guardado de
 * forma anónima; crear la cuenta solo sirve para conservarlo.
 */
function SignUpCta({ loggedIn, token }: { loggedIn: boolean; token: string }) {
  const claim = trpc.share.claim.useMutation({ onSuccess: () => clearGuestWorkout() })

  if (loggedIn) {
    if (claim.isSuccess) {
      return (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-lg text-emerald-500 font-semibold">Guardado en tu cuenta</p>
          <Link
            href={`/teams/${claim.data.teamId}/mis-rutinas`}
            className="w-full flex items-center justify-center gap-2 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl"
          >
            Ver mis rutinas
          </Link>
        </div>
      )
    }
    return (
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => claim.mutate({ token })}
          disabled={claim.isPending}
          className="w-full flex items-center justify-center gap-2 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl cursor-pointer disabled:opacity-50"
        >
          <SparklesIcon className="w-6 h-6" />
          {claim.isPending ? "Guardando…" : "Guardar en mi cuenta"}
        </button>
        {claim.isError && <p className="text-base text-destructive">{claim.error.message}</p>}
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-base leading-relaxed text-left">
        Crea tu cuenta gratis y este entrenamiento queda guardado en tu historial.
        Podrás ver tu progreso y seguir entrenando.
      </div>
      <Link
        href="/register?redirect=/reclamar"
        className="w-full flex items-center justify-center gap-2 min-h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-xl"
      >
        <UserPlusIcon className="w-6 h-6" /> Crear mi cuenta
      </Link>
      <Link
        href="/login?redirect=/reclamar"
        className="w-full flex items-center justify-center min-h-14 rounded-2xl border border-border text-lg font-medium"
      >
        Ya tengo cuenta
      </Link>
    </div>
  )
}
