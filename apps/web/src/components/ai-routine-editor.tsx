"use client"

// AI Routine Editor (experimental, flag `ai_routine_tweaks`): ajustes de UNA tarea, sin conversación.
// Barra fija abajo -> hoja inferior. Un tweak: pedido -> (opcional, una pregunta de aclaración) -> propuesta
// con diff -> aceptar o rechazar. Al terminar la hoja vuelve al estado vacío para un tweak NUEVO: no hay
// historial ni mensajes de seguimiento. Aceptar solo cambia el borrador del editor.

import { afterNextPaint } from "@/lib/after-paint"
import { diffRoutine, type ItemPreview, type RoutineDiff, type DiffEntry } from "@/lib/ai-routine-diff"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import type { RoutineContent } from "@atleta/db/schema"
import { AlertCircleIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, RepeatIcon, ShieldIcon, TimerIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

type IntentHint = {
  intent: "replace_with_alternative" | "adjust_difficulty" | "adjust_rest"
  targetItemIds?: string[]
  direction?: "up" | "down"
}

/** El pedido original del tweak: se conserva para reenviarlo con la respuesta de la aclaración o al reintentar. */
type Request = { label: string; message: string; hint?: IntentHint }

type Proposal = {
  /** Contenido del editor (serializado) sobre el que se pidió: si cambia, la propuesta caduca. */
  base: string
  message: string
  proposed: RoutineContent
  diff: RoutineDiff
}

type Phase =
  | { name: "empty" }
  | { name: "picking" }
  | { name: "loading"; request: Request }
  | { name: "clarify"; request: Request; question: string; options: string[] }
  | { name: "proposal"; request: Request; proposal: Proposal }
  | { name: "nochange"; request: Request; message: string }
  | { name: "applied"; count: number }
  | { name: "error"; request: Request; text: string; clarification?: { question: string; answer: string } }

const QUICK: { key: string; label: string; request: Request | null; Icon: typeof RepeatIcon }[] = [
  { key: "pick", label: "Reemplazar un ejercicio", request: null, Icon: RepeatIcon },
  { key: "easy", label: "Hacerla más fácil", request: { label: "Hacerla más fácil", message: "Hazla más fácil.", hint: { intent: "adjust_difficulty", direction: "down" } }, Icon: ChevronDownIcon },
  { key: "hard", label: "Hacerla más difícil", request: { label: "Hacerla más difícil", message: "Hazla más difícil.", hint: { intent: "adjust_difficulty", direction: "up" } }, Icon: ChevronUpIcon },
  { key: "lessRest", label: "Bajar los descansos", request: { label: "Bajar los descansos", message: "Baja los descansos.", hint: { intent: "adjust_rest", direction: "down" } }, Icon: TimerIcon },
  { key: "moreRest", label: "Subir los descansos", request: { label: "Subir los descansos", message: "Sube los descansos.", hint: { intent: "adjust_rest", direction: "up" } }, Icon: ClockIcon },
  { key: "knee", label: "Evitar impacto en rodilla", request: { label: "Evitar impacto en rodilla", message: "Evita el impacto en la rodilla: reemplaza los ejercicios que la carguen o tengan impacto por alternativas más amables." }, Icon: ShieldIcon },
]

const APPLIED_MS = 1600

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

export function AiRoutineEditor({ teamId, routineName, content, nameOf, onPreview, onAccept, onCreatedExercises }: {
  teamId: string
  routineName: string
  content: RoutineContent
  nameOf: (exerciseId: string) => string
  /** Vista previa de la propuesta abierta sobre las tarjetas del editor (null = ninguna). */
  onPreview: (preview: Map<string, ItemPreview> | null) => void
  onAccept: (proposed: RoutineContent, changedIds: string[]) => void
  onCreatedExercises: (list: { id: string; name: string }[]) => void
}) {
  const tweak = trpc.routines.tweakWithAI.useMutation()
  const [open, setOpen]       = useState(false)
  const [visible, setVisible] = useState(false)
  const [phase, setPhase]     = useState<Phase>({ name: "empty" })
  const [input, setInput]     = useState("")
  const active = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  const contentKey = useMemo(() => JSON.stringify(content), [content])
  const exerciseCount = content.items.reduce((n, i) => n + (i.type === "exercise" ? 1 : i.exercises.length), 0)

  const proposal = phase.name === "proposal" ? phase.proposal : null
  const stale = !!proposal && proposal.base !== contentKey

  useEffect(() => {
    onPreview(proposal && !stale ? proposal.diff.preview : null)
  }, [proposal, stale, onPreview])
  useEffect(() => () => onPreview(null), [onPreview])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [phase, open])

  // Tras aceptar: confirmación breve y la hoja vuelve al estado vacío, lista para un tweak NUEVO
  useEffect(() => {
    if (phase.name !== "applied") return
    const t = setTimeout(() => setPhase({ name: "empty" }), APPLIED_MS)
    return () => clearTimeout(t)
  }, [phase])

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

  function reset() {
    active.current++
    setInput("")
    setPhase({ name: "empty" })
  }

  /** Envía el pedido (con la respuesta de la aclaración, si ya la hay). Un pedido, a lo sumo una pregunta. */
  async function send(request: Request, clarification?: { question: string; answer: string }) {
    if (phase.name === "loading") return
    const token = ++active.current
    setInput("")
    setPhase({ name: "loading", request })
    const base = contentKey
    try {
      const res = await tweak.mutateAsync({
        teamId,
        routineContent: cleanForRequest(content),
        message: request.message,
        ...(clarification ? { clarification } : {}),
        ...(request.hint ? { intentHint: request.hint } : {}),
      })
      if (token !== active.current) return
      if (res.status === "needs_info") {
        // Solo se puede preguntar una vez: si ya hubo respuesta, esto es un error del servidor
        if (clarification) throw new Error("clarification-loop")
        setPhase({ name: "clarify", request, question: res.question, options: res.options ?? [] })
        return
      }
      if (res.createdExercises.length) onCreatedExercises(res.createdExercises)
      const created = new Map(res.createdExercises.map((e) => [e.id, e.name]))
      const diff = diffRoutine(content, res.proposedContent, (id) => created.get(id) ?? nameOf(id), res.changes)
      setPhase(diff.entries.length
        ? { name: "proposal", request, proposal: { base, message: res.message, proposed: res.proposedContent, diff } }
        : { name: "nochange", request, message: res.message })
    } catch (e) {
      if (token !== active.current) return
      setPhase({ name: "error", request, text: errorText(e), clarification })
    }
  }

  function cancel() { reset() }

  function accept(p: Proposal) {
    onAccept(p.proposed, p.diff.changedIds)
    setPhase({ name: "applied", count: p.diff.entries.length })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    if (phase.name === "clarify") void send(phase.request, { question: phase.question, answer: t })
    else if (phase.name === "empty") void send({ label: t, message: t })
  }

  const exercises = content.items.flatMap((i) => (i.type === "exercise" ? [i] : i.exercises))
  const showInput = phase.name === "empty" || phase.name === "clarify"
  const request = "request" in phase ? phase.request : null

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
              {phase.name === "empty" && (
                <>
                  <div>
                    <p className="text-[22px] leading-tight font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-barlow-condensed)" }}>¿Qué quieres cambiar?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Un ajuste a la vez. Propongo el cambio y nada se aplica hasta que aceptes.</p>
                  </div>
                  <QuickGrid onPick={(q) => (q.request ? send(q.request) : setPhase({ name: "picking" }))} />
                </>
              )}

              {phase.name === "picking" && (
                <>
                  <UserBubble text="Reemplazar un ejercicio" />
                  <Assistant>
                    <p className="text-sm">¿Cuál quieres reemplazar?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {exercises.map((ex, i) => (
                        <button key={ex.id} type="button"
                          onClick={() => send({ label: `Reemplazar ${nameOf(ex.exerciseId)}`, message: `Reemplaza «${nameOf(ex.exerciseId)}» por una alternativa adecuada que trabaje lo mismo.`, hint: { intent: "replace_with_alternative", targetItemIds: [ex.id] } })}
                          className="flex items-center gap-1.5 min-h-9 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/60 cursor-pointer">
                          <span className="text-[10px] font-bold text-primary">{i + 1}</span>{nameOf(ex.exerciseId)}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={reset} className="self-start text-xs font-medium text-primary underline underline-offset-2 cursor-pointer">Volver</button>
                  </Assistant>
                </>
              )}

              {request && <UserBubble text={request.label} />}

              {phase.name === "loading" && (
                <Assistant>
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground" role="status">
                    <span className="flex gap-1" aria-hidden="true">{[0, 150, 300].map((d) => <i key={d} className="block w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: `${d}ms` }} />)}</span>
                    Pensando el cambio para esta rutina…
                  </div>
                  <div className="border border-border rounded-xl p-3 space-y-2 animate-pulse" aria-hidden="true">
                    <div className="h-2.5 w-2/5 rounded bg-muted" /><div className="h-2.5 w-[85%] rounded bg-muted" /><div className="h-2.5 w-[70%] rounded bg-muted" />
                  </div>
                  <button type="button" onClick={cancel} className="self-start text-xs font-medium text-primary underline underline-offset-2 cursor-pointer">Cancelar</button>
                </Assistant>
              )}

              {phase.name === "clarify" && (
                <Assistant>
                  <div data-testid="ai-clarify" className="rounded-xl border border-primary/35 bg-card p-3 space-y-2.5">
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Una pregunta antes de proponer</p>
                    <p className="text-sm font-medium">{phase.question}</p>
                    {phase.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {phase.options.map((o) => (
                          <button key={o} type="button" onClick={() => send(phase.request, { question: phase.question, answer: o })}
                            className="min-h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/60 cursor-pointer">{o}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={reset} className="self-start text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer">Cancelar este ajuste</button>
                </Assistant>
              )}

              {phase.name === "proposal" && (
                <Assistant>
                  <p className="text-sm">{phase.proposal.message}</p>
                  <DiffCard proposal={phase.proposal} stale={stale} onAccept={() => accept(phase.proposal)} onReject={reset} />
                </Assistant>
              )}

              {phase.name === "nochange" && (
                <Assistant>
                  <p className="text-sm">{phase.message}</p>
                  <p className="text-xs text-muted-foreground">Sin cambios en la rutina.</p>
                  <button type="button" onClick={reset} className="self-start min-h-9 px-3.5 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Nuevo ajuste</button>
                </Assistant>
              )}

              {phase.name === "applied" && (
                <div role="status" data-testid="ai-applied" className="self-center flex items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                  <CheckIcon className="w-4 h-4" />Aplicado · {phase.count} cambio{phase.count === 1 ? "" : "s"}
                  <span className="text-[11px] font-normal text-muted-foreground">Está en el borrador; guarda al salir.</span>
                </div>
              )}

              {phase.name === "error" && (
                <Assistant>
                  <div role="alert" className="border border-destructive/45 bg-destructive/10 rounded-xl p-3 space-y-2">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-destructive"><AlertCircleIcon className="w-4 h-4" />No pude generar la propuesta</p>
                    <p className="text-xs text-muted-foreground">{phase.text} Tu rutina no cambió.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void send(phase.request, phase.clarification)} className="min-h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium cursor-pointer">Reintentar</button>
                      <button type="button" onClick={reset} className="min-h-9 px-3.5 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">Pedir otra cosa</button>
                    </div>
                  </div>
                </Assistant>
              )}
            </div>

            {showInput && (
              <form onSubmit={submit} className="flex gap-2 p-2.5 border-t border-border" style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={phase.name === "clarify" ? 300 : 1000}
                  placeholder={phase.name === "clarify" ? "Escribe tu respuesta" : "Ej.: cambia la sentadilla por algo sin barra"}
                  aria-label={phase.name === "clarify" ? "Tu respuesta" : "¿Qué quieres cambiar?"}
                  className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/70"
                />
                <button type="submit" disabled={!input.trim()} aria-label="Enviar" className="grid place-items-center w-10 h-10 shrink-0 rounded bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"><ArrowUpIcon className="w-[18px] h-[18px]" /></button>
              </form>
            )}
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
  const { diff } = proposal
  const n = diff.entries.length
  const dur = diff.minutesBefore != null && diff.minutesAfter != null && diff.minutesBefore !== diff.minutesAfter ? `${diff.minutesBefore} → ${diff.minutesAfter} min` : null

  return (
    <div className="rounded-xl overflow-hidden border border-primary/35 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-2 px-3 py-2 text-xs font-semibold bg-primary/10 border-b border-primary/20">
        <span>Propuesta · {n} cambio{n === 1 ? "" : "s"}</span>
        {dur && <span className="text-[11px] font-medium text-muted-foreground">Duración est. {dur}</span>}
      </div>
      {diff.entries.map((e) => <Row key={e.id} e={e} />)}
      {stale ? (
        <p className="px-3 py-2.5 text-xs text-muted-foreground">Editaste la rutina después de pedir esto, así que la propuesta ya no aplica. Descártala y pide el ajuste de nuevo.</p>
      ) : (
        <p className="px-3 pt-2 text-[11px] text-muted-foreground">Los cambios se ven con borde punteado en la rutina.</p>
      )}
      <div className="flex gap-2 p-3">
        <button type="button" onClick={onReject} className="flex-1 min-h-10 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground cursor-pointer">{stale ? "Descartar" : "Rechazar"}</button>
        <button type="button" onClick={onAccept} disabled={stale} className="flex-1 min-h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"><CheckIcon className="w-4 h-4" />Aceptar</button>
      </div>
    </div>
  )
}
