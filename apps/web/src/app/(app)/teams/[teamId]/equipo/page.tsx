"use client"

import { trpc } from "@/lib/trpc/client"
import { DumbbellIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react"
import { use, useState } from "react"
import { useRouter } from "next/navigation"

export default function EquipoPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [newMemberRole, setNewMemberRole] = useState<"coach" | "athlete">("athlete")
  const [addMemberError, setAddMemberError] = useState("")
  const [addingMember, setAddingMember] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<null | "confirm" | "warn">(null)

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: members, refetch: refetchMembers } = trpc.teams.members.useQuery({ teamId })

  const addMember = trpc.teams.addMemberByEmail.useMutation({
    onSuccess: () => { refetchMembers(); setAddingMember(false); setNewMemberEmail(""); setAddMemberError("") },
    onError: (err) => setAddMemberError(err.message),
  })
  const updateRole = trpc.teams.updateMemberRole.useMutation({ onSuccess: refetchMembers })
  const removeMember = trpc.teams.removeMember.useMutation({ onSuccess: refetchMembers })
  const deleteTeam = trpc.teams.deleteTeam.useMutation({
    onSuccess: () => router.push("/dashboard"),
  })

  const currentTeam = teams?.find((t) => t.team.id === teamId)
  const isCoach = currentTeam?.role === "coach"
  const otherMembersCount = (members?.length ?? 1) - 1

  function handleDeleteClick() {
    setDeleteDialog(otherMembersCount > 0 ? "warn" : "confirm")
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberEmail.trim()) return
    setAddMemberError("")
    addMember.mutate({ teamId, email: newMemberEmail.trim(), role: newMemberRole })
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold">Equipo</h1>

      <MembersSection
        teamId={teamId}
        isCoach={!!isCoach}
        members={members ?? []}
        addingMember={addingMember}
        setAddingMember={setAddingMember}
        newMemberEmail={newMemberEmail}
        setNewMemberEmail={setNewMemberEmail}
        newMemberRole={newMemberRole}
        setNewMemberRole={setNewMemberRole}
        addMemberError={addMemberError}
        setAddMemberError={setAddMemberError}
        onAddMember={handleAddMember}
        addMemberPending={addMember.isPending}
        onUpdateRole={(userId, role) => updateRole.mutateAsync({ teamId, userId, role })}
        onRemove={(userId) => removeMember.mutateAsync({ teamId, userId })}
      />

      {isCoach && (
        <div className="pt-4 border-t border-border">
          <button
            onClick={handleDeleteClick}
            className="flex items-center gap-2 text-sm text-destructive border border-destructive/40 px-3 py-1.5 rounded-md hover:bg-destructive/10 transition-colors"
          >
            <Trash2Icon className="w-4 h-4" />
            Eliminar equipo
          </button>
        </div>
      )}

      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-base">Eliminar equipo</h2>
            {deleteDialog === "warn" ? (
              <p className="text-sm text-muted-foreground">
                Este equipo tiene{" "}
                <span className="font-medium text-foreground">
                  {otherMembersCount} {otherMembersCount === 1 ? "miembro" : "miembros"} adicional{otherMembersCount !== 1 ? "es" : ""}
                </span>
                . Al eliminarlo se perderán todos los datos del equipo y sus miembros perderán el acceso.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                ¿Seguro que quieres eliminar este equipo? Esta acción no se puede deshacer.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteDialog(null)}
                disabled={deleteTeam.isPending}
                className="text-sm border border-border px-3 py-1.5 rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTeam.mutate({ teamId })}
                disabled={deleteTeam.isPending}
                className="text-sm bg-destructive text-white px-3 py-1.5 rounded-md hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteTeam.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Members section ──────────────────────────────────────────────────────────

type Member = { id: string; userId: string; role: string; userName: string; userEmail: string }

function MembersSection({
  teamId, isCoach, members,
  addingMember, setAddingMember,
  newMemberEmail, setNewMemberEmail,
  newMemberRole, setNewMemberRole,
  addMemberError, setAddMemberError,
  onAddMember, addMemberPending,
  onUpdateRole, onRemove,
}: {
  teamId: string
  isCoach: boolean
  members: Member[]
  addingMember: boolean
  setAddingMember: (v: boolean) => void
  newMemberEmail: string
  setNewMemberEmail: (v: string) => void
  newMemberRole: "coach" | "athlete"
  setNewMemberRole: (v: "coach" | "athlete") => void
  addMemberError: string
  setAddMemberError: (v: string) => void
  onAddMember: (e: React.FormEvent) => void
  addMemberPending: boolean
  onUpdateRole: (userId: string, role: "coach" | "athlete") => Promise<unknown>
  onRemove: (userId: string) => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [pendingRoles, setPendingRoles] = useState<Record<string, "coach" | "athlete">>({})
  const [saving, setSaving] = useState(false)

  function startEditing() {
    const initial: Record<string, "coach" | "athlete"> = {}
    members.forEach((m) => { initial[m.userId] = m.role as "coach" | "athlete" })
    setPendingRoles(initial)
    setEditing(true)
  }

  function cancelEditing() {
    setPendingRoles({})
    setEditing(false)
  }

  async function saveChanges() {
    setSaving(true)
    const changed = members.filter((m) => pendingRoles[m.userId] && pendingRoles[m.userId] !== m.role)
    await Promise.all(changed.map((m) => onUpdateRole(m.userId, pendingRoles[m.userId])))
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="space-y-3">
      {isCoach && (
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <button onClick={cancelEditing} className="text-sm border px-3 py-1.5 rounded-md hover:bg-muted">
                Cancelar
              </button>
              <button onClick={saveChanges} disabled={saving} className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setAddingMember(true)}
                className="flex items-center gap-1 text-sm border px-3 py-1.5 rounded-md hover:bg-muted"
              >
                <PlusIcon className="w-4 h-4" />
                Agregar miembro
              </button>
              <button onClick={startEditing} className="text-sm border px-3 py-1.5 rounded-md hover:bg-muted">
                Editar
              </button>
            </>
          )}
        </div>
      )}

      {addingMember && !editing && (
        <form onSubmit={onAddMember} className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Agregar miembro</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 space-y-1 min-w-48">
              <label className="text-xs text-muted-foreground">Correo electrónico</label>
              <input
                autoFocus
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
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
            <button type="submit" disabled={addMemberPending} className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md disabled:opacity-50">
              {addMemberPending ? "Agregando..." : "Agregar"}
            </button>
            <button type="button" onClick={() => { setAddingMember(false); setAddMemberError("") }} className="px-4 py-2 text-sm rounded-md border">
              Cancelar
            </button>
          </div>
          {addMemberError && <p className="text-destructive text-xs">{addMemberError}</p>}
        </form>
      )}

      <div className="space-y-2">
        {[...members]
          .sort((a, b) => {
            if (a.role === b.role) return a.userName.localeCompare(b.userName)
            return a.role === "coach" ? -1 : 1
          })
          .map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              editing={editing}
              pendingRole={pendingRoles[m.userId] ?? (m.role as "coach" | "athlete")}
              onRoleChange={(role) => setPendingRoles((prev) => ({ ...prev, [m.userId]: role }))}
              onRemove={() => { if (confirm(`¿Eliminar a ${m.userName} del equipo?`)) onRemove(m.userId) }}
            />
          ))}
        {members.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8 border rounded-lg">
            Sin miembros todavía.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

const ROLE_STYLES = {
  coach: {
    card: "border-violet-800/60 bg-violet-950/50",
    avatar: "bg-violet-600 text-white",
    badge: "bg-violet-900/50 text-violet-300 border-violet-700/60",
    icon: <ShieldCheckIcon className="w-3 h-3" />,
    label: "Entrenador",
  },
  athlete: {
    card: "border-border bg-background",
    avatar: "bg-muted text-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
    icon: <DumbbellIcon className="w-3 h-3" />,
    label: "Atleta",
  },
}

function MemberRow({
  member, editing, pendingRole, onRoleChange, onRemove,
}: {
  member: Member
  editing: boolean
  pendingRole: "coach" | "athlete"
  onRoleChange: (role: "coach" | "athlete") => void
  onRemove: () => void
}) {
  const displayRole = editing ? pendingRole : (member.role as "coach" | "athlete")
  const styles = ROLE_STYLES[displayRole]
  const initials = member.userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors ${styles.card}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${styles.avatar}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.userName}</p>
        <p className="text-xs text-muted-foreground truncate">{member.userEmail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <select
              value={pendingRole}
              onChange={(e) => onRoleChange(e.target.value as "coach" | "athlete")}
              className="text-xs border rounded-md px-2 py-1 bg-background"
            >
              <option value="athlete">Atleta</option>
              <option value="coach">Entrenador</option>
            </select>
            <button onClick={onRemove} className="text-xs text-destructive hover:underline">
              Eliminar
            </button>
          </>
        ) : (
          <span className={`flex items-center gap-1 text-xs border rounded-full px-2.5 py-0.5 font-medium ${styles.badge}`}>
            {styles.icon}
            {styles.label}
          </span>
        )}
      </div>
    </div>
  )
}
