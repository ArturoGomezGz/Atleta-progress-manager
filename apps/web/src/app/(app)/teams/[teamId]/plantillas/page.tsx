"use client"

import { PageTransition, useRevealAfterEnter, type SlideDirection } from "@/components/page-transition"
import { ZoneLegend, ZoneStripe } from "@/components/zone-profile"
import { consumeBackNavigation } from "@/lib/page-transition"
import { getRoutineTypeConfig } from "@/lib/routine-types"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { CopyIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { use, useLayoutEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Category = "evaluation" | "training"
type Filter = "all" | Category

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export default function PlantillasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const [filter, setFilter]       = useState<Filter>("all")
  const [search, setSearch]       = useState("")
  const [deleting, setDeleting]   = useState<{ id: string; name: string } | null>(null)
  // Si se vuelve desde "Nueva plantilla" o desde el editor, entra deslizándose desde la
  // izquierda; en una carga directa no hay animación.
  const [direction, setDirection] = useState<SlideDirection | null>(null)
  useLayoutEffect(() => { if (consumeBackNavigation()) setDirection("back") }, [])

  const { data: routines, refetch } = trpc.routines.list.useQuery({ teamId })
  // Mientras carga no hay lista que filtrar: sin esto se mostraba "Sin plantillas"
  // (a veces en pleno deslizamiento de vuelta) y luego saltaba a la lista real.
  const { onEntered, showContent, showSkeleton } = useRevealAfterEnter(routines !== undefined)
  const deleteRoutine = trpc.routines.delete.useMutation({ onSuccess: () => { refetch(); setDeleting(null) } })
  const duplicateRoutine = trpc.routines.duplicate.useMutation({ onSuccess: () => refetch() })

  const filtered = (routines ?? []).filter((r) => {
    if (filter !== "all" && r.category !== filter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function goToCreate() {
    router.push(`/teams/${teamId}/plantillas/nueva`)
  }

  return (
    <PageTransition direction={direction} onEntered={onEntered}>
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Plantillas
        </h1>
        <button
          onClick={goToCreate}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3.5 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar plantilla..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "training", "evaluation"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer font-medium whitespace-nowrap",
                filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "Todas" : f === "training" ? "Entrenamiento" : "Evaluación"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {showSkeleton && (
        // Misma fila que una plantilla real: franja de zonas, ícono del tipo y nombre.
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center border border-border rounded-xl bg-card/60">
              <div className="w-1 self-stretch ml-2 my-2.5 rounded-full bg-border" />
              <div className="flex-1 flex items-center gap-3 pl-3 pr-4 py-3.5 min-w-0">
                <span className="w-4 h-4 rounded bg-muted/60 animate-pulse shrink-0" />
                <span className="h-4 w-2/5 rounded bg-muted/50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showContent && (
      <div className="space-y-2">
        {filtered.map((r) => {
          const cfg  = getRoutineTypeConfig(r.category)
          const Icon = cfg.icon

          if (deleting?.id === r.id) return (
            <div key={r.id} className="flex items-center justify-between p-4 border border-destructive/30 rounded-xl bg-destructive/5">
              <p className="text-sm text-destructive">¿Eliminar <span className="font-medium">{sc(r.name)}</span>?</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleting(null)} className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">Cancelar</button>
                <button onClick={() => deleteRoutine.mutate({ id: r.id })} disabled={deleteRoutine.isPending} className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 cursor-pointer">Eliminar</button>
              </div>
            </div>
          )

          return (
            <div key={r.id} className="group flex items-center border border-border rounded-xl hover:border-primary/20 bg-card/60 transition-colors">
              <ZoneStripe profile={r.zoneProfile} className="ml-2 my-2.5" />
              <Link href={`/teams/${teamId}/plantillas/${r.id}`} className="flex-1 flex items-center gap-3 pl-3 pr-4 py-3.5 min-w-0">
                <Icon className={cn("w-4 h-4 shrink-0", cfg.text)} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-sm truncate">{sc(r.name)}</span>
                  <ZoneLegend profile={r.zoneProfile} className="mt-0.5" />
                </span>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                  {new Date(r.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                </span>
              </Link>
              <div className="flex items-center gap-1 pr-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => duplicateRoutine.mutate({ id: r.id })}
                  disabled={duplicateRoutine.isPending}
                  title="Duplicar plantilla"
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleting({ id: r.id, name: r.name })}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
                >
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              {search || filter !== "all" ? "Sin resultados. Prueba con otro filtro." : "Sin plantillas. Crea la primera."}
            </p>
            {!search && filter === "all" && (
              <button
                onClick={goToCreate}
                className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                Nueva plantilla
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </div>
    </PageTransition>
  )
}
