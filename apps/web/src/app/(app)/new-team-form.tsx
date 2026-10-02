"use client"

import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Formulario de "nuevo equipo": nombre → crear → navegar al equipo nuevo
export function NewTeamForm({ onCancel, className }: { onCancel?: () => void; className?: string }) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [name, setName] = useState("")
  const createTeam = trpc.teams.create.useMutation({
    onSuccess: async (team) => {
      await utils.teams.list.invalidate()
      router.push(`/teams/${team.id}/equipo`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || createTeam.isPending) return
    createTeam.mutate({ name: name.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className={className ?? "space-y-2"}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del equipo"
        className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex gap-1.5">
        <button type="submit" disabled={createTeam.isPending} className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded-md disabled:opacity-50 font-medium cursor-pointer">
          {createTeam.isPending ? "Creando..." : "Crear"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 border border-border text-xs py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
