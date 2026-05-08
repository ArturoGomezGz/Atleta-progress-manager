"use client"

import { trpc } from "@/lib/trpc/client"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { use, useState } from "react"
import { useRouter } from "next/navigation"

type RoutineAction =
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string; name: string }

export default function PlantillasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const [creatingRoutine, setCreatingRoutine] = useState(false)
  const [routineName, setRoutineName] = useState("")
  const [action, setAction] = useState<RoutineAction | null>(null)

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: routines, refetch } = trpc.routines.list.useQuery({ teamId })

  const createRoutine = trpc.routines.create.useMutation({
    onSuccess: (r) => {
      setRoutineName("")
      setCreatingRoutine(false)
      router.push(`/teams/${teamId}/plantillas/${r.id}`)
    },
  })
  const renameRoutine = trpc.routines.rename.useMutation({
    onSuccess: () => { refetch(); setAction(null) },
  })
  const deleteRoutine = trpc.routines.delete.useMutation({
    onSuccess: () => { refetch(); setAction(null) },
  })

  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!routineName.trim()) return
    createRoutine.mutate({ teamId, name: routineName.trim() })
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (action?.type !== "rename" || !action.name.trim()) return
    renameRoutine.mutate({ id: action.id, name: action.name.trim() })
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plantillas</h1>
        {isCoach && !creatingRoutine && (
          <button
            onClick={() => setCreatingRoutine(true)}
            className="flex items-center gap-1 text-sm border px-3 py-1.5 rounded-md hover:bg-muted"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva plantilla
          </button>
        )}
      </div>

      {creatingRoutine && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            autoFocus
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            placeholder="Nombre de la plantilla"
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" disabled={createRoutine.isPending} className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md disabled:opacity-50">
            {createRoutine.isPending ? "Creando..." : "Crear"}
          </button>
          <button type="button" onClick={() => setCreatingRoutine(false)} className="px-4 py-2 text-sm rounded-md border">
            Cancelar
          </button>
        </form>
      )}

      <div className="space-y-2">
        {routines?.map((r) => {
          const isRenaming = action?.type === "rename" && action.id === r.id
          const isDeleting = action?.type === "delete" && action.id === r.id

          if (isDeleting) {
            return (
              <div key={r.id} className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <p className="text-sm text-destructive">
                  ¿Eliminar <span className="font-medium">{r.name}</span>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAction(null)}
                    className="text-xs px-3 py-1.5 border rounded-md"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deleteRoutine.mutate({ id: r.id })}
                    disabled={deleteRoutine.isPending}
                    className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          }

          if (isRenaming) {
            return (
              <form key={r.id} onSubmit={handleRename} className="flex gap-2 p-2 border rounded-lg bg-muted/10">
                <input
                  autoFocus
                  value={action.name}
                  onChange={(e) => setAction({ ...action, name: e.target.value })}
                  className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={renameRoutine.isPending || !action.name.trim()}
                  className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  {renameRoutine.isPending ? "..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  className="text-xs px-3 py-1.5 border rounded-md"
                >
                  Cancelar
                </button>
              </form>
            )
          }

          return (
            <div key={r.id} className="group flex items-center border rounded-lg hover:bg-muted/30 transition-colors">
              <Link
                href={`/teams/${teamId}/plantillas/${r.id}`}
                className="flex-1 flex items-center justify-between px-4 py-3.5"
              >
                <span className="font-medium text-sm">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("es")}
                </span>
              </Link>

              {isCoach && (
                <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setAction({ type: "rename", id: r.id, name: r.name })}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAction({ type: "delete", id: r.id, name: r.name })}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded cursor-pointer"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {routines?.length === 0 && !creatingRoutine && (
          <p className="text-muted-foreground text-sm text-center py-12 border rounded-lg">
            Sin plantillas todavía.{isCoach ? " Crea la primera." : ""}
          </p>
        )}
      </div>
    </div>
  )
}
