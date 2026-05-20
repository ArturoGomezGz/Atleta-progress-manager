"use client"

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { getRoutineTypeConfig } from "@/lib/routine-types"
import { PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { use, useState } from "react"
import { useRouter } from "next/navigation"

type Category = "evaluation" | "training"
type Filter = "all" | Category

const sc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export default function PlantillasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const [filter, setFilter]           = useState<Filter>("all")
  const [search, setSearch]           = useState("")
  const [creating, setCreating]       = useState(false)
  const [newName, setNewName]         = useState("")
  const [newCategory, setNewCategory] = useState<Category>("training")
  const [deleting, setDeleting]       = useState<{ id: string; name: string } | null>(null)

  const { data: routines, refetch } = trpc.routines.list.useQuery({ teamId })
  const createRoutine = trpc.routines.create.useMutation({
    onSuccess: (r) => { setCreating(false); setNewName(""); router.push(`/teams/${teamId}/plantillas/${r.id}`) },
  })
  const deleteRoutine = trpc.routines.delete.useMutation({ onSuccess: () => { refetch(); setDeleting(null) } })

  const filtered = (routines ?? []).filter((r) => {
    if (filter !== "all" && r.category !== filter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createRoutine.mutate({ teamId, name: newName.trim().toLowerCase(), category: newCategory })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1
          className="text-2xl font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-barlow-condensed)" }}
        >
          Plantillas
        </h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3.5 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="border border-border rounded-xl p-4 space-y-3 bg-card/60">
          <p className="text-sm font-semibold">Nueva plantilla</p>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la plantilla"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            {(["training", "evaluation"] as Category[]).map((cat) => {
              const cfg = getRoutineTypeConfig(cat)
              const Icon = cfg.icon
              const isSelected = newCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewCategory(cat)}
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
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName("") }}
              className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createRoutine.isPending || !newName.trim()}
              className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 cursor-pointer hover:bg-primary/90 transition-colors"
            >
              {createRoutine.isPending ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      )}

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
              <Link href={`/teams/${teamId}/plantillas/${r.id}`} className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0">
                <Icon className={cn("w-4 h-4 shrink-0", cfg.text)} />
                <span className="font-medium text-sm flex-1 truncate">{sc(r.name)}</span>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", cfg.bg, cfg.text, cfg.border)}>
                  {cfg.label}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                  {new Date(r.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                </span>
              </Link>
              <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {filtered.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              {search || filter !== "all" ? "Sin resultados. Prueba con otro filtro." : "Sin plantillas. Crea la primera."}
            </p>
            {!search && filter === "all" && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                Nueva plantilla
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
