"use client"

import { trpc } from "@/lib/trpc/client"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function DashboardPage() {
  const [newTeamName, setNewTeamName] = useState("")
  const [creating, setCreating] = useState(false)

  const { data: teams, refetch } = trpc.teams.list.useQuery()
  const createTeam = trpc.teams.create.useMutation({ onSuccess: () => refetch() })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    await createTeam.mutateAsync({ name: newTeamName.trim() })
    setNewTeamName("")
    setCreating(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis equipos</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo equipo
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            autoFocus
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nombre del equipo"
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md">
            Crear
          </button>
          <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm rounded-md border">
            Cancelar
          </button>
        </form>
      )}

      <div className="space-y-2">
        {teams?.map(({ team, role }) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">{team.name}</span>
            <span className="text-xs text-muted-foreground capitalize">{role}</span>
          </Link>
        ))}
        {teams?.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Aún no perteneces a ningún equipo.
          </p>
        )}
      </div>
    </div>
  )
}
