"use client"

import { useSession } from "@/lib/auth"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function AccountMenu() {
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session) return null

  const initials = session.user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Link
      href="/settings"
      className={cn(
        "w-full flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left cursor-pointer",
        pathname === "/settings" && "bg-muted/60",
      )}
    >
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 tracking-wide">
        {initials}
      </div>
      <span className="text-sm font-medium truncate flex-1 text-foreground">
        {session.user.name}
      </span>
    </Link>
  )
}
