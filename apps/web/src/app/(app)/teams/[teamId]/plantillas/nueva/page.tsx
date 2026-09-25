"use client"

import { PageTransition } from "@/components/page-transition"
import { markBackNavigation } from "@/lib/page-transition"
import { getRoutineTypeConfig, type RoutineCategory } from "@/lib/routine-types"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { ChevronLeftIcon } from "lucide-react"
import { use, useRef, useState } from "react"
import { useRouter } from "next/navigation"

export default function NuevaPlantillaPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const [name, setName]         = useState("")
  const [category, setCategory] = useState<RoutineCategory>("training")
  const nameInputRef = useRef<HTMLInputElement>(null)

  const createRoutine = trpc.routines.create.useMutation({
    onSuccess: (r) => router.push(`/teams/${teamId}/plantillas/${r.id}`),
  })

  function goBack() {
    markBackNavigation()
    router.push(`/teams/${teamId}/plantillas`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createRoutine.mutate({ teamId, name: name.trim().toLowerCase(), category })
  }

  return (
    // Enfocar al terminar el deslizamiento, no al montar: con `autoFocus` el input
    // se enfoca aún fuera de pantalla y el navegador desplaza <main> (y abre el
    // teclado en móvil) en plena animación.
    <PageTransition direction="forward" onEntered={() => nameInputRef.current?.focus({ preventScroll: true })}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="shrink-0 flex items-center gap-1 -ml-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h1
            className="text-2xl font-bold tracking-wider uppercase"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            Nueva plantilla
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 space-y-4 bg-card/60">
          <div className="space-y-1.5">
            <label htmlFor="new-template-name" className="text-sm font-semibold">Nombre</label>
            <input
              id="new-template-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Tipo</p>
            <div className="flex gap-2">
              {(["training", "evaluation"] as RoutineCategory[]).map((cat) => {
                const cfg = getRoutineTypeConfig(cat)
                const Icon = cfg.icon
                const isSelected = category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "flex items-center gap-1.5 flex-1 justify-center py-2 text-xs rounded-lg border transition-colors cursor-pointer font-medium",
                      isSelected ? cn(cfg.bg, cfg.text, cfg.border) : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={goBack}
              className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createRoutine.isPending || !name.trim()}
              className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 cursor-pointer hover:bg-primary/90 transition-colors"
            >
              {createRoutine.isPending ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </PageTransition>
  )
}
