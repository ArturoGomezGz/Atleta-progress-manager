"use client"

import { trpc } from "@/lib/trpc/client"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { use, useState } from "react"
import { useRouter } from "next/navigation"

export default function PlantillasPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const [creatingRoutine, setCreatingRoutine] = useState(false)
  const [routineName, setRoutineName] = useState("")

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: routines, refetch } = trpc.routines.list.useQuery({ teamId })
  const createRoutine = trpc.routines.create.useMutation({
    onSuccess: (r) => {
      setRoutineName("")
      setCreatingRoutine(false)
      router.push(`/teams/${teamId}/plantillas/${r.id}`)
    },
  })

  const isCoach = teams?.find((t) => t.team.id === teamId)?.role === "coach"

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!routineName.trim()) return
    createRoutine.mutate({ teamId, name: routineName.trim() })
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
        {routines?.map((r) => (
          <Link
            key={r.id}
            href={`/teams/${teamId}/plantillas/${r.id}`}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium text-sm">{r.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString("es")}
            </span>
          </Link>
        ))}
        {routines?.length === 0 && !creatingRoutine && (
          <p className="text-muted-foreground text-sm text-center py-12 border rounded-lg">
            Sin plantillas todavía.{isCoach ? " Crea la primera." : ""}
          </p>
        )}
      </div>
    </div>
  )
}
