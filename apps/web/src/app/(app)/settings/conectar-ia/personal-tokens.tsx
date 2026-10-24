"use client"

// Tokens personales (atl_pat_…): para clientes sin OAuth (Claude Code con --header, mcp-remote,
// scripts). El token completo solo se ve al crearlo; luego queda su prefijo para reconocerlo.

import { trpc } from "@/lib/trpc/client"
import { scopesSummary } from "@/lib/mcp-scopes"
import { KeyRoundIcon } from "lucide-react"
import { useState } from "react"
import { ghostButtonClass, inputClass, primaryButtonClass } from "../settings-ui"
import { CodeBlock } from "./code-block"

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
  { value: "never", label: "Nunca" },
] as const

type Expiry = (typeof EXPIRY_OPTIONS)[number]["value"]

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
}

function CreateTokenForm({ onCreated, onCancel }: { onCreated: (token: string) => void; onCancel: () => void }) {
  const utils = trpc.useUtils()
  const [name, setName] = useState("")
  const [write, setWrite] = useState(true)
  const [expiry, setExpiry] = useState<Expiry>("90")
  const create = trpc.mcp.createToken.useMutation({
    onSuccess: (res) => {
      void utils.mcp.listTokens.invalidate()
      onCreated(res.token)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate({
      name: name.trim(),
      scopes: write ? ["atleta:read", "atleta:write"] : ["atleta:read"],
      expiresInDays: expiry === "never" ? null : (Number(expiry) as 30 | 90 | 365),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
      <div className="space-y-1.5">
        <label htmlFor="pat-name" className="text-sm font-medium text-foreground">Nombre</label>
        <input
          id="pat-name"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="p. ej. Claude Code en mi laptop"
          className={inputClass}
        />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-foreground">Permisos</legend>
        <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
          <input type="radio" name="pat-scope" checked={write} onChange={() => setWrite(true)} className="accent-primary mt-1" />
          <span>
            Lectura y escritura
            <span className="block text-xs text-muted-foreground">Crear y editar entrenamientos, asignar y programar planes.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
          <input type="radio" name="pat-scope" checked={!write} onChange={() => setWrite(false)} className="accent-primary mt-1" />
          <span>
            Solo lectura
            <span className="block text-xs text-muted-foreground">Consultar sin cambiar nada.</span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="pat-expiry" className="text-sm font-medium text-foreground">Vence en</label>
        <select id="pat-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)} className={inputClass}>
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {create.error && <p className="text-destructive text-sm">{create.error.message}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending || !name.trim()} className={primaryButtonClass}>
          {create.isPending ? "Creando..." : "Crear token"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButtonClass}>Cancelar</button>
      </div>
    </form>
  )
}

export function PersonalTokens() {
  const utils = trpc.useUtils()
  const { data: tokens, isLoading } = trpc.mcp.listTokens.useQuery()
  const revoke = trpc.mcp.revokeToken.useMutation({ onSuccess: () => utils.mcp.listTokens.invalidate() })
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const now = Date.now()

  return (
    <>
      {newToken && (
        <div className="px-4 py-4 space-y-2 bg-primary/5">
          <p className="text-sm font-medium text-foreground">Copia tu token ahora: no lo volverás a ver.</p>
          <CodeBlock code={newToken} label="Copiar token" />
          <p className="text-xs text-muted-foreground">Trátalo como una contraseña. Si se filtra, revócalo aquí.</p>
          <button type="button" onClick={() => setNewToken(null)} className={ghostButtonClass}>Listo, ya lo copié</button>
        </div>
      )}

      {isLoading && <p className="px-4 py-3.5 text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && tokens?.length === 0 && !creating && (
        <p className="px-4 py-3.5 text-sm text-muted-foreground">Aún no tienes tokens personales.</p>
      )}

      {tokens?.map((t) => {
        const expired = !!t.expiresAt && new Date(t.expiresAt).getTime() <= now
        return (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
            <KeyRoundIcon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {t.name}
                {expired && <span className="ml-2 text-xs font-medium text-destructive">Vencido</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{t.prefix}…</span> · {scopesSummary(t.scopes)} · Último uso: {formatDate(t.lastUsedAt)} ·{" "}
                {t.expiresAt ? `${expired ? "Venció" : "Vence"} ${formatDate(t.expiresAt)}` : "No vence"}
              </p>
            </div>
            <button
              type="button"
              disabled={revoke.isPending}
              onClick={() => {
                if (window.confirm(`¿Revocar el token «${t.name}»? Las apps que lo usen dejarán de funcionar.`)) revoke.mutate({ id: t.id })
              }}
              className={`${ghostButtonClass} text-destructive`}
            >
              Revocar
            </button>
          </div>
        )
      })}

      {creating ? (
        <CreateTokenForm
          onCreated={(token) => {
            setNewToken(token)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <div className="px-4 py-3.5">
          <button type="button" onClick={() => setCreating(true)} className={ghostButtonClass}>Crear token</button>
        </div>
      )}
    </>
  )
}
