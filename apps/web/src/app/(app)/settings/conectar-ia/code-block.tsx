"use client"

import { CopyButton } from "@/components/share-routine"

/** Texto para copiar (URL, comando o configuración) con su botón de copiar. */
export function CodeBlock({ code, label = "Copiar" }: { code: string; label?: string }) {
  return (
    <div className="flex items-start gap-2">
      <pre className="flex-1 min-w-0 overflow-x-auto rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed font-mono text-foreground whitespace-pre">
        {code}
      </pre>
      <CopyButton value={code} label={label} />
    </div>
  )
}
