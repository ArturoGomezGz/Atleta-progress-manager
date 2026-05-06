"use client"

import { trpc } from "@/lib/trpc/client"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Tab = "routines" | "members"

export default function TeamPage({ params }: { params: { teamId: string } }) {
  const { teamId } = params
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("routines")
  const [creatingRoutine, setCreatingRoutine] = useState(false)
  const [routineName, setRoutineName] = useState("")
  const [newMemberUserId, setNewMemberUserId] = useState("")
  const [newMemberRole, setNewMemberRole] = useState<"coach" | "athlete">("athlete")
  const [addingMember, setAddingMember] = useState(false)

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: routines, refetch: refetchRoutines } = trpc.routines.list.useQuery({ teamId })
  const { data: members, refetch: refetchMembers } = trpc.teams.members.useQuery({ teamId })

  const createRoutine = trpc.routines.create.useMutation({ onSuccess: refetchRoutines })
  const addMember = trpc.teams.addMember.useMutation({ onSuccess: () => { refetchMembers(); setAddingMember(false); setNewMemberUserId("") } })

  const team = teams?.find((t) => t.team.id === teamId)
  const isCoach = team?.role === "coach"

  async function handleCreateRoutine(e: React.FormEvent) {
    e.preventDefault()
    if (!routineName.trim()) return
    const r = await createRoutine.mutateAsync({ teamId, name: routineName.trim() })
    setRoutineName("")
    setCreatingRoutine(false)
    router.push(`/routines/${r.id}`)
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberUserId.trim()) return
    addMember.mutate({ teamId, userId: newMemberUserId.trim(), role: newMemberRole })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:underline">Equipos</Link>
            {" / "}
          </p>
          <h1 className="text-xl font-semibold">{team?.team.name ?? "Equipo"}</h1>
        </div>
        {isCoach && (
          <Link
            href={`/sessions/new?teamId=${teamId}`}
            className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
          >
            <PlusIcon className="w-4 h-4" />
            Iniciar sesión
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-4">
        {(["routines", "members"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "routines" ? "Rutinas" : "Miembros"}
          </button>
        ))}
      </div>

      {/* Routines tab */}
      {tab === "routines" && (
        <div className="space-y-3">
          {isCoach && (
            <div className="flex justify-end">
              <button
                onClick={() => setCreatingRoutine(true)}
                className="flex items-center gap-1 text-sm border px-3 py-1.5 rounded-md hover:bg-muted"
              >
                <PlusIcon className="w-4 h-4" />
                Nueva rutina
              </button>
            </div>
          )}
          {creatingRoutine && (
            <form onSubmit={handleCreateRoutine} className="flex gap-2">
              <input
                autoFocus
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Nombre de la rutina"
                className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md">
                Crear
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
                href={`/routines/${r.id}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-sm">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("es")}
                </span>
              </Link>
            ))}
            {routines?.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">
                Este equipo no tiene rutinas todavía.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === "members" && (
        <div className="space-y-3">
          {isCoach && (
            <div className="flex justify-end">
              <button
                onClick={() => setAddingMember(true)}
                className="flex items-center gap-1 text-sm border px-3 py-1.5 rounded-md hover:bg-muted"
              >
                <PlusIcon className="w-4 h-4" />
                Agregar miembro
              </button>
            </div>
          )}
          {addingMember && (
            <form onSubmit={handleAddMember} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">ID de usuario</label>
                <input
                  autoFocus
                  value={newMemberUserId}
                  onChange={(e) => setNewMemberUserId(e.target.value)}
                  placeholder="user-id"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Rol</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as "coach" | "athlete")}
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="athlete">Atleta</option>
                  <option value="coach">Entrenador</option>
                </select>
              </div>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md">
                Agregar
              </button>
              <button type="button" onClick={() => setAddingMember(false)} className="px-4 py-2 text-sm rounded-md border">
                Cancelar
              </button>
            </form>
          )}
          <div className="space-y-2">
            {members?.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg">
                <span className="text-sm font-mono">{m.userId}</span>
                <span className="text-xs border rounded-full px-2 py-0.5 capitalize">{m.role === "coach" ? "Entrenador" : "Atleta"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
