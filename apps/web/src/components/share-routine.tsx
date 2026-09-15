"use client"

// Panel del entrenador para compartir una rutina con quien no tiene cuenta.
// El enlace (y su código corto) llevan a /r/<code>, donde cualquiera puede
// entrenar; al terminar se le invita a registrarse.

import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { CheckIcon, CopyIcon, Share2Icon, XIcon } from "lucide-react"
import { useState } from "react"

export function ShareRoutineButton({ routineId, routineName }: { routineId: string; routineName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors cursor-pointer shrink-0"
      >
        <Share2Icon className="w-3.5 h-3.5" />
        Compartir
      </button>
      {open && <ShareRoutineSheet routineId={routineId} routineName={routineName} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ShareRoutineSheet({
  routineId, routineName, onClose,
}: {
  routineId: string
  routineName: string
  onClose: () => void
}) {
  const { data: share, refetch, isLoading } = trpc.share.forRoutine.useQuery({ routineId })
  const createLink = trpc.share.createLink.useMutation({ onSuccess: () => refetch() })
  const revokeLink = trpc.share.revokeLink.useMutation({ onSuccess: () => refetch() })
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const url = share ? `${window.location.origin}/r/${share.code}` : ""

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compartir rutina"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold">Compartir rutina</p>
            <p className="text-sm text-muted-foreground truncate">{routineName}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 cursor-pointer" aria-label="Cerrar">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="h-24 bg-muted/40 rounded-xl animate-pulse" />
        ) : !share ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Genera un enlace para que cualquier persona pueda hacer esta rutina sin cuenta.
              Al terminar se le invita a registrarse y su entrenamiento se guarda en su historial.
            </p>
            <button
              onClick={() => createLink.mutate({ routineId })}
              disabled={createLink.isPending}
              className="w-full flex items-center justify-center gap-2 min-h-12 rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer disabled:opacity-50"
            >
              <Share2Icon className="w-4 h-4" />
              {createLink.isPending ? "Generando…" : "Generar enlace"}
            </button>
            {createLink.isError && <p className="text-sm text-destructive text-center">{createLink.error.message}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Código</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-2xl font-bold tracking-[0.2em] text-center py-3 rounded-xl bg-muted/40 border border-border">
                  {share.code}
                </p>
                <CopyButton value={share.code} label="Copiar código" />
              </div>
              <p className="text-xs text-muted-foreground">
                También pueden entrar a <strong>{window.location.host}/r</strong> y escribir el código.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Enlace</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm truncate px-3 py-2.5 rounded-xl bg-muted/40 border border-border">{url}</p>
                <CopyButton value={url} label="Copiar enlace" />
              </div>
            </div>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Te comparto esta rutina para entrenar: ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 min-h-12 rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer"
            >
              <Share2Icon className="w-4 h-4" /> Enviar por WhatsApp
            </a>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Empezaron" value={share.stats.started} />
              <Stat label="Terminaron" value={share.stats.completed} />
              <Stat label="Se registraron" value={share.stats.claimed} />
            </div>

            {confirmRevoke ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm">
                  El enlace dejará de funcionar. Los entrenamientos ya hechos se conservan.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmRevoke(false)}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { revokeLink.mutate({ routineId }); setConfirmRevoke(false) }}
                    className="text-xs px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-medium cursor-pointer"
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRevoke(true)}
                className="w-full text-sm text-muted-foreground hover:text-destructive transition-colors cursor-pointer py-2"
              >
                Desactivar enlace
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 py-2.5">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
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
