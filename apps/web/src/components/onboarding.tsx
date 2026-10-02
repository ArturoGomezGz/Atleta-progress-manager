"use client"

// Onboarding de usuarios nuevos (docs/onboarding.md): tarjeta "Primeros pasos" en
// Mis entrenamientos, banner en Explorar y CTA al terminar el primer entrenamiento.
// Mientras no se sabe el estado (cargando o error) no se muestra nada.

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react"
import Link from "next/link"

export function useOnboarding(teamId: string) {
  const utils = trpc.useUtils()
  const { data } = trpc.onboarding.get.useQuery(undefined, { retry: false })
  const setStatus = trpc.onboarding.setStatus.useMutation({
    onSuccess: () => utils.onboarding.get.invalidate(),
  })
  // El onboarding pertenece al equipo por defecto; en otros equipos no aparece
  const state = data && data.teamId === teamId ? data : null
  return { state, setStatus: (status: "active" | "dismissed" | "completed") => setStatus.mutate({ status }), pending: setStatus.isPending }
}

/** Botón "?" del encabezado que reabre la tarjeta si se cerró. */
export function OnboardingReopen({ teamId }: { teamId: string }) {
  const { state, setStatus } = useOnboarding(teamId)
  if (state?.status !== "dismissed") return null
  return (
    <button
      onClick={() => setStatus("active")}
      aria-label="Primeros pasos"
      title="Primeros pasos"
      className="p-2 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0"
    >
      <CircleHelpIcon className="w-5 h-5" />
    </button>
  )
}

export function OnboardingCard({ teamId }: { teamId: string }) {
  const { state, setStatus } = useOnboarding(teamId)
  if (state?.status !== "active" || !("assigned" in state)) return null

  const t = `/teams/${teamId}`
  const { firstRoutineId, assigned, completed, hasRoutine, pendingSessionId } = state
  const steps = [
    {
      title: "Crea tu primer entrenamiento",
      desc: "Elige tus ejercicios y series. Una idea simple: un circuito de 2 rondas con 2 o 3 ejercicios.",
      done: hasRoutine,
      href: `${t}/plantillas/nueva`,
      cta: "Crear",
    },
    {
      title: "Asígnatelo",
      desc: "Un entrenamiento es el molde; al asignarlo se convierte en un asignado para ti o tus atletas.",
      done: assigned,
      href: firstRoutineId ? `${t}/sesiones/new?routineId=${firstRoutineId}` : `${t}/sesiones/new`,
      cta: "Asignar",
      disabled: !hasRoutine,
    },
    {
      title: "Hazlo",
      desc: "Empieza desde Hoy y registra tus series.",
      done: completed,
      href: pendingSessionId ? `${t}/mis-rutinas/${pendingSessionId}` : `${t}/mis-rutinas`,
      cta: "Ir a Hoy",
      disabled: !assigned,
    },
    {
      title: "Explora más ejercicios",
      desc: "Descubre el catálogo para armar tus próximos entrenamientos.",
      done: false,
      href: `${t}/explorar`,
      cta: "Explorar",
      disabled: !completed,
    },
  ]
  const current = steps.findIndex((s) => !s.done)

  return (
    <section aria-label="Primeros pasos" className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Primeros pasos</h2>
        <button
          onClick={() => setStatus("dismissed")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <XIcon className="w-3.5 h-3.5" /> Ahora no
        </button>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className={cn("flex items-start gap-3", s.done && "opacity-60")}>
            <span
              className={cn(
                "w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5",
                s.done ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {s.done ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", s.done && "line-through")}>{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
            {!s.done && i === current && !s.disabled && (
              <Link
                href={s.href}
                className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shrink-0"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Banner de Explorar: "Entendido" completa el onboarding. */
export function OnboardingExploreBanner({ teamId }: { teamId: string }) {
  const { state, setStatus, pending } = useOnboarding(teamId)
  if (state?.status !== "active") return null
  return (
    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <p className="text-sm">
        Explorar es el catálogo de ejercicios. Toca uno para ver su video y los músculos que trabaja;
        guarda los que te gusten y los encontrarás en Ejercicios para armar tus entrenamientos.
      </p>
      <button
        onClick={() => setStatus("completed")}
        disabled={pending}
        className="text-sm font-medium px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
      >
        Entendido
      </button>
    </div>
  )
}

/** CTA al terminar un entrenamiento, mientras el onboarding siga en curso. */
export function OnboardingExploreCta({ teamId }: { teamId: string }) {
  const { state } = useOnboarding(teamId)
  if (state?.status !== "active") return null
  return (
    <Link
      href={`/teams/${teamId}/explorar`}
      className="w-full max-w-sm flex items-center justify-center min-h-14 rounded-2xl border-2 border-primary text-primary font-bold text-lg"
    >
      Siguiente: conoce Explorar
    </Link>
  )
}
