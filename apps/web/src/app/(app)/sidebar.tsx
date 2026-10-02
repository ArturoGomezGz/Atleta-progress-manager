"use client"

import React from "react"
import { useFeatures } from "@/lib/features"
import { trpc } from "@/lib/trpc/client"
import { CalendarIcon, ChartBarIcon, ClipboardListIcon, CompassIcon, DumbbellIcon, ListIcon, MenuIcon, UsersIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AccountMenu } from "./account-menu"
import { cn } from "@/lib/utils"

// `sections`: secciones de la URL en las que el ítem se marca activo (por defecto, la de su href)
type NavItem = { key: string; label: string; icon: React.ElementType; hrefSuffix: string; sections?: string[] }

const COACH_NAV_BASE: NavItem[] = [
  { key: "equipo",         label: "Equipo",         icon: UsersIcon,    hrefSuffix: "equipo" },
  // Una sola entrada: las pestañas "Mis entrenamientos" y "Asignados" viven dentro de la vista
  { key: "entrenamientos", label: "Entrenamientos", icon: CalendarIcon, hrefSuffix: "plantillas", sections: ["plantillas", "rutinas", "sesiones"] },
  { key: "ejercicios",     label: "Ejercicios",     icon: ListIcon,     hrefSuffix: "ejercicios" },
  { key: "explorar",       label: "Explorar",       icon: CompassIcon,  hrefSuffix: "explorar" },
  { key: "progreso",       label: "Progreso",       icon: ChartBarIcon, hrefSuffix: "progreso" },
]

// Coach con "auto-entrenamiento" activo en el equipo actual: su propio "Hoy"
// aparece como entrada extra, justo después de "Entrenamientos".
const HOY_ITEM: NavItem = { key: "hoy", label: "Hoy", icon: ClipboardListIcon, hrefSuffix: "mis-rutinas" }

function withSelfTraining(nav: NavItem[]): NavItem[] {
  return nav.flatMap((item) => (item.key === "entrenamientos" ? [item, HOY_ITEM] : [item]))
}

const ATHLETE_NAV: NavItem[] = [
  { key: "hoy",        label: "Hoy",        icon: CalendarIcon, hrefSuffix: "mis-rutinas" },
  { key: "ejercicios", label: "Ejercicios", icon: ListIcon,     hrefSuffix: "ejercicios" },
  { key: "explorar",   label: "Explorar",   icon: CompassIcon,  hrefSuffix: "explorar" },
  { key: "progreso",   label: "Progreso",   icon: ChartBarIcon, hrefSuffix: "progreso" },
]

function extractTeamId(pathname: string): string | null {
  const m = pathname.match(/^\/teams\/([^/]+)/)
  return m ? m[1] : null
}

function extractSection(pathname: string): string | null {
  const m = pathname.match(/^\/teams\/[^/]+\/([^/]+)/)
  return m ? m[1] : null
}

function TeamLogo({ name, logoDataUrl }: { name: string; logoDataUrl?: string | null }) {
  if (logoDataUrl) {
    return (
      <img
        src={logoDataUrl}
        alt={name}
        className="w-6 h-6 rounded-md object-cover overflow-hidden shrink-0"
      />
    )
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
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

  const { data: teams } = trpc.teams.list.useQuery()

  const currentTeamId = extractTeamId(pathname)
  const currentSection = extractSection(pathname)
  const currentTeam = teams?.find((t) => t.team.id === currentTeamId)
  // When on a non-team page (/exercises, etc.) fall back to the first team so nav links stay usable
  const effectiveTeamId = currentTeamId ?? teams?.[0]?.team.id ?? null
  const isAthlete = currentTeam?.role === "athlete"
  const features = useFeatures()
  const showProgress = features.has("progress")
  const baseNav = isAthlete
    ? ATHLETE_NAV
    : currentTeam?.selfAthlete
      ? withSelfTraining(COACH_NAV_BASE)
      : COACH_NAV_BASE
  // Sin el flag `progress` la vista no existe en el menú (mientras carga tampoco)
  const navItems = showProgress ? baseNav : baseNav.filter((item) => item.key !== "progreso")

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    if (features.isLoading) return
    if (isAthlete && currentTeamId && currentSection && currentSection !== "progreso" && currentSection !== "ejercicios" && currentSection !== "explorar" && currentSection !== "mis-rutinas") {
      router.replace(`/teams/${currentTeamId}/${showProgress ? "progreso" : "mis-rutinas"}`)
    }
  }, [isAthlete, currentTeamId, currentSection, router, features.isLoading, showProgress])


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

      {/* Equipo activo: enlace a la página Equipo, donde se cambia o se crea */}
      {currentTeam ? (
        <Link
          href={`/teams/${currentTeam.team.id}/equipo`}
          className="px-4 py-2 border-b border-border flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <TeamLogo name={currentTeam.team.name} logoDataUrl={currentTeam.team.logoDataUrl} />
          <span className="truncate">{currentTeam.team.name}</span>
        </Link>
      ) : (
        <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">Atleta</div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const disabled = !effectiveTeamId
          const Icon = item.icon

          const href = effectiveTeamId ? `/teams/${effectiveTeamId}/${item.hrefSuffix}` : "#"
          const isActive = (item.sections ?? [item.hrefSuffix]).includes(currentSection ?? "")
          return (
            <Link
              key={item.key}
              href={href}
              aria-disabled={disabled}
              onClick={(e) => disabled && e.preventDefault()}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                disabled ? "opacity-25 cursor-default pointer-events-none" : "cursor-pointer",
              )}
            >
              {isActive && (
                <span className="absolute left-0 inset-y-2 w-0.5 bg-primary rounded-full" />
              )}
              <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
              {item.label}
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
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-popover/95 backdrop-blur-sm border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        <Link
          href={currentTeam ? `/teams/${currentTeam.team.id}/equipo` : "/dashboard"}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {currentTeam?.team.logoDataUrl ? (
            <img
              src={currentTeam.team.logoDataUrl}
              alt={currentTeam.team.name}
              className="w-6 h-6 rounded-md object-cover overflow-hidden shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <DumbbellIcon className="w-3 h-3 text-primary" />
            </div>
          )}
          <span
            className="font-bold text-sm tracking-widest uppercase text-foreground truncate"
            style={{ fontFamily: "var(--font-barlow-condensed)" }}
          >
            {currentTeam ? currentTeam.team.name : "Atleta"}
          </span>
        </Link>
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
