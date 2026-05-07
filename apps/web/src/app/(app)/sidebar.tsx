"use client"

import { trpc } from "@/lib/trpc/client"
import { ChartBarIcon, ClipboardListIcon, DumbbellIcon, MenuIcon, PlusIcon, ChevronDownIcon, UsersIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AccountMenu } from "./account-menu"

const COACH_NAV = [
  { key: "equipo",     label: "Equipo",      icon: UsersIcon },
  { key: "plantillas", label: "Plantillas",  icon: ClipboardListIcon },
  { key: "sesiones",   label: "Sesiones",    icon: DumbbellIcon },
  { key: "progreso",   label: "Progreso",    icon: ChartBarIcon },
]

const ATHLETE_NAV = [
  { key: "progreso", label: "Progreso", icon: ChartBarIcon },
]

function extractTeamId(pathname: string): string | null {
  const m = pathname.match(/^\/teams\/([^/]+)/)
  return m ? m[1] : null
}

function extractSection(pathname: string): string | null {
  const m = pathname.match(/^\/teams\/[^/]+\/([^/]+)/)
  return m ? m[1] : null
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState("")
  const pickerRef = useRef<HTMLDivElement>(null)

  const { data: teams, refetch } = trpc.teams.list.useQuery()
  const createTeam = trpc.teams.create.useMutation({
    onSuccess: (team) => {
      refetch()
      setCreatingTeam(false)
      setNewTeamName("")
      setTeamPickerOpen(false)
      setMobileOpen(false)
      router.push(`/teams/${team.id}/sesiones`)
    },
  })

  const currentTeamId = extractTeamId(pathname)
  const currentSection = extractSection(pathname)
  const currentTeam = teams?.find((t) => t.team.id === currentTeamId)
  const isAthlete = currentTeam?.role === "athlete"
  const navItems = isAthlete ? ATHLETE_NAV : COACH_NAV

  // Close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Redirect athletes away from coach-only sections
  useEffect(() => {
    if (isAthlete && currentTeamId && currentSection && currentSection !== "progreso") {
      router.replace(`/teams/${currentTeamId}/progreso`)
    }
  }, [isAthlete, currentTeamId, currentSection, router])

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    createTeam.mutate({ name: newTeamName.trim() })
  }

  const sidebarContent = (
    <>
      {/* App name */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Atleta
        </span>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded text-muted-foreground hover:text-foreground"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Team selector */}
      <div className="px-3 py-3 border-b border-border relative" ref={pickerRef}>
        <button
          onClick={() => setTeamPickerOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm font-medium transition-colors text-foreground"
        >
          <span className="truncate">
            {currentTeam ? currentTeam.team.name : "Seleccionar equipo"}
          </span>
          <ChevronDownIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </button>

        {teamPickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setTeamPickerOpen(false); setCreatingTeam(false) }} />
            <div className="absolute left-3 right-3 top-full mt-1 border border-border rounded-lg shadow-xl bg-popover z-20 overflow-hidden">
              {teams?.map(({ team }) => (
                <button
                  key={team.id}
                  onClick={() => { router.push(`/teams/${team.id}/sesiones`); setTeamPickerOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                    team.id === currentTeamId ? "font-medium text-primary" : "text-foreground"
                  }`}
                >
                  {team.name}
                </button>
              ))}
              {!creatingTeam ? (
                <button
                  onClick={() => setCreatingTeam(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted border-t border-border transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Nuevo equipo
                </button>
              ) : (
                <form onSubmit={handleCreateTeam} className="p-2 border-t border-border space-y-2">
                  <input
                    autoFocus
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Nombre del equipo"
                    className="w-full bg-card border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex gap-1">
                    <button type="submit" disabled={createTeam.isPending} className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded-md disabled:opacity-50 font-medium">
                      Crear
                    </button>
                    <button type="button" onClick={() => setCreatingTeam(false)} className="flex-1 border border-border text-xs py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(({ key, label, icon: Icon }) => {
          const href = currentTeamId ? `/teams/${currentTeamId}/${key}` : "#"
          const isActive = currentSection === key
          const disabled = !currentTeamId
          return (
            <Link
              key={key}
              href={href}
              aria-disabled={disabled}
              onClick={(e) => disabled && e.preventDefault()}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
                ${isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}
                ${disabled ? "opacity-25 cursor-default pointer-events-none" : ""}
              `}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Account */}
      <div className="px-4 py-3 border-t border-border">
        <AccountMenu />
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-popover border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        <span className="font-bold text-base tracking-tight text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {currentTeam ? currentTeam.team.name : "Atleta"}
        </span>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-56 flex flex-col bg-popover border-r border-border
          transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:shrink-0 lg:h-screen lg:sticky lg:top-0
        `}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
