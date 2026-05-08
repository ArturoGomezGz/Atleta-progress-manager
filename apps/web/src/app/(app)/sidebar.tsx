"use client"

import { trpc } from "@/lib/trpc/client"
import { ChartBarIcon, ClipboardListIcon, DumbbellIcon, ListIcon, MenuIcon, PlusIcon, ChevronDownIcon, UsersIcon, XIcon } from "lucide-react"
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

function TeamInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="w-6 h-6 rounded-md bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 tracking-wide">
      {initials}
    </div>
  )
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
  // When on a non-team page (/exercises, etc.) fall back to the first team so nav links stay usable
  const effectiveTeamId = currentTeamId ?? teams?.[0]?.team.id ?? null
  const isAthlete = currentTeam?.role === "athlete"
  const navItems = isAthlete ? ATHLETE_NAV : COACH_NAV

  useEffect(() => { setMobileOpen(false) }, [pathname])

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
      {/* Logo / App name */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <DumbbellIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span
            className="font-bold text-base tracking-widest uppercase text-foreground"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            Atleta
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Team selector */}
      <div className="px-3 py-3 border-b border-border relative" ref={pickerRef}>
        <button
          onClick={() => setTeamPickerOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/60 text-sm font-medium transition-colors text-foreground cursor-pointer"
        >
          {currentTeam && <TeamInitials name={currentTeam.team.name} />}
          <span className="truncate flex-1 text-left">
            {currentTeam ? currentTeam.team.name : "Seleccionar equipo"}
          </span>
          <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${teamPickerOpen ? "rotate-180" : ""}`} />
        </button>

        {teamPickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setTeamPickerOpen(false); setCreatingTeam(false) }} />
            <div className="absolute left-3 right-3 top-full mt-1.5 border border-border rounded-lg shadow-2xl bg-popover z-20 overflow-hidden">
              {teams?.map(({ team }) => (
                <button
                  key={team.id}
                  onClick={() => { router.push(`/teams/${team.id}/sesiones`); setTeamPickerOpen(false) }}
                  className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors cursor-pointer ${
                    team.id === currentTeamId ? "font-medium text-primary" : "text-foreground"
                  }`}
                >
                  <TeamInitials name={team.name} />
                  {team.name}
                </button>
              ))}
              {!creatingTeam ? (
                <button
                  onClick={() => setCreatingTeam(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/60 border-t border-border transition-colors cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Nuevo equipo
                </button>
              ) : (
                <form onSubmit={handleCreateTeam} className="p-2.5 border-t border-border space-y-2">
                  <input
                    autoFocus
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Nombre del equipo"
                    className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex gap-1.5">
                    <button type="submit" disabled={createTeam.isPending} className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded-md disabled:opacity-50 font-medium cursor-pointer">
                      Crear
                    </button>
                    <button type="button" onClick={() => setCreatingTeam(false)} className="flex-1 border border-border text-xs py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer">
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
          const href = effectiveTeamId ? `/teams/${effectiveTeamId}/${key}` : "#"
          const isActive = currentSection === key
          const disabled = !effectiveTeamId
          return (
            <Link
              key={key}
              href={href}
              aria-disabled={disabled}
              onClick={(e) => disabled && e.preventDefault()}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                ${isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
                ${disabled ? "opacity-25 cursor-default pointer-events-none" : "cursor-pointer"}
              `}
            >
              {isActive && (
                <span className="absolute left-0 inset-y-2 w-0.5 bg-primary rounded-full" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
              {label}
            </Link>
          )
        })}

        <div className="pt-1 mt-1 border-t border-border/50">
          <Link
            href="/exercises"
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer
              ${pathname === "/exercises"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
            `}
          >
            {pathname === "/exercises" && (
              <span className="absolute left-0 inset-y-2 w-0.5 bg-primary rounded-full" />
            )}
            <ListIcon className="w-4 h-4 shrink-0" />
            Mis ejercicios
          </Link>
        </div>
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
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-popover/95 backdrop-blur-sm border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <DumbbellIcon className="w-3 h-3 text-primary" />
          </div>
          <span
            className="font-bold text-sm tracking-widest uppercase text-foreground truncate"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            {currentTeam ? currentTeam.team.name : "Atleta"}
          </span>
        </div>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-56 flex flex-col bg-popover border-r border-border
          transition-transform duration-250 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:shrink-0 lg:h-screen lg:sticky lg:top-0
        `}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
