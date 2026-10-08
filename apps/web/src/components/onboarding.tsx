"use client"

// Tutorial guiado y bloqueante para usuarios nuevos (docs/onboarding.md). El motor visual vive en
// components/tour/tour-overlay.tsx; los pasos, en lib/onboarding-steps.ts. Aquí se conectan con el
// estado guardado (onboarding.get / setStep / setStatus) y con la ruta actual.
//
// Regla de oro: mientras no se conoce el estado (cargando o error) no se muestra ni bloquea nada.

import { TourErrorBoundary, TourOverlay, type TourView } from "@/components/tour/tour-overlay"
import { STEPS, resolveStep, type Step, type TourCtx } from "@/lib/onboarding-steps"
import { setSignal, useTourSignals } from "@/lib/tour-signals"
import { trpc } from "@/lib/trpc/client"
import { CircleHelpIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Una ruta que no corresponde al paso solo se avisa si sigue así un momento: al navegar, la URL y el
// paso se actualizan en instantes distintos y no debe parpadear un aviso falso.
const MISMATCH_DELAY_MS = 350

function useOnboardingQuery() {
  return trpc.onboarding.get.useQuery(undefined, { retry: false })
}

/** Datos del tutorial para marcar elementos objetivo en las pantallas (solo con el tutorial en curso). */
export function useOnboardingHint(teamId: string) {
  const { data } = useOnboardingQuery()
  if (data && data.status === "active" && data.teamId === teamId && "step" in data) {
    return { assignRoutineId: data.assignRoutineId, pendingSessionId: data.pendingSessionId }
  }
  return { assignRoutineId: null, pendingSessionId: null }
}

/** Botón "?" del encabezado de Entrenamientos: reinicia el tutorial desde el primer paso. */
export function OnboardingReopen({ teamId }: { teamId: string }) {
  const utils = trpc.useUtils()
  const { data } = useOnboardingQuery()
  const restart = trpc.onboarding.setStatus.useMutation({ onSettled: () => utils.onboarding.get.invalidate() })
  if (!data || data.teamId !== teamId || data.status === "active") return null
  return (
    <button
      onClick={() => restart.mutate({ status: "active" })}
      disabled={restart.isPending}
      aria-label="Reiniciar tutorial"
      title="Reiniciar tutorial"
      className="p-2 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0 disabled:opacity-50"
    >
      <CircleHelpIcon className="w-5 h-5" />
    </button>
  )
}

/** Enlace a Explorar en la pantalla de felicitación (ahí no hay menú). Solo lo puede pulsar el tutorial. */
export function OnboardingExploreLink({ teamId }: { teamId: string }) {
  const { data } = useOnboardingQuery()
  if (!data || data.status !== "active" || data.teamId !== teamId) return null
  return (
    <Link
      href={`/teams/${teamId}/explorar`}
      data-tour="explore-cta"
      className="w-full max-w-sm flex items-center justify-center min-h-14 rounded-2xl border-2 border-primary text-primary font-bold text-lg"
    >
      Conocer Explorar
    </Link>
  )
}

export function OnboardingTour() {
  return (
    <TourErrorBoundary>
      <Tour />
    </TourErrorBoundary>
  )
}

function Tour() {
  const pathname = usePathname()
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data, dataUpdatedAt } = useOnboardingQuery()
  const signals = useTourSignals()

  const setStepMutation = trpc.onboarding.setStep.useMutation()
  const setStatusMutation = trpc.onboarding.setStatus.useMutation()

  const active = data && data.status === "active" && "step" in data ? data : null

  // Paso que se acaba de avanzar aquí: manda sobre lo guardado mientras se confirma la escritura
  const [override, setOverride] = useState<Step | null>(null)
  useEffect(() => { if (!active) setOverride(null) }, [active])
  // Aviso del entrenamiento en curso ya cerrado con "Entendido"
  const [runInfoClosed, setRunInfoClosed] = useState(false)

  // Datos frescos: pedidos al servidor después de entrar a esta ruta. Solo esos sirven para retroceder.
  // (se anota al renderizar, no en un efecto: ese primer render con la ruta nueva aún trae datos viejos)
  const route = useRef({ path: pathname, at: 0 })
  if (route.current.path !== pathname) route.current = { path: pathname, at: Date.now() }
  useEffect(() => { if (active) void utils.onboarding.get.invalidate() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const routineIdParam = useSearchParams().get("routineId")

  const teamId = active?.teamId ?? ""
  // Otros equipos no tienen tutorial; /dashboard solo redirige
  const inScope =
    !!active &&
    pathname !== "/dashboard" &&
    (!pathname.startsWith("/teams/") || pathname === `/teams/${teamId}` || pathname.startsWith(`/teams/${teamId}/`))

  const ctx: TourCtx | null = active
    ? {
        base: `/teams/${teamId}`,
        pathname,
        routineIdParam,
        assignRoutineId: active.assignRoutineId,
        lastRoutineId: active.lastRoutineId,
        pendingSessionId: active.pendingSessionId,
        hasRoutine: active.hasRoutine,
        hasExercises: active.hasExercises,
        assigned: active.assigned,
        completed: active.completed,
        fresh: dataUpdatedAt >= route.current.at,
        signals,
      }
    : null

  const step: Step | null = active ? (override ?? active.step) : null
  const resolved = step && ctx && inScope ? resolveStep(step, ctx) : step

  const advance = useCallback((next: Step) => {
    // Solo local (no se toca la caché de la consulta: sus datos "frescos" no deben fingirse)
    setOverride(next)
    setStepMutation.mutate({ step: next })
  }, [setStepMutation])

  useEffect(() => {
    if (inScope && step && resolved && resolved !== step) advance(resolved)
  }, [inScope, step, resolved, advance])

  useEffect(() => { setRunInfoClosed(false) }, [resolved])

  // En móvil, con un paso que apunta al menú, el menú lateral se abre solo
  const needsNav = inScope && (resolved === "hoy" || resolved === "explore-go")
  useEffect(() => {
    setSignal("tour.nav", needsNav ? true : undefined)
    return () => setSignal("tour.nav", undefined)
  }, [needsNav])

  const finish = useCallback((status: "dismissed" | "completed") => {
    // Primero se quita todo de la pantalla; luego se guarda (con un reintento si falla)
    utils.onboarding.get.setData(undefined, (old) => (old ? { status, teamId: old.teamId } : old))
    const save = (retry: boolean) =>
      setStatusMutation.mutate({ status }, { onError: () => { if (retry) setTimeout(() => save(false), 1500) } })
    save(true)
  }, [utils, setStatusMutation])

  const skip = useCallback(() => finish("dismissed"), [finish])

  // Aviso de "Sigamos con el tutorial" (ruta que no corresponde al paso)
  // Solo con datos frescos: tras navegar, los datos viejos pueden hacer creer que el paso es otro
  const mismatch = !!(inScope && resolved && ctx && ctx.fresh && !STEPS[resolved].matches(ctx))
  const [showMismatch, setShowMismatch] = useState(false)
  useEffect(() => {
    if (!mismatch) { setShowMismatch(false); return }
    const t = setTimeout(() => setShowMismatch(true), MISMATCH_DELAY_MS)
    return () => clearTimeout(t)
  }, [mismatch, pathname, resolved])

  const views: TourView[] = useMemo(() => {
    if (!inScope || !resolved || !ctx) return []
    const def = STEPS[resolved]
    if (mismatch) {
      if (!showMismatch) return []
      return [{
        key: `resume-${resolved}`,
        selector: null,
        title: "Sigamos con el tutorial",
        body: "Te quedaste a mitad de tu primer entrenamiento. Te llevamos de vuelta al paso donde ibas.",
        action: { label: "Continuar", onClick: () => router.push(def.href(ctx)) },
      }]
    }
    return def.views(ctx).map((v): TourView => {
      const { action, ...rest } = v
      const closed = v.key === "run-active" && runInfoClosed
      return {
        ...rest,
        compact: closed || v.compact,
        action: action
          ? { label: action.label, onClick: action.kind === "complete" ? () => finish("completed") : () => setRunInfoClosed(true) }
          : undefined,
      }
    })
    // ctx cambia con cada señal; sus partes relevantes ya están en las dependencias de abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inScope, resolved, mismatch, showMismatch, pathname, routineIdParam, signals, active, runInfoClosed, finish, router])

  if (views.length === 0) return null
  return <TourOverlay views={views} onSkip={skip} />
}
