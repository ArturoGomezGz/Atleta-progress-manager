"use client"

// Apps conectadas por OAuth (Claude, ChatGPT…). Desconectar borra sus tokens y el permiso:
// la app deja de funcionar al instante y, si se vuelve a conectar, pedirá permiso de nuevo.

import { trpc } from "@/lib/trpc/client"
import { scopesSummary } from "@/lib/mcp-scopes"
import { BotIcon } from "lucide-react"
import { ghostButtonClass } from "../settings-ui"
import { formatDate } from "./personal-tokens"

export function ConnectedApps() {
  const utils = trpc.useUtils()
  const { data: apps, isLoading } = trpc.mcp.listConnectedApps.useQuery()
  const revoke = trpc.mcp.revokeApp.useMutation({ onSuccess: () => utils.mcp.listConnectedApps.invalidate() })

  if (isLoading) return <p className="px-4 py-3.5 text-sm text-muted-foreground">Cargando…</p>
  if (!apps?.length) return <p className="px-4 py-3.5 text-sm text-muted-foreground">Ninguna app conectada todavía.</p>

  return (
    <>
      {apps.map((app) => {
        const name = app.name?.trim() || "App sin nombre"
        return (
          <div key={app.clientId} className="flex items-center gap-3 px-4 py-3.5">
            <BotIcon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
              <p className="text-xs text-muted-foreground">
                {scopesSummary(app.scopes)} · Conectada el {formatDate(app.connectedAt)}
              </p>
            </div>
            <button
              type="button"
              disabled={revoke.isPending}
              onClick={() => {
                if (window.confirm(`¿Desconectar ${name}? Dejará de tener acceso a tu cuenta.`)) revoke.mutate({ clientId: app.clientId })
              }}
              className={`${ghostButtonClass} text-destructive`}
            >
              Desconectar
            </button>
          </div>
        )
      })}
    </>
  )
}
