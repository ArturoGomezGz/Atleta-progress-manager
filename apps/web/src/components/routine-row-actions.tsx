"use client"

import { cn } from "@/lib/utils"
import { CopyIcon, MoreVerticalIcon, Trash2Icon, UserPlusIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

// Ancho del botón que queda a la vista al soltar a medias, y fracción del ancho de la
// fila a partir de la cual el gesto cuenta como "ejecutar" sin tocar el botón.
const REVEAL = 88
const COMMIT = 0.5

// Convención de iOS Mail y Gmail: deslizar a la derecha trae la acción principal
// (asignar) y deslizar a la izquierda la destructiva (eliminar, en rojo y al borde derecho).
// Es un atajo: todo lo demás (y lo mismo, sin gestos) vive en el menú ⋯.
export function SwipeRow({
  children,
  onAssign,
  onDelete,
  className,
}: {
  children: ReactNode
  onAssign: () => void
  onDelete: () => void
  className?: string
}) {
  const [x, setX] = useState(0)
  const [side, setSide] = useState<-1 | 0 | 1>(0)
  const [dragging, setDragging] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ sx: number; sy: number; base: number; active: boolean } | null>(null)
  const moved = useRef(false)

  function settle(next: number, commit: boolean) {
    const width = wrap.current?.clientWidth ?? 320
    if (commit && next > width * COMMIT) { setX(0); onAssign(); return }
    if (commit && next < -width * COMMIT) { setX(0); onDelete(); return }
    setX(next > REVEAL / 2 ? REVEAL : next < -REVEAL / 2 ? -REVEAL : 0)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return
    if ((e.target as HTMLElement).closest("button")) return
    gesture.current = { sx: e.clientX, sy: e.clientY, base: x, active: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.sx
    const dy = e.clientY - g.sy
    if (!g.active) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return }
      if (Math.abs(dx) < 8) return
      g.active = true
      moved.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    const width = wrap.current?.clientWidth ?? 320
    const next = Math.max(-width, Math.min(width, g.base + dx))
    if (next !== 0) setSide(next > 0 ? 1 : -1)
    setX(next)
  }

  function endGesture(commit: boolean) {
    const g = gesture.current
    gesture.current = null
    if (!g?.active) return
    setDragging(false)
    settle(x, commit)
    // El "click" que sigue a soltar el ratón no debe abrir el entrenamiento.
    setTimeout(() => { moved.current = false }, 80)
  }

  function onClickCapture(e: React.MouseEvent) {
    if (moved.current) { e.preventDefault(); e.stopPropagation(); return }
    if (x !== 0) { e.preventDefault(); e.stopPropagation(); setX(0) }
  }

  const hidden = x === 0 && !dragging

  return (
    <div ref={wrap} className={cn("relative", className)}>
      {side !== 0 && (
        // Panel del ancho justo del desplazamiento, pegado al borde: solo redondea su lado exterior,
        // así las esquinas redondeadas de la tarjeta dejan ver el fondo de la página, no el panel.
        <div
          aria-hidden={hidden}
          style={{ width: Math.abs(x) }}
          className={cn(
            "absolute inset-y-0 flex overflow-hidden",
            !dragging && "transition-[width] duration-200 ease-out",
            side > 0 ? "left-0 justify-start rounded-l-xl bg-primary text-primary-foreground" : "right-0 justify-end rounded-r-xl bg-destructive text-destructive-foreground",
          )}
        >
          <button
            type="button"
            tabIndex={hidden ? -1 : 0}
            onClick={() => { setX(0); (side > 0 ? onAssign : onDelete)() }}
            style={{ width: REVEAL }}
            className="shrink-0 flex flex-col items-center justify-center gap-1 text-[11px] font-medium cursor-pointer"
          >
            {side > 0 ? <UserPlusIcon className="w-5 h-5" /> : <Trash2Icon className="w-5 h-5" />}
            {side > 0 ? "Asignar" : "Eliminar"}
          </button>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endGesture(true)}
        onPointerCancel={() => endGesture(false)}
        onClickCapture={onClickCapture}
        onTransitionEnd={() => { if (x === 0) setSide(0) }}
        style={{ transform: `translateX(${x}px)`, touchAction: "pan-y" }}
        className={cn("relative bg-card rounded-xl", !dragging && "transition-transform duration-200 ease-out")}
      >
        {children}
      </div>
    </div>
  )
}

export function RowMenuButton({ onClick, ...rest }: { onClick: () => void } & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Más acciones"
      className="p-2 mr-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0"
      {...rest}
    >
      <MoreVerticalIcon className="w-5 h-5" />
    </button>
  )
}

export function RoutineActionsSheet({
  name,
  onClose,
  onAssign,
  onDuplicate,
  onDelete,
}: {
  name: string
  onClose: () => void
  onAssign: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey) }
  }, [onClose])

  const rows = [
    { label: "Asignar", Icon: UserPlusIcon, run: onAssign, danger: false },
    { label: "Duplicar", Icon: CopyIcon, run: onDuplicate, danger: false },
    { label: "Eliminar", Icon: Trash2Icon, run: onDelete, danger: true },
  ]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Acciones de ${name}`}>
      <div
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/50 transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}
      />
      <div
        className={cn(
          "relative w-full max-w-md bg-popover border-t border-border rounded-t-2xl px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="w-9 h-1 rounded-full bg-border mx-auto mb-3" />
        <p className="px-2 pb-2 text-sm font-semibold break-words">{name}</p>
        {rows.map(({ label, Icon, run, danger }) => (
          <button
            key={label}
            type="button"
            onClick={() => { onClose(); run() }}
            className={cn(
              "w-full flex items-center gap-4 px-2 py-3.5 rounded-xl text-[15px] text-left hover:bg-muted transition-colors cursor-pointer",
              danger && "text-destructive",
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

// Diálogo modal: bloquea el resto de la pantalla hasta aceptar o cancelar. Tocar fuera
// no lo cierra a propósito, para que borrar nunca sea un descuido.
export function ConfirmDeleteDialog({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onCancel() }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel, pending])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
      <div className={cn("absolute inset-0 bg-black/60 transition-opacity duration-150", visible ? "opacity-100" : "opacity-0")} />
      <div
        className={cn(
          "relative w-full max-w-sm bg-popover border border-border rounded-2xl p-5 shadow-xl transition-all duration-150",
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
        )}
      >
        <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive grid place-items-center mb-3">
          <Trash2Icon className="w-5 h-5" />
        </div>
        <h2 id="confirm-delete-title" className="text-base font-semibold">¿Eliminar entrenamiento?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground break-words">
          <span className="font-medium text-foreground">{name}</span> se eliminará de tus entrenamientos. Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            autoFocus
            className="py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="py-2.5 text-sm font-medium bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
