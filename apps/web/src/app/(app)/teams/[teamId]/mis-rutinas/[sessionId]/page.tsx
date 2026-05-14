"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { ArrowLeftIcon, CheckIcon, ClockIcon } from "lucide-react"
import Link from "next/link"
import { use } from "react"

export default function MySessionPage({ params }: { params: Promise<{ teamId: string; sessionId: string }> }) {
  const { teamId, sessionId } = use(params)
  const { data, isLoading } = trpc.sessions.myProgress.useQuery({ sessionId })

  const backLink = (
    <Link
      href={`/teams/${teamId}/mis-rutinas`}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      Mis rutinas
    </Link>
  )

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {backLink}
        <div className="space-y-3">
          <div className="h-7 w-48 bg-muted/40 rounded animate-pulse" />
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {backLink}
        <p className="text-muted-foreground text-sm">Sesión no encontrada.</p>
      </div>
    )
  }

  const isActive    = data.status === "active"
  const isCompleted = data.status === "completed"

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {backLink}

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          {data.routineName ?? "Rutina"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(data.startedAt).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      {/* Status banner */}
      {isActive && (
        <div className="flex items-center gap-3 px-4 py-3 border border-green-500/30 bg-green-500/8 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <p className="text-sm text-green-400 font-medium">Sesión en curso — el coach está registrando tus series</p>
        </div>
      )}

      {isCompleted && data.exercises.length > 0 && (() => {
        const totalSets = data.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
        const validSets = data.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.status === "valid").length, 0)
        return totalSets > 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 border border-emerald-500/30 bg-emerald-500/8 rounded-xl">
            <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-400 font-medium">{validSets} series completadas</p>
          </div>
        ) : null
      })()}

      {/* Exercises */}
      <div className="space-y-3">
        {data.exercises.map((ex) => (
          <div key={ex.id} className="border border-border rounded-xl overflow-hidden bg-card/60">
            <div className="px-4 py-3 bg-muted/10 border-b border-border">
              <p className="font-semibold text-sm">{ex.exerciseName}</p>
            </div>

            {ex.sets.length === 0 ? (
              <div className="px-4 py-3">
                {isActive ? (
                  <p className="text-xs text-muted-foreground italic">Esperando que el coach registre tus series…</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sin series registradas</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {ex.sets.map((s) => {
                  const target = ex.targets.find((t) => t.setNumber === s.setNumber)
                  const isValid = s.status === "valid"
                  return (
                    <div key={s.id} className={cn("flex items-center gap-4 px-4 py-2.5 text-xs", !isValid && "opacity-50")}>
                      <span className="w-14 font-medium text-foreground shrink-0">Serie {s.setNumber}</span>
                      <span className="text-foreground font-semibold">{s.reps} reps</span>
                      {Number(s.weightLbs) > 0 && (
                        <span className="text-muted-foreground">{s.weightLbs} lbs</span>
                      )}
                      {target?.targetPercent && (
                        <span className="text-primary/70 ml-auto shrink-0">{target.targetPercent}% RM</span>
                      )}
                      {!isValid && (
                        <span className="ml-auto text-[10px] text-rose-400/70 font-medium shrink-0">Inválida</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Targets preview when active and no sets yet */}
            {isActive && ex.sets.length === 0 && ex.targets.length > 0 && (
              <div className="border-t border-border/50 divide-y divide-border/50">
                {ex.targets.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground/60">
                    <span className="w-14 shrink-0">Serie {t.setNumber}</span>
                    {t.targetReps != null && <span>{t.targetReps} reps</span>}
                    {t.targetPercent && <span className="ml-auto shrink-0">{t.targetPercent}% RM</span>}
                    <ClockIcon className="w-3 h-3 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {data.exercises.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-sm text-muted-foreground">Sin ejercicios en esta sesión.</p>
          </div>
        )}
      </div>
    </div>
  )
}
