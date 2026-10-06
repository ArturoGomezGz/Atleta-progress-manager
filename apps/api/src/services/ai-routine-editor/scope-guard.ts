// Guardián de alcance (determinista). Después de ejecutar, verifica que cada cambio caiga dentro de lo que
// la intención permite y descarta el resto ANTES de armar la propuesta. Es la defensa contra el modelo que
// "aprovecha" para hacer más de lo pedido (p. ej. reemplazar un ejercicio y además reaplicar update_sets
// en otros cinco). Puro: sin DB ni red.

import type { RoutineContent } from "@atleta/db/schema"
import { applyEdit, RoutineEditError, type EditOptions, type EditOpType } from "../ai-routine-edits"
import { expandTargets, type Knob } from "./difficulty"
import type { ExecIntent } from "./intents"
import type { AppliedOp } from "./types"

export type ScopeContext = {
  intent: ExecIntent
  targetItemIds: readonly string[]
  /** Palanca realmente usada (adjust_difficulty). Si se desconoce, se permiten las tres. */
  knob?: Knob | null
  /** Contenido ANTES del tweak (para resolver hijos de bloques objetivo). */
  original: RoutineContent
}

export type Dropped = { type: EditOpType; itemId: string; reason: string }

const keysOf = (rec: Record<string, unknown> | null) => Object.keys(rec ?? {})
const only = (keys: string[], allowed: string[]) => keys.every((k) => allowed.includes(k))

type SetLike = { loadType?: string; loadValue?: number; setType?: string; targetReps?: number; targetDurationSeconds?: number }

/** Solo cambió la carga (mismo número de series y mismo trabajo por serie). */
function onlyLoadChanged(before: SetLike[], after: SetLike[]): boolean {
  return before.length === after.length && before.every((b, i) => b.setType === after[i]!.setType && b.targetReps === after[i]!.targetReps && b.targetDurationSeconds === after[i]!.targetDurationSeconds)
}

/** Devuelve el motivo si el cambio está fuera de alcance, o null si es válido. */
export function outOfScopeReason(applied: AppliedOp, ctx: ScopeContext): string | null {
  const { change } = applied
  const type = change.type
  const targets = expandTargets(ctx.original, ctx.targetItemIds)
  const onTarget = !!targets?.has(change.itemId)
  const allowed = (types: EditOpType[]) => (types.includes(type) ? null : `${type} no está permitido en ${ctx.intent}`)
  const mustTarget = () => (onTarget ? null : `${change.itemId} no es un ítem objetivo`)

  switch (ctx.intent) {
    case "replace_with_alternative":
      return allowed(["replace_exercise", "update_sets", "update_item_fields"]) ?? mustTarget()

    case "add_exercise":
      return allowed(["add_exercise"])

    case "edit_basic":
      return allowed(["update_sets", "update_item_fields", "update_block", "move_item", "remove_item"]) ?? mustTarget()

    case "adjust_rest":
      return (
        allowed(["update_item_fields", "update_block"]) ??
        (targets && !onTarget ? mustTarget() : null) ??
        (type === "update_item_fields" && !only(keysOf(change.after), ["restSeconds"]) ? "solo puede cambiar descansos" : null) ??
        (type === "update_block" && !only(keysOf(change.after), ["restBetweenRoundsSeconds"]) ? "solo puede cambiar descansos" : null)
      )

    case "adjust_difficulty": {
      const base = allowed(["update_sets", "update_item_fields", "update_block"]) ?? (targets && !onTarget ? mustTarget() : null)
      if (base) return base
      const knob = ctx.knob
      const knobs: Knob[] = knob ? [knob] : ["intensity", "volume", "rest"]
      const ok = knobs.some((k) => {
        if (k === "rest") return (type === "update_item_fields" && only(keysOf(change.after), ["restSeconds"])) || (type === "update_block" && only(keysOf(change.after), ["restBetweenRoundsSeconds"]))
        if (k === "volume") return type === "update_block" ? only(keysOf(change.after), ["rounds"]) : type === "update_sets"
        // intensity
        return type === "update_sets" && onlyLoadChanged(((change.before?.sets as SetLike[]) ?? []), ((change.after?.sets as SetLike[]) ?? []))
      })
      return ok ? null : `fuera de la palanca ${knob ?? "permitida"}`
    }
  }
}

/**
 * Filtra los cambios fuera de alcance. Si no se descartó nada devuelve el contenido de trabajo tal cual;
 * si se descartó algo, repite en orden solo las operaciones válidas sobre el contenido original (las que
 * dependían de una descartada fallan y también se descartan).
 */
export function guardChanges(
  ctx: ScopeContext,
  applied: readonly AppliedOp[],
  working: RoutineContent,
  editOptions: EditOptions,
): { content: RoutineContent; changes: AppliedOp["change"][]; dropped: Dropped[] } {
  const dropped: Dropped[] = []
  const kept: AppliedOp[] = []
  for (const a of applied) {
    const reason = outOfScopeReason(a, ctx)
    if (reason) dropped.push({ type: a.change.type, itemId: a.change.itemId, reason })
    else kept.push(a)
  }
  if (dropped.length === 0) return { content: working, changes: applied.map((a) => a.change), dropped }

  let content = ctx.original
  const changes: AppliedOp["change"][] = []
  for (const a of kept) {
    try {
      // Un alta conserva el id que ya tenía para que las operaciones siguientes lo encuentren
      const res = applyEdit(content, a.op, { ...editOptions, newId: () => a.change.itemId })
      content = res.content
      changes.push(...res.changes)
    } catch (err) {
      if (!(err instanceof RoutineEditError)) throw err
      dropped.push({ type: a.change.type, itemId: a.change.itemId, reason: `dependía de un cambio descartado: ${err.message}` })
    }
  }
  return { content, changes, dropped }
}
