"use client"

// Piezas compartidas por la vista de enlace de rutina compartida (/rutinas/enlace/[routineId]).

import { cn } from "@/lib/utils"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 py-2.5">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* el usuario puede seleccionarlo a mano */ }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border transition-colors cursor-pointer",
        copied ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" : "border-border hover:text-foreground text-muted-foreground",
      )}
    >
      {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
    </button>
  )
}
