"use client"

import { useSession } from "@/lib/auth"
import { trpc } from "@/lib/trpc/client"
import { CheckCircleIcon, DumbbellIcon, LoaderCircleIcon } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const joinCalled = useRef(false)

  const join = trpc.teams.joinViaInvite.useMutation()

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.replace(`/login?redirect=/join/${token}`)
      return
    }
    if (!joinCalled.current) {
      joinCalled.current = true
      join.mutate({ token })
    }
  }, [sessionLoading, session])

  if (sessionLoading || (!join.isSuccess && !join.isError)) {
    return <Screen><LoadingState /></Screen>
  }

  if (join.isError) {
    return (
      <Screen>
        <ErrorState message={join.error.message} />
      </Screen>
    )
  }

  if (join.isSuccess) {
    return (
      <Screen>
        <WelcomeState
          teamName={join.data.teamName}
          teamId={join.data.teamId}
          alreadyMember={join.data.alreadyMember}
        />
      </Screen>
    )
  }

  return <Screen><LoadingState /></Screen>
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <LoaderCircleIcon className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Uniéndote al equipo...</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-border rounded-xl p-8 space-y-4 bg-card text-center">
      <p className="text-base font-semibold text-foreground">Enlace no válido</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <a
        href="/dashboard"
        className="inline-block text-sm text-primary hover:brightness-110 font-medium"
      >
        Ir al inicio
      </a>
    </div>
  )
}

function WelcomeState({ teamName, teamId, alreadyMember }: { teamName: string; teamId: string; alreadyMember: boolean }) {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.push(`/teams/${teamId}`), 3000)
    return () => clearTimeout(timer)
  }, [teamId])

  return (
    <div className="border border-border rounded-xl p-8 space-y-5 bg-card text-center">
      <div className="flex justify-center">
        {alreadyMember ? (
          <DumbbellIcon className="w-12 h-12 text-primary" />
        ) : (
          <CheckCircleIcon className="w-12 h-12 text-primary" />
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-xl font-bold text-foreground">
          {alreadyMember ? "Ya eres miembro" : "¡Bienvenido al equipo!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {alreadyMember
            ? `Ya formas parte de ${teamName}.`
            : `Te has unido a ${teamName}. Prepárate para entrenar.`}
        </p>
      </div>
      <button
        onClick={() => router.push(`/teams/${teamId}`)}
        className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold hover:brightness-110 transition-all"
      >
        Ir al equipo
      </button>
      <p className="text-xs text-muted-foreground">Redirigiendo automáticamente...</p>
    </div>
  )
}
