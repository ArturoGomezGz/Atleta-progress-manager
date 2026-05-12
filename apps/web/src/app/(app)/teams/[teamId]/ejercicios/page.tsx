"use client"

import { trpc } from "@/lib/trpc/client"
import { GlobeIcon, LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useParams } from "next/navigation"
import { useState } from "react"

type Exercise = {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  ownerUserId: string | null
  ownerTeamId: string | null
  editable: boolean
  createdAt: string
}

type FormState = {
  id?: string
  name: string
  description: string
  isPublic: boolean
  ownerType: "user" | "team"
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  isPublic: true,
  ownerType: "user",
}

export default function EjerciciosPage() {
  const { teamId } = useParams<{ teamId: string }>()

  const { data: exercises, refetch } = trpc.exercises.listAllOwned.useQuery()
  const { data: teams } = trpc.teams.list.useQuery()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const currentTeam = teams?.find((t) => t.team.id === teamId)
  const isCoach = currentTeam?.role === "coach"

  const createMutation = trpc.exercises.create.useMutation({
    onSuccess: () => { refetch(); setForm(null) },
  })
  const updateMutation = trpc.exercises.update.useMutation({
    onSuccess: () => { refetch(); setForm(null) },
  })
  const deleteMutation = trpc.exercises.delete.useMutation({
    onSuccess: () => { refetch(); setDeleteConfirm(null) },
  })

  const personal = exercises?.filter((ex) => ex.ownerUserId !== null) ?? []
  const teamExercises = exercises?.filter((ex) => ex.ownerTeamId === teamId) ?? []

  function openEdit(ex: Exercise) {
    setForm({
      id: ex.id,
      name: ex.name,
      description: ex.description ?? "",
      isPublic: ex.isPublic,
      ownerType: ex.ownerTeamId ? "team" : "user",
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (form.id) {
      updateMutation.mutate({
        id: form.id,
        name: form.name,
        description: form.description || undefined,
        isPublic: form.isPublic,
      })
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        isPublic: form.isPublic,
        ownerType: form.ownerType,
        teamId: form.ownerType === "team" ? teamId : undefined,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ejercicios</h1>
        {!form && (
          <button
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo ejercicio
          </button>
        )}
      </div>

      {/* ── Form ── */}
      {form && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-muted/10">
          <p className="text-sm font-medium">{form.id ? "Editar ejercicio" : "Nuevo ejercicio"}</p>

          <div className="space-y-2">
            <input
              autoFocus
              required
              value={form.name}
              onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
              placeholder="Nombre"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })}
              placeholder="Descripción (opcional)"
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Owner type toggle — coaches only, not when editing */}
          {!form.id && isCoach && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => f && { ...f, ownerType: "user" })}
                className={`flex-1 text-xs py-1.5 rounded border transition-colors cursor-pointer ${
                  form.ownerType === "user"
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => f && { ...f, ownerType: "team" })}
                className={`flex-1 text-xs py-1.5 rounded border transition-colors cursor-pointer ${
                  form.ownerType === "team"
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Del equipo
              </button>
            </div>
          )}

          {/* Team name display when "Del equipo" is selected */}
          {!form.id && isCoach && form.ownerType === "team" && currentTeam && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border">
              <span className="text-xs text-muted-foreground">Equipo:</span>
              <span className="text-xs font-medium">{currentTeam.team.name}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Visibilidad</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => f && { ...f, isPublic: true })}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border transition-colors cursor-pointer ${
                  form.isPublic
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <GlobeIcon className="w-3.5 h-3.5" />
                Público
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => f && { ...f, isPublic: false })}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border transition-colors cursor-pointer ${
                  !form.isPublic
                    ? "bg-muted/60 border-border text-foreground font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <LockIcon className="w-3.5 h-3.5" />
                Privado
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-xs px-3 py-1.5 border rounded cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Guardando..." : form.id ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      )}

      {/* ── Personal ── */}
      <Section
        title="Personales"
        exercises={personal}
        onEdit={openEdit}
        onDelete={setDeleteConfirm}
        deleteConfirm={deleteConfirm}
        onDeleteConfirm={(id) => deleteMutation.mutate({ id })}
        onDeleteCancel={() => setDeleteConfirm(null)}
        isDeleting={deleteMutation.isPending}
      />

      {/* ── Current team ── */}
      {currentTeam && (
        <Section
          title={currentTeam.team.name}
          exercises={teamExercises}
          onEdit={openEdit}
          onDelete={setDeleteConfirm}
          deleteConfirm={deleteConfirm}
          onDeleteConfirm={(id) => deleteMutation.mutate({ id })}
          onDeleteCancel={() => setDeleteConfirm(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

function Section({
  title,
  exercises,
  onEdit,
  onDelete,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  isDeleting,
}: {
  title: string
  exercises: Exercise[]
  onEdit: (ex: Exercise) => void
  onDelete: (id: string) => void
  deleteConfirm: string | null
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
  isDeleting: boolean
}) {
  if (exercises.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-1.5">
        {exercises.map((ex) =>
          deleteConfirm === ex.id ? (
            <div key={ex.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-destructive/5 border-destructive/30">
              <p className="text-sm text-destructive">¿Eliminar <span className="font-medium">{ex.name}</span>?</p>
              <div className="flex gap-2">
                <button onClick={onDeleteCancel} className="text-xs px-2.5 py-1 border rounded cursor-pointer">
                  Cancelar
                </button>
                <button
                  onClick={() => onDeleteConfirm(ex.id)}
                  disabled={isDeleting}
                  className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground rounded disabled:opacity-50 cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <div key={ex.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ex.name}</p>
                {ex.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{ex.description}</p>
                )}
              </div>
              {ex.isPublic ? (
                <GlobeIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <LockIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              {ex.editable && (
                <>
                  <button onClick={() => onEdit(ex)} className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(ex.id)} className="p-1 text-muted-foreground hover:text-destructive rounded cursor-pointer">
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  )
}
