"use client"

import { trpc } from "@/lib/trpc/client"
import { use, useState } from "react"
import { useRouter } from "next/navigation"

export default function NewSessionPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())

  const { data: routines } = trpc.routines.list.useQuery({ teamId })
  const { data: members } = trpc.teams.members.useQuery({ teamId })
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => router.push(`/teams/${teamId}/sesiones/${session.id}`),
  })

  const athletes = members?.filter((m) => m.role === "athlete") ?? []

  function toggleAthlete(id: string) {
    setSelectedAthleteIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    if (selectedAthleteIds.size === athletes.length) {
      setSelectedAthleteIds(new Set())
    } else {
      setSelectedAthleteIds(new Set(athletes.map((a) => a.userId)))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoutineId || selectedAthleteIds.size === 0) return
    createSession.mutate({
      routineId: selectedRoutineId,
      teamId,
      athleteIds: Array.from(selectedAthleteIds),
    })
  }

  const canSubmit = !!selectedRoutineId && selectedAthleteIds.size > 0 && !createSession.isPending

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-8">
      <h1 className="text-xl font-semibold">Comenzar rutina</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Plantilla</h2>
          {routines?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Este equipo no tiene plantillas. Crea una primero.
            </p>
          )}
          <div className="space-y-2">
            {routines?.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedRoutineId === r.id ? "border-primary bg-muted/50" : ""}`}
              >
                <input
                  type="radio"
                  name="routine"
                  value={r.id}
                  checked={selectedRoutineId === r.id}
                  onChange={() => setSelectedRoutineId(r.id)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{r.name}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Atletas</h2>
            {athletes.length > 0 && (
              <button type="button" onClick={handleSelectAll} className="text-xs text-muted-foreground hover:text-foreground">
                {selectedAthleteIds.size === athletes.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            )}
          </div>
          {athletes.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay atletas en este equipo.</p>
          )}
          <div className="space-y-2">
            {athletes.map((a) => (
              <label
                key={a.userId}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedAthleteIds.has(a.userId) ? "border-primary bg-muted/50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedAthleteIds.has(a.userId)}
                  onChange={() => toggleAthlete(a.userId)}
                  className="accent-primary"
                />
                <span className="text-sm">{a.userName}</span>
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-primary text-primary-foreground py-2.5 rounded-md text-sm font-medium disabled:opacity-40"
        >
          {createSession.isPending ? "Iniciando..." : "Comenzar rutina"}
        </button>
      </form>
    </div>
  )
}
