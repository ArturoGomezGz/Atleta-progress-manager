// Runtime de un tweak: el borrador que se va editando, las operaciones aplicadas (para el guardián de
// alcance) y el acceso al catálogo. Implementa SkillRuntime sin depender de OpenAI.

import type { RoutineContent } from "@atleta/db/schema"
import type { Ctx } from "../ai-routines"
import { applyEdit, type EditOp, type EditOptions } from "../ai-routine-edits"
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
  deps: Pick<TweakDeps, "searchExercises" | "proposeNewExercise">
  allowFixedKg: boolean
}): TweakRuntime {
  const ctx: Ctx = { userId: args.userId, teamId: args.teamId, allowedEquipment: null, knownIds: new Set(), created: [], avoid: args.avoid }
  let working = args.original
  const applied: AppliedOp[] = []

  const editOptions = (): EditOptions => ({
    knownExerciseIds: ctx.knownIds,
    exerciseNames: args.names,
    allowFixedKg: args.allowFixedKg,
    allowPercentRm: false, // sin RM registrados no se admite percent_rm (el tweak no recibe `context`)
  })

  return {
    applied,
    ctx,
    names: args.names,
    knownExerciseIds: ctx.knownIds,
    avoid: args.avoid,
    getContent: () => working,
    working: () => working,
    editOptions,
    catalog: {
      async search(a) { return (await args.deps.searchExercises(a, ctx)) as CatalogExercise[] },
      async propose(a) { return (await args.deps.proposeNewExercise(a, ctx)) as { id?: string; name?: string; error?: string; note?: string } },
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
