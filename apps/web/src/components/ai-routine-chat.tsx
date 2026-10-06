"use client"

// Chat de ajustes con IA del editor de plantillas (experimental, flag `ai_routine_tweaks`).
// Barra fija abajo -> hoja inferior con la conversación. Cada respuesta puede traer una propuesta
// (diff) que no toca nada hasta aceptarla; al aceptar se aplica solo al borrador del editor.

import { afterNextPaint } from "@/lib/after-paint"
import { diffRoutine, type DiffEntry, type ItemPreview, type RoutineDiff } from "@/lib/ai-routine-diff"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import type { RoutineContent } from "@atleta/db/schema"
import { AlertCircleIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, CopyIcon, RepeatIcon, ShieldIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

type Proposal = {
  id: number
  /** Contenido del editor (serializado) sobre el que se pidió: si cambia, la propuesta caduca. */
  base: string
  proposed: RoutineContent
  diff: RoutineDiff
  status: "open" | "applied" | "rejected"
}

type Msg =
  | { id: number; role: "user"; text: string; sent: string }
  | { id: number; role: "assistant"; text: string; proposal?: Proposal }

type Pending = { label: string; message: string }

const HISTORY_TURNS = 6

const QUICK: { key: string; label: string; message: string | null; Icon: typeof CopyIcon }[] = [
  { key: "pick", label: "Reemplazar un ejercicio", message: null, Icon: RepeatIcon },
  { key: "easy", label: "Hacerla más fácil", message: "Hazla más fácil: baja un poco la intensidad o el volumen sin cambiar los ejercicios.", Icon: ChevronDownIcon },
  { key: "hard", label: "Hacerla más difícil", message: "Hazla más difícil: sube un poco la intensidad o el volumen sin agregar ejercicios nuevos.", Icon: ChevronUpIcon },
  { key: "variant", label: "Variante de la rutina", message: "Dame una variante de esta rutina: misma estructura y volumen, con variantes de los ejercicios principales.", Icon: CopyIcon },
  { key: "short", label: "Acortar a 45 min", message: "Acórtala a unos 45 minutos recortando descansos y series, y manteniendo los ejercicios principales.", Icon: ClockIcon },
  { key: "knee", label: "Evitar impacto en rodilla", message: "Evita el impacto en la rodilla: reemplaza los ejercicios que la carguen o tengan impacto por alternativas más amables.", Icon: ShieldIcon },
]

/** Estado actual del editor tal como lo valida la API: descansos en 0 no son válidos (> 0). */
function cleanForRequest(content: RoutineContent): RoutineContent {
  const fixEx = <T extends { restSeconds?: number }>(e: T): T => (e.restSeconds != null && e.restSeconds <= 0 ? { ...e, restSeconds: undefined } : e)
  return {
    ...content,
    items: content.items.map((it) =>
      it.type === "exercise"
        ? fixEx(it)
        : {
            ...it,
            restBetweenRoundsSeconds: it.restBetweenRoundsSeconds != null && it.restBetweenRoundsSeconds <= 0 ? undefined : it.restBetweenRoundsSeconds,
            exercises: it.exercises.map(fixEx),
          },
    ),
  }
}

function errorText(e: unknown): string {
  const code = (e as { data?: { code?: string } } | null)?.data?.code
  if (code === "TOO_MANY_REQUESTS") return "Hiciste muchos ajustes seguidos. Espera unos minutos y vuelve a intentarlo."
  if (code === "FORBIDDEN") return "Los ajustes con IA no están disponibles para tu cuenta o este equipo."
  if (code === "BAD_REQUEST") return "No pude leer la rutina para ajustarla. Revisa que no haya circuitos vacíos."
  return "La IA no pudo responder esta vez. Inténtalo de nuevo."
}

export function AiRoutineChat({ teamId, routineName, content, nameOf, onPreview, onAccept, onCreatedExercises }: {
  teamId: string
  routineName: string
  content: RoutineContent
  nameOf: (exerciseId: string) => string
  /** Vista previa de la propuesta abierta sobre las tarjetas del editor (null = ninguna). */
  onPreview: (preview: Map<string, ItemPreview> | null) => void
  onAccept: (proposed: RoutineContent, changedIds: string[]) => void
  onCreatedExercises: (list: { id: string; name: string }[]) => void
}) {
  const refine = trpc.routines.refineWithAI.useMutation()
  const [open, setOpen]         = useState(false)
  const [visible, setVisible]   = useState(false)
  const [msgs, setMsgs]         = useState<Msg[]>([])
  const [picking, setPicking]   = useState(false)
  const [loading, setLoading]   = useState<Pending | null>(null)
  const [error, setError]       = useState<{ text: string; retry: Pending } | null>(null)
  const [input, setInput]       = useState("")
  const seq = useRef(0)
  const active = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  const contentKey = useMemo(() => JSON.stringify(content), [content])
  const exerciseCount = content.items.reduce((n, i) => n + (i.type === "exercise" ? 1 : i.exercises.length), 0)

  // Propuesta abierta más reciente; caduca si el editor cambió desde que se pidió
  const lastProposal = useMemo(() => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.role === "assistant" && m.proposal) return m.proposal
    }
    return null
  }, [msgs])
  const openProposal = lastProposal?.status === "open" ? lastProposal : null
  const stale = !!openProposal && openProposal.base !== contentKey

  useEffect(() => {
    onPreview(openProposal && !stale ? openProposal.diff.preview : null)
  }, [openProposal, stale, onPreview])
  useEffect(() => () => onPreview(null), [onPreview])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, loading, error, picking, open])

  // Abrir: entrada animada y entrada propia en el historial para que "atrás" cierre la hoja
  useEffect(() => {
    if (!open) return
    closing.current = false
    const cancel = afterNextPaint(() => setVisible(true))
    window.history.pushState({ ...window.history.state, aiChat: true }, "")
    function onPop(e: PopStateEvent) {
      if (closing.current || e.state?.aiChat) return
      closing.current = true
      setVisible(false)
      setTimeout(() => setOpen(false), 200)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close() }
    window.addEventListener("popstate", onPop)
    window.addEventListener("keydown", onKey)
    return () => { cancel(); window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey) }
  }, [open])

  function close() {
    if (!closing.current) window.history.back()
  }

  async function send(p: Pending) {
    if (loading) return
    const token = ++active.current
    setPicking(false)
    setError(null)
    setInput("")
    setLoading(p)
    // Un pedido anterior que falló queda sin respuesta: se quita para no ensuciar el historial
    const prior = error ? msgs.slice(0, -1) : msgs
    if (error) setMsgs(prior)
    const history = prior.map((m) => ({ role: m.role, content: m.role === "user" ? m.sent : m.text })).slice(-HISTORY_TURNS)
    const userMsg: Msg = { id: ++seq.current, role: "user", text: p.label, sent: p.message }
    const base = contentKey
    try {
      const res = await refine.mutateAsync({
        teamId,
        routineContent: cleanForRequest(content),
        message: p.message,
        history: history.map((h) => ({ role: h.role, content: h.content.slice(0, 2000) })),
      })
      if (token !== active.current) return
      if (res.createdExercises.length) onCreatedExercises(res.createdExercises)
      const created = new Map(res.createdExercises.map((e) => [e.id, e.name]))
      const diff = diffRoutine(content, res.proposedContent, (id) => created.get(id) ?? nameOf(id), res.changes)
      const proposal: Proposal | undefined = diff.entries.length
        ? { id: ++seq.current, base, proposed: res.proposedContent, diff, status: "open" }
        : undefined
      setMsgs((cur) => [...cur, userMsg, { id: ++seq.current, role: "assistant", text: res.message, proposal }])
    } catch (e) {
      if (token !== active.current) return
      setError({ text: errorText(e), retry: p })
      setMsgs((cur) => [...cur, userMsg])
    } finally {
      if (token === active.current) setLoading(null)
    }
  }

  function cancel() {
    active.current++
    setLoading(null)
  }

  function setStatus(id: number, status: Proposal["status"]) {
    setMsgs((cur) => cur.map((m) => (m.role === "assistant" && m.proposal?.id === id ? { ...m, proposal: { ...m.proposal, status } } : m)))
  }

  function accept(p: Proposal) {
    onAccept(p.proposed, p.diff.changedIds)
    setStatus(p.id, "applied")
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = input.trim()
    if (t && !loading) void send({ label: t, message: t })
  }

  const exercises = content.items.flatMap((i) => (i.type === "exercise" ? [i] : i.exercises))
  const lastMsg = msgs[msgs.length - 1]
  const showFollowUps = !loading && !error && !picking && lastMsg?.role === "assistant" && (!lastMsg.proposal || lastMsg.proposal.status === "rejected")
  const empty = msgs.length === 0 && !picking && !loading

  return (
    <>
      {!open && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 pointer-events-none" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="ai-chat-bar"
            className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-2.5 h-[52px] pl-1.5 pr-3 rounded-[10px] border border-primary/50 bg-popover shadow-xl shadow-black/30 hover:border-primary text-left cursor-pointer transition-colors"
          >
            <span className="grid place-items-center w-10 h-10 rounded bg-primary text-primary-foreground shrink-0"><Diamond size={20} /></span>
            <span className="flex-1 min-w-0 truncate text-sm text-muted-foreground">¿Qué quieres cambiar de esta rutina?</span>
          </button>
        </div>
      )}

      {open && (
        <div className={cn("fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")} onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ajustar con IA"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex flex-col w-full max-w-2xl h-[min(82dvh,640px)] rounded-t-2xl border border-b-0 border-border bg-card shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none",
              visible ? "translate-y-0" : "translate-y-full",
            )}
          >
            <div className="flex justify-center pt-2" aria-hidden="true"><i className="block w-9 h-1 rounded-full bg-border" /></div>
            <div className="flex items-center gap-2 pl-4 pr-2 py-2 border-b border-border">
              <span className="grid place-items-center w-[26px] h-[26px] rounded-[3px] bg-primary text-primary-foreground shrink-0"><Diamond size={16} /></span>
              <p className="flex-1 min-w-0 text-sm font-semibold">
                Ajustar con IA
                <span className="ml-1.5 align-[1px] text-[10px] font-medium text-primary border border-primary/30 rounded-full px-1.5 py-px">Experimental</span>
              </p>
              <button type="button" onClick={close} aria-label="Cerrar" className="grid place-items-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"><XIcon className="w-5 h-5" /></button>
            </div>
            <p className="px-4 py-1.5 text-[11px] text-muted-foreground bg-muted/25 border-b border-border truncate">
              Solo cambia <b className="text-foreground font-semibold">{routineName || "esta plantilla"}</b> · {exerciseCount} ejercicio{exerciseCount === 1 ? "" : "s"}
            </p>

            <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {empty && (
                <>
                  <div>
                    <p className="text-[22px] leading-tight font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-barlow-condensed)" }}>¿Qué quieres cambiar?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Propongo cambios solo sobre esta plantilla. Nada se aplica hasta que aceptes.</p>
                  </div>
                  <QuickGrid onPick={(q) => (q.message ? send({ label: q.label, message: q.message }) : setPicking(true))} />
                </>
              )}

              {msgs.map((m) => m.role === "user" ? <UserBubble key={m.id} text={m.text} /> : (
                <Assistant key={m.id}>
                  <p className="text-sm">{m.text}</p>
                  {m.proposal && (
                    <DiffCard
                      proposal={m.proposal}
                      stale={m.proposal.status === "open" && m.proposal.base !== contentKey}
                      onAccept={() => accept(m.proposal!)}
                      onReject={() => setStatus(m.proposal!.id, "rejected")}
                    />
                  )}
                  {!m.proposal && <p className="text-xs text-muted-foreground">Sin cambios en la rutina.</p>}
                </Assistant>
              ))}

              {picking && (
                <>
                  <UserBubble text="Reemplazar un ejercicio" />
                  <Assistant>
                    <p className="text-sm">¿Cuál quieres reemplazar?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {exercises.map((ex, i) => (
                        <button key={ex.id} type="button" onClick={() => send({ label: `Reemplazar ${nameOf(ex.exerciseId)}`, message: `Reemplaza «${nameOf(ex.exerciseId)}» por una alternativa adecuada que trabaje lo mismo.` })}
                          className="flex items-center gap-1.5 min-h-9 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/60 cursor-pointer">
                          <span className="text-[10px] font-bold text-primary">{i + 1}</span>{nameOf(ex.exerciseId)}
                        </button>
                      ))}
                    </div>
                  </Assistant>
                </>
              )}

              {loading && (
                <>
                  <UserBubble text={loading.label} />
                  <Assistant>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground" role="status">
                      <span className="flex gap-1" aria-hidden="true">{[0, 150, 300].map((d) => <i key={d} className="block w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: `${d}ms` }} />)}</span>
                      Pensando cambios para esta rutina…
                    </div>
                    <div className="border border-border rounded-xl p-3 space-y-2 animate-pulse" aria-hidden="true">
                      <div className="h-2.5 w-2/5 rounded bg-muted" /><div className="h-2.5 w-[85%] rounded bg-muted" /><div className="h-2.5 w-[70%] rounded bg-muted" />
                    </div>
                    <button type="button" onClick={cancel} className="self-start text-xs font-medium text-primary underline underline-offset-2 cursor-pointer">Cancelar</button>
                  </Assistant>
                </>
              )}

              {error && (
                <Assistant>
                  <div role="alert" className="border border-destructive/45 bg-destructive/10 rounded-xl p-3 space-y-2">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-destructive"><AlertCircleIcon className="w-4 h-4" />No pude generar la propuesta</p>
                    <p className="text-xs text-muted-foreground">{error.text} Tu rutina no cambió.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void send(error.retry)} className="min-h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium cursor-pointer">Reintentar</button>
                      <button type="button" onClick={() => { setError(null); setMsgs((c) => c.slice(0, -1)) }} className="min-h-9 px-3.5 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Pedir otra cosa</button>
                    </div>
                  </div>
                </Assistant>
              )}

              {showFollowUps && (
                <>
                  {lastMsg?.role === "assistant" && lastMsg.proposal?.status === "rejected" && (
                    <p className="self-center text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-0.5">Propuesta descartada. ¿Probamos otra cosa?</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK.filter((q) => ["easy", "short", "pick"].includes(q.key)).map((q) => (
                      <button key={q.key} type="button" onClick={() => (q.message ? send({ label: q.label, message: q.message }) : setPicking(true))}
                        className="min-h-9 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/60 cursor-pointer">{q.key === "pick" ? "Reemplazar otro" : q.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <form onSubmit={submit} className="flex gap-2 p-2.5 border-t border-border" style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!!loading}
                maxLength={1000}
                placeholder="Ej.: cambia la sentadilla por algo sin barra"
                aria-label="¿Qué quieres cambiar?"
                className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/70 disabled:opacity-50"
              />
              <button type="submit" disabled={!!loading || !input.trim()} aria-label="Enviar" className="grid place-items-center w-10 h-10 shrink-0 rounded bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"><ArrowUpIcon className="w-[18px] h-[18px]" /></button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Diamond({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="5.5" width="13" height="13" transform="rotate(45 12 12)" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" transform="rotate(45 12 12)" fill="currentColor" />
    </svg>
  )
}

function UserBubble({ text }: { text: string }) {
  return <div className="self-end max-w-[85%] bg-primary text-primary-foreground px-3 py-2 rounded-xl rounded-br-sm text-[13px]">{text}</div>
}

function Assistant({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="grid place-items-center w-[22px] h-[22px] mt-px rounded-[3px] bg-primary/15 text-primary shrink-0"><Diamond size={13} /></span>
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function QuickGrid({ onPick }: { onPick: (q: (typeof QUICK)[number]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {QUICK.map((q) => (
        <button key={q.key} type="button" onClick={() => onPick(q)}
          className="flex items-center gap-2 text-left min-h-11 px-2.5 py-2 rounded-md border border-border bg-card/60 text-xs font-medium hover:border-primary/60 hover:text-primary cursor-pointer transition-colors">
          <span className="grid place-items-center w-6 h-6 rounded-[3px] bg-primary/10 text-primary shrink-0"><q.Icon className="w-3 h-3" /></span>{q.label}
        </button>
      ))}
    </div>
  )
}

function Row({ e }: { e: DiffEntry }) {
  return (
    <div className="px-3 py-2.5 border-b border-border last:border-b-0 space-y-1">
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">{e.title}</p>
      {e.summary && <p className="text-[11px] text-muted-foreground">{e.summary}</p>}
      {e.before && <div className="flex gap-1.5 text-xs px-1.5 py-0.5 rounded bg-destructive/10"><span className="font-bold text-destructive">−</span><span className="text-muted-foreground line-through decoration-destructive/70">{e.before}</span></div>}
      {e.after && <div className="flex gap-1.5 text-xs px-1.5 py-0.5 rounded bg-primary/10 font-semibold"><span className="font-bold text-primary">+</span><span>{e.after}</span></div>}
    </div>
  )
}

function DiffCard({ proposal, stale, onAccept, onReject }: { proposal: Proposal; stale: boolean; onAccept: () => void; onReject: () => void }) {
  const { diff, status } = proposal
  const n = diff.entries.length
  const label = `${n} cambio${n === 1 ? "" : "s"}`
  const dur = diff.minutesBefore != null && diff.minutesAfter != null && diff.minutesBefore !== diff.minutesAfter ? `${diff.minutesBefore} → ${diff.minutesAfter} min` : null

  if (status === "rejected") {
    return <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">Descartada · {label}</div>
  }
  return (
    <div className={cn("rounded-xl overflow-hidden border bg-card", status === "applied" ? "border-primary/35" : "border-primary/35")}>
      <div className={cn("flex flex-wrap items-center justify-between gap-x-2 px-3 py-2 text-xs font-semibold bg-primary/10 border-b border-primary/20", status === "applied" && "text-primary")}>
        <span className="flex items-center gap-1.5">{status === "applied" && <CheckIcon className="w-4 h-4" />}{status === "applied" ? "Aplicado" : "Propuesta"} · {label}</span>
        {dur && <span className="text-[11px] font-medium text-muted-foreground">Duración est. {dur}</span>}
      </div>
      {diff.entries.map((e) => <Row key={e.id} e={e} />)}
      {status === "open" && (
        <>
          {stale ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">Editaste la rutina después de pedir esto, así que la propuesta ya no aplica. Pide el ajuste de nuevo.</p>
          ) : (
            <p className="px-3 pt-2 text-[11px] text-muted-foreground">Los cambios se ven con borde punteado en la rutina.</p>
          )}
          <div className="flex gap-2 p-3">
            <button type="button" onClick={onReject} className="flex-1 min-h-10 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Rechazar</button>
            <button type="button" onClick={onAccept} disabled={stale} className="flex-1 min-h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"><CheckIcon className="w-4 h-4" />Aceptar</button>
          </div>
        </>
      )}
      {status === "applied" && <p className="px-3 py-2.5 text-[11px] text-muted-foreground">Está en el borrador. Al salir, elige <b>Guardar</b> para conservarlo.</p>}
    </div>
  )
}
