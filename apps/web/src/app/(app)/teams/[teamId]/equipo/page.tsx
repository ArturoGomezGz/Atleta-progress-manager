"use client"

import { trpc } from "@/lib/trpc/client"
import {
  AlertTriangleIcon,
  CheckIcon,
  ClipboardIcon,
  DumbbellIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { use, useState } from "react"
import { useRouter } from "next/navigation"

export default function EquipoPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<null | "confirm" | "warn">(null)

  const { data: teams } = trpc.teams.list.useQuery()
  const { data: members, refetch: refetchMembers } = trpc.teams.members.useQuery({ teamId })

  const updateRole = trpc.teams.updateMemberRole.useMutation({ onSuccess: refetchMembers })
  const removeMember = trpc.teams.removeMember.useMutation({ onSuccess: refetchMembers })
  const deleteTeam = trpc.teams.deleteTeam.useMutation({ onSuccess: () => router.push("/dashboard") })

  const currentTeam = teams?.find((t) => t.team.id === teamId)
  const isCoach = currentTeam?.role === "coach"
  const maxAthletes = currentTeam?.team.maxAthletes ?? 1
  const maxCoaches = currentTeam?.team.maxCoaches ?? 1
  const athleteCount = members?.filter((m) => m.role === "athlete").length ?? 0
  const coachCount = members?.filter((m) => m.role === "coach").length ?? 0
  const overLimit = athleteCount > maxAthletes || coachCount > maxCoaches
  const atCapacity = athleteCount >= maxAthletes
  const otherMembersCount = (members?.length ?? 1) - 1

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold">Equipo</h1>

      {isCoach && overLimit && (
        <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/8 rounded-lg px-4 py-3 text-sm">
          <AlertTriangleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Este equipo supera el límite de tu plan actual</p>
            <p className="text-muted-foreground">
              No puedes invitar más miembros hasta ajustar el tamaño del equipo.{" "}
              <a href="mailto:soporte@atletacmw.com" className="text-primary hover:brightness-110 font-medium">
                Contacta a soporte
              </a>{" "}
              para ampliar tu plan.
            </p>
          </div>
        </div>
      )}

      <MembersSection
        teamId={teamId}
        isCoach={!!isCoach}
        members={members ?? []}
        maxAthletes={maxAthletes}
        maxCoaches={maxCoaches}
        athleteCount={athleteCount}
        coachCount={coachCount}
        atCapacity={atCapacity}
        overLimit={overLimit}
        onUpdateRole={(userId, role) => updateRole.mutateAsync({ teamId, userId, role })}
        onRemove={(userId) => removeMember.mutateAsync({ teamId, userId })}
      />

      {isCoach && (
        <div className="pt-4 border-t border-border">
          <button
            onClick={() => setDeleteDialog(otherMembersCount > 0 ? "warn" : "confirm")}
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
  maxAthletes, maxCoaches, athleteCount, coachCount,
  atCapacity, overLimit,
  onUpdateRole, onRemove,
}: {
  teamId: string
  isCoach: boolean
  members: Member[]
  maxAthletes: number
  maxCoaches: number
  athleteCount: number
  coachCount: number
  atCapacity: boolean
  overLimit: boolean
  onUpdateRole: (userId: string, role: "coach" | "athlete") => Promise<unknown>
  onRemove: (userId: string) => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [pendingRoles, setPendingRoles] = useState<Record<string, "coach" | "athlete">>({})
  const [saving, setSaving] = useState(false)

  function startEditing() {
    const initial: Record<string, "coach" | "athlete"> = {}
    members.forEach((m) => { initial[m.userId] = m.role as "coach" | "athlete" })
    setPendingRoles(initial)
    setEditing(true)
  }

  async function saveChanges() {
    setSaving(true)
    const changed = members.filter((m) => pendingRoles[m.userId] && pendingRoles[m.userId] !== m.role)
    await Promise.all(changed.map((m) => onUpdateRole(m.userId, pendingRoles[m.userId])))
    setSaving(false)
    setEditing(false)
  }

  const canInvite = isCoach && !atCapacity && !overLimit

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Miembros</span>
          <span className="text-xs text-muted-foreground">
            {athleteCount}/{maxAthletes} atleta{maxAthletes !== 1 ? "s" : ""} · {coachCount}/{maxCoaches} entrenador{maxCoaches !== 1 ? "es" : ""}
          </span>
        </div>

        {isCoach && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={startEditing}
              className="text-xs text-muted-foreground border border-border px-2.5 py-1 rounded-md hover:bg-muted transition-colors"
            >
              Editar
            </button>
            <button
              onClick={() => setShowInvite((v) => !v)}
              disabled={!canInvite}
              title={atCapacity || overLimit ? "Equipo lleno" : "Invitar atleta"}
              className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {editing && (
          <div className="flex gap-2">
            <button
              onClick={() => { setPendingRoles({}); setEditing(false) }}
              className="text-xs border px-2.5 py-1 rounded-md hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={saveChanges}
              disabled={saving}
              className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {/* Invite panel */}
      {showInvite && canInvite && (
        <InvitePanel teamId={teamId} onClose={() => setShowInvite(false)} />
      )}

      {/* Member list */}
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

// ─── Invite panel ─────────────────────────────────────────────────────────────

function InvitePanel({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const { data: existing, isLoading: loadingExisting } = trpc.teams.getInviteLink.useQuery({ teamId })

  const generate = trpc.teams.generateInviteLink.useMutation({
    onSuccess: () => { /* query cache auto-updates via refetch below */ },
  })

  const utils = trpc.useUtils()
  const activeToken = generate.data?.token ?? existing?.token ?? null
  const activeExpiry = generate.data?.expiresAt ?? existing?.expiresAt ?? null

  const inviteUrl = activeToken ? `${window.location.origin}/join/${activeToken}` : null

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegenerate() {
    await generate.mutateAsync({ teamId })
    await utils.teams.getInviteLink.invalidate({ teamId })
    setCopied(false)
  }

  const isLoading = loadingExisting || generate.isPending

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enlace de invitación</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading && !inviteUrl ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : inviteUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 text-xs border border-border rounded-md px-3 py-2 bg-background text-muted-foreground font-mono truncate"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 text-xs border border-border px-3 py-2 rounded-md hover:bg-muted transition-colors whitespace-nowrap"
            >
              {copied ? <CheckIcon className="w-3 h-3 text-primary" /> : <ClipboardIcon className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Un solo uso · expira el{" "}
              {activeExpiry ? new Date(activeExpiry).toLocaleDateString("es", { day: "numeric", month: "long" }) : "—"}
            </p>
            <button
              onClick={handleRegenerate}
              disabled={generate.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCwIcon className="w-3 h-3" />
              Regenerar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            El enlace es de un solo uso. El atleta podrá unirse al equipo directamente.
          </p>
          <button
            onClick={() => generate.mutate({ teamId })}
            disabled={generate.isPending}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {generate.isPending ? "Generando..." : "Generar enlace"}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

const ROLE_STYLES = {
  coach: {
    card: "border-primary/25 bg-primary/5",
    avatar: "bg-primary/20 text-primary",
    badge: "bg-primary/10 text-primary border-primary/25",
    icon: <ShieldCheckIcon className="w-3 h-3" />,
    label: "Entrenador",
  },
  athlete: {
    card: "border-border bg-card",
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
