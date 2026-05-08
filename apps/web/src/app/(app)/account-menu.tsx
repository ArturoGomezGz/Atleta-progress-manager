"use client"

import { signOut, useSession } from "@/lib/auth"
import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function AccountMenu() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)

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
    <div className="relative">
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 border border-border rounded-xl shadow-2xl bg-popover z-20 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
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
