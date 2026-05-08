"use client"

import { trpc } from "@/lib/trpc/client"
import { GlobeIcon, LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

type Exercise = {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  ownerUserId: string | null
  ownerTeamId: string | null
  createdAt: string
}

type FormState = {
  id?: string
  name: string
  description: string
  isPublic: boolean
  ownerType: "user" | "team"
  teamId: string
}

const EMPTY_FORM = (teamId = ""): FormState => ({
  name: "",
  description: "",
  isPublic: false,
  ownerType: "user",
  teamId,
})

export default function ExercisesPage() {
  const { data: exercises, refetch } = trpc.exercises.listOwned.useQuery()
  const { data: teams } = trpc.teams.list.useQuery()
  const [form, setForm] = useState<FormState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const coachTeams = teams?.filter((t) => t.role === "coach") ?? []

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
  const teamGroups = coachTeams.map((t) => ({
    team: t.team,
    exercises: exercises?.filter((ex) => ex.ownerTeamId === t.team.id) ?? [],
  }))

  function openCreate(ownerType: "user" | "team", teamId = "") {
    setForm({ ...EMPTY_FORM(teamId), ownerType })
  }

  function openEdit(ex: Exercise) {
    setForm({
      id: ex.id,
      name: ex.name,
      description: ex.description ?? "",
      isPublic: ex.isPublic,
      ownerType: ex.ownerTeamId ? "team" : "user",
      teamId: ex.ownerTeamId ?? "",
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
        teamId: form.ownerType === "team" ? form.teamId : undefined,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis ejercicios</h1>
        {!form && (
          <button
            onClick={() => openCreate("user")}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
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

          {/* Owner selector — only for create */}
          {!form.id && coachTeams.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => f && { ...f, ownerType: "user" })}
                className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                  form.ownerType === "user"
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => f && { ...f, ownerType: "team", teamId: coachTeams[0]?.team.id ?? "" })
                }
                className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                  form.ownerType === "team"
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Del equipo
              </button>
            </div>
          )}

          {!form.id && form.ownerType === "team" && coachTeams.length > 1 && (
            <select
              value={form.teamId}
              onChange={(e) => setForm((f) => f && { ...f, teamId: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {coachTeams.map(({ team }) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => f && { ...f, isPublic: e.target.checked })}
              className="rounded"
            />
            <GlobeIcon className="w-3.5 h-3.5 text-muted-foreground" />
            Público (visible en otros equipos)
          </label>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-xs px-3 py-1.5 border rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded disabled:opacity-50"
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

      {/* ── Per-team ── */}
      {teamGroups.map(({ team, exercises: teamExercises }) => (
        <Section
          key={team.id}
          title={team.name}
          exercises={teamExercises}
          onEdit={openEdit}
          onDelete={setDeleteConfirm}
          deleteConfirm={deleteConfirm}
          onDeleteConfirm={(id) => deleteMutation.mutate({ id })}
          onDeleteCancel={() => setDeleteConfirm(null)}
          isDeleting={deleteMutation.isPending}
        />
      ))}
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

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
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>

      {exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed">
          Sin ejercicios aún.
        </p>
      ) : (
        <div className="space-y-1.5">
          {exercises.map((ex) =>
            deleteConfirm === ex.id ? (
              <div key={ex.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-destructive/5 border-destructive/30">
                <p className="text-sm text-destructive">¿Eliminar <span className="font-medium">{ex.name}</span>?</p>
                <div className="flex gap-2">
                  <button
                    onClick={onDeleteCancel}
                    className="text-xs px-2.5 py-1 border rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => onDeleteConfirm(ex.id)}
                    disabled={isDeleting}
                    className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground rounded disabled:opacity-50"
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
                <button
                  onClick={() => onEdit(ex)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(ex.id)}
                  className="p-1 text-muted-foreground hover:text-destructive rounded"
                >
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
