// Runtime de un tweak: el borrador que se va editando, las operaciones aplicadas (para el guardián de
// alcance) y el acceso al catálogo. Implementa SkillRuntime sin depender de OpenAI. También lo usa el
// adaptador MCP (adapters/mcp.ts), donde el coach dirige: admite % RM y kg, y los ids de ejercicio
// del input ya validados como visibles llegan precargados en `knownExerciseIds`.

import type { RoutineContent } from "@atleta/db/schema"
import type { Ctx } from "../ai-routines"
import { applyEdit, type EditOp, type EditOptions } from "../ai-routine-edits"
import type { Injury } from "./constraints"
import type { TweakDeps } from "./deps"
import type { AppliedOp, CatalogExercise, SkillRuntime } from "./types"

export type TweakRuntime = SkillRuntime & {
  readonly applied: AppliedOp[]
  readonly ctx: Ctx
  /** Contenido de trabajo (con todas las operaciones aplicadas, también las que el guardián descartará). */
  working(): RoutineContent
  editOptions(): EditOptions
}

export function createRuntime(args: {
  original: RoutineContent
  names: Record<string, string>
  avoid: string[]
  userId: string
  teamId: string
  deps: Pick<TweakDeps, "searchExercises" | "findAlternativePool">
  allowFixedKg: boolean
  allowRepeatExercises?: boolean
  easier?: boolean
  injuries?: Injury[]
  /** Admite loadType percent_rm. Default false: el tweak no recibe RM (`context`). */
  allowPercentRm?: boolean
  /** exerciseId que ya se pueden usar en add/replace sin pasar por search_exercises. */
  knownExerciseIds?: Iterable<string>
}): TweakRuntime {
  const ctx: Ctx = { userId: args.userId, teamId: args.teamId, allowedEquipment: null, knownIds: new Set(args.knownExerciseIds ?? []), avoid: args.avoid }
  let working = args.original
  const applied: AppliedOp[] = []

  const editOptions = (): EditOptions => ({
    knownExerciseIds: ctx.knownIds,
    exerciseNames: args.names,
    allowFixedKg: args.allowFixedKg,
    allowPercentRm: args.allowPercentRm ?? false, // en el tweak no hay RM registrados (no recibe `context`)
  })

  return {
    applied,
    ctx,
    names: args.names,
    knownExerciseIds: ctx.knownIds,
    avoid: args.avoid,
    allowRepeatExercises: args.allowRepeatExercises,
    easier: args.easier,
    injuries: args.injuries,
    getContent: () => working,
    working: () => working,
    editOptions,
    catalog: {
      async search(a) { return (await args.deps.searchExercises(a, ctx)) as CatalogExercise[] },
      alternatives: (exerciseId) => args.deps.findAlternativePool(exerciseId, ctx),
    },
    apply(op: EditOp) {
      const res = applyEdit(working, op, editOptions())
      working = res.content
      const change = res.changes[0]!
      applied.push({ op, change })
      return change
    },
  }
}
