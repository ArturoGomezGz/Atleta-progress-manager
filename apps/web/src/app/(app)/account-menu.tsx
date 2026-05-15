"use client"

import { signOut, useSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-provider"
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const THEME_OPTIONS = [
  { value: "light" as const, icon: SunIcon,     label: "Claro"   },
  { value: "dark"  as const, icon: MoonIcon,    label: "Oscuro"  },
  { value: "system"as const, icon: MonitorIcon, label: "Sistema" },
]

export function AccountMenu() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  async function handleSignOut() {
    await signOut()
    router.push("/login")
  }

  if (!session) return null

  const initials = session.user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left cursor-pointer"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 tracking-wide">
          {initials}
        </div>
        <span className="text-sm font-medium truncate flex-1 text-foreground">
          {session.user.name}
        </span>
      </button>

      {open && (
        <>
          <div className="absolute bottom-full left-0 mb-2 border border-border rounded-xl shadow-2xl bg-popover z-20 overflow-hidden min-w-full w-max max-w-xs">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>

            {/* Theme selector */}
            <div className="px-3 py-2.5 border-b border-border space-y-1.5">
              <p className="text-xs text-muted-foreground">Apariencia</p>
              <div className="flex gap-1">
                {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-colors cursor-pointer ${
                      theme === value
                        ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <LogOutIcon className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

    </div>
  )
}
