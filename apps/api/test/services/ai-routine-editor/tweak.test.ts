import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type OpenAI from "openai"
import { tweakInputSchema, TWEAK_MAX_MESSAGE_CHARS, type TweakInput } from "../../../src/services/ai-routine-editor/input"
import { tweakRoutineWithAI } from "../../../src/services/ai-routine-editor/tweak"
import { content, BAD_EX, ITEM_DIPS, ITEM_PRESS, ITEM_ROW, ITEM_SQUAT, log, mockDeps, NEW_EX, TEAM, id, type Call, type Seen } from "./helpers"

const base = (over: Partial<TweakInput> = {}): TweakInput => ({ teamId: TEAM, routineContent: content(), message: "sustitúyelo por algo más", ...over })
const route = (args: Record<string, unknown>): Call => ({ name: "route_request", args })
const done = (message = "ok"): Call => ({ name: "propose_edits", args: { message } })
const seenOf = (): Seen => ({ router: [], agent: [] })

function toolReplies(seen: Seen, turn: number) {
  return seen.agent[turn]!.messages.filter((m): m is OpenAI.Chat.Completions.ChatCompletionToolMessageParam => m.role === "tool").map((m) => m.content as string)
}

describe("tweakInputSchema", () => {
  it("acepta una entrada mínima, sin history ni context", () => {
    const parsed = tweakInputSchema.parse({ teamId: TEAM, routineContent: content(), message: "  hola  " })
    assert.equal(parsed.message, "hola")
    assert.ok(!("history" in parsed) && !("context" in parsed))
  })
  it("valida mensaje, aclaración y pista", () => {
    assert.equal(tweakInputSchema.safeParse(base({ message: "  " })).success, false)
    assert.equal(tweakInputSchema.safeParse(base({ message: "x".repeat(TWEAK_MAX_MESSAGE_CHARS + 1) })).success, false)
    assert.equal(tweakInputSchema.safeParse(base({ clarification: { question: "¿Cuál?", answer: "" } })).success, false)
    assert.equal(tweakInputSchema.safeParse({ ...base(), intentHint: { intent: "volar" } }).success, false)
    assert.equal(tweakInputSchema.safeParse({ ...base(), intentHint: { intent: "adjust_difficulty", direction: "up" } }).success, true)
  })
  it("rechaza rutinas vacías o demasiado grandes", () => {
    assert.equal(tweakInputSchema.safeParse({ ...base(), routineContent: { v: 1, items: [] } }).success, false)
    const many = { v: 1, items: Array.from({ length: 31 }, (_, i) => ({ ...content().items[0]!, id: id(500 + i), order: i })) }
    assert.equal(tweakInputSchema.safeParse({ ...base(), routineContent: many }).success, false)
  })
})

describe("enrutador de intención (LLM simulado)", () => {
  it("replace_with_alternative: la IA solo ve las herramientas de esa intención y recibe el avoid", async () => {
    const seen = seenOf()
    const result = await tweakRoutineWithAI(base({ message: "no tengo paralelas, sustitúyelo por algo más" }), "u", log, mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], avoid: ["paralelas"] }),
      agent: [[{ name: "search_exercises", args: { query: "fondos" } }], [{ name: "replace_exercise", args: { itemId: ITEM_DIPS, newExerciseId: NEW_EX } }]],
    }, seen))
    assert.equal(result.status, "done")
    if (result.status !== "done") return
    assert.equal(result.changes.length, 1)
    assert.match(result.message, /Cambió Fondos en paralelas por Prensa de pierna/)
    assert.deepEqual(seen.agent[0]!.tools, ["search_exercises", "propose_new_exercise", "replace_exercise", "propose_edits"])
    const userPrompt = seen.agent[0]!.messages.at(-1) as { content: string }
    assert.match(userPrompt.content, /EVITAR.*paralela/)
    assert.ok(!userPrompt.content.includes(ITEM_SQUAT), "el prompt solo lleva el ítem objetivo")
    // Termina sin pedir un turno extra: replace aplicado -> cierre automático
    assert.equal(seen.agent.length, 2)
  })

  it("el router recibe un índice mínimo (ids y nombres), sin series", async () => {
    const seen = seenOf()
    await tweakRoutineWithAI(base(), "u", log, mockDeps({ route: route({ intent: "out_of_scope", reply: "Solo ajusto esta rutina." }) }, seen))
    const text = (seen.router[0]!.at(-1) as { content: string }).content
    assert.ok(text.includes(ITEM_DIPS) && text.includes("Fondos en paralelas"))
    assert.ok(!text.includes("targetReps") && !text.includes("loadValue"))
  })

  it("out_of_scope responde sin cambios y sin tocar la rutina", async () => {
    const result = await tweakRoutineWithAI(base({ message: "dame una receta" }), "u", log, mockDeps({ route: route({ intent: "out_of_scope", reply: "Solo puedo ayudarte con esta rutina." }) }))
    assert.equal(result.status, "done")
    if (result.status === "done") {
      assert.deepEqual(result.changes, [])
      assert.deepEqual(result.proposedContent, content())
      assert.equal(result.message, "Solo puedo ayudarte con esta rutina.")
    }
  })

  it("ignora ids de objetivo que no existen en la rutina", async () => {
    const result = await tweakRoutineWithAI(base(), "u", log, mockDeps({ route: route({ intent: "replace_with_alternative", targetItemIds: [id(999)] }) }))
    assert.equal(result.status, "needs_info", "sin objetivo válido pregunta")
  })

  it("adjust_difficulty se resuelve sin LLM de ejecución: una sola llamada (el router)", async () => {
    const seen = seenOf()
    const result = await tweakRoutineWithAI(base({ message: "hazla más difícil" }), "u", log, mockDeps({ route: route({ intent: "adjust_difficulty", direction: "up" }) }, seen))
    assert.equal(seen.router.length, 1)
    assert.equal(seen.agent.length, 0)
    assert.equal(result.status, "done")
    if (result.status === "done") {
      assert.ok(result.changes.length > 0 && result.changes.every((c) => c.type === "update_sets"))
      assert.equal(result.proposedContent.items.length, 4)
    }
  })

  it("una pista de la UI salta el clasificador", async () => {
    const seen = seenOf()
    const result = await tweakRoutineWithAI(base({ message: "Hacerla más fácil", intentHint: { intent: "adjust_difficulty", direction: "down" } }), "u", log, mockDeps({}, seen))
    assert.equal(seen.router.length, 0)
    assert.equal(result.status, "done")
    if (result.status === "done") assert.ok(result.changes.length > 0)
  })

  it("una pista incompleta (reemplazo sin objetivo) cae al clasificador", async () => {
    const seen = seenOf()
    await tweakRoutineWithAI(base({ intentHint: { intent: "replace_with_alternative" } }), "u", log, mockDeps({ route: route({ intent: "out_of_scope" }) }, seen))
    assert.equal(seen.router.length, 1)
  })

  it("adjust_rest con segundos exactos", async () => {
    const result = await tweakRoutineWithAI(base({ message: "baja el descanso del press a 90 s" }), "u", log, mockDeps({ route: route({ intent: "adjust_rest", targetItemIds: [ITEM_PRESS], direction: "down", seconds: 90 }) }))
    assert.equal(result.status, "done")
    if (result.status === "done") {
      assert.equal(result.changes.length, 0, "ya estaba en 90 s: nada que cambiar")
      assert.match(result.message, /No encontré descansos/)
    }
    const other = await tweakRoutineWithAI(base({ message: "baja el descanso de la sentadilla a 90 s" }), "u", log, mockDeps({ route: route({ intent: "adjust_rest", targetItemIds: [ITEM_SQUAT], seconds: 90 }) }))
    assert.equal(other.status === "done" && other.changes.length, 1)
  })
})

describe("aclaración (máximo una)", () => {
  it("'sustitúyelo' sin ejercicio identificable pide aclaración con opciones", async () => {
    const result = await tweakRoutineWithAI(base(), "u", log, mockDeps({ route: route({ intent: "clarify", question: "¿Cuál ejercicio quieres sustituir?", options: ["Sentadilla", "Remo"] }) }))
    assert.deepEqual(result, { status: "needs_info", question: "¿Cuál ejercicio quieres sustituir?", options: ["Sentadilla", "Remo"] })
  })

  it("si el router no da objetivo, la pregunta se arma en el servidor con los nombres de los ejercicios", async () => {
    const result = await tweakRoutineWithAI(base(), "u", log, mockDeps({ route: route({ intent: "replace_with_alternative" }) }))
    assert.equal(result.status, "needs_info")
    if (result.status === "needs_info") assert.deepEqual(result.options, ["Sentadilla", "Press banca", "Remo", "Fondos en paralelas"])
  })

  it("con respuesta ya dada el router no puede volver a preguntar (la herramienta ni lo ofrece)", async () => {
    const seen = seenOf()
    const deps = mockDeps({ route: route({ intent: "clarify", question: "¿Y ahora cuál?" }) }, seen)
    const result = await tweakRoutineWithAI(base({ clarification: { question: "¿Cuál?", answer: "Fondos" } }), "u", log, deps)
    // Aunque el modelo insista, el servidor no devuelve otra pregunta
    assert.equal(result.status, "done")
    if (result.status === "done") assert.deepEqual(result.changes, [])
    const routerPrompt = seen.router[0]!.at(-1) as { content: string }
    assert.match(routerPrompt.content, /ACLARACIÓN/)
  })

  it("la ronda de aclaración reenvía el mensaje original + respuesta y ejecuta", async () => {
    const seen = seenOf()
    const result = await tweakRoutineWithAI(base({ clarification: { question: "¿Cuál ejercicio?", answer: "Fondos en paralelas" } }), "u", log, mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS] }),
      agent: [[{ name: "search_exercises", args: {} }], [{ name: "replace_exercise", args: { itemId: ITEM_DIPS, newExerciseId: NEW_EX } }]],
    }, seen))
    assert.equal(result.status, "done")
    const routerPrompt = seen.router[0]!.at(-1) as { content: string }
    assert.ok(routerPrompt.content.includes("sustitúyelo por algo más") && routerPrompt.content.includes("Fondos en paralelas"))
  })

  it("adjust_difficulty sin dirección pregunta; una vez aclarado no pregunta", async () => {
    const first = await tweakRoutineWithAI(base({ message: "ajústala" }), "u", log, mockDeps({ route: route({ intent: "adjust_difficulty" }) }))
    assert.equal(first.status, "needs_info")
    if (first.status === "needs_info") assert.deepEqual(first.options, ["Más difícil", "Más fácil"])
    const second = await tweakRoutineWithAI(base({ message: "ajústala", clarification: { question: "¿Más difícil o más fácil?", answer: "Más fácil" } }), "u", log, mockDeps({ route: route({ intent: "adjust_difficulty" }) }))
    assert.equal(second.status, "done")
  })
})

describe("exclusiones (avoid) en el catálogo", () => {
  it("un ejercicio que contiene el término a evitar no es válido como destino", async () => {
    const seen = seenOf()
    const result = await tweakRoutineWithAI(base({ message: "no tengo paralelas, sustitúyelo" }), "u", log, mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_PRESS], avoid: ["Paralelas"] }),
      agent: [
        [{ name: "search_exercises", args: {} }],
        [{ name: "replace_exercise", args: { itemId: ITEM_PRESS, newExerciseId: BAD_EX } }],
        [{ name: "replace_exercise", args: { itemId: ITEM_PRESS, newExerciseId: NEW_EX } }],
      ],
    }, seen, async (_args, ctx) => {
      ctx.knownIds.add(BAD_EX).add(NEW_EX)
      return [
        { id: BAD_EX, name: "Fondos en paralelas asistidos", equipment: ["Barras paralelas"] },
        { id: NEW_EX, name: "Press con mancuernas", equipment: ["Mancuernas"] },
      ]
    }))
    const searchReply = toolReplies(seen, 1)[0]!
    assert.ok(!searchReply.includes(BAD_EX) && searchReply.includes(NEW_EX))
    assert.match(toolReplies(seen, 2)[1] ?? toolReplies(seen, 2)[0]!, /no salió de search_exercises/)
    assert.equal(result.status === "done" && result.changes.length, 1)
  })
})

describe("avoid: no se evade creando ejercicios ni con pista de la UI (AVD-020, H-02, H-05)", () => {
  const proposeArgs = (name: string) => ({ name, description: "x", difficulty: "beginner", movementPatterns: ["push"] })

  it("propose_new_exercise con un nombre evitado no se crea ni sirve como destino", async () => {
    let proposed = 0
    const deps = mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], avoid: ["paralelas"] }),
      agent: [
        [{ name: "propose_new_exercise", args: proposeArgs("Fondos en paralelas") }],
        [{ name: "replace_exercise", args: { itemId: ITEM_DIPS, newExerciseId: BAD_EX } }],
        [done("listo")],
      ],
    })
    deps.proposeNewExercise = async (_a, ctx) => { proposed++; ctx.knownIds.add(BAD_EX); return { id: BAD_EX, name: "Fondos en paralelas" } }
    const result = await tweakRoutineWithAI(base({ message: "no tengo paralelas: crea un ejercicio nuevo llamado 'Fondos en paralelas' y úsalo" }), "u", log, deps)
    assert.equal(proposed, 0)
    assert.equal(result.status === "done" && result.changes.length, 0)
    assert.equal(result.status === "done" && result.createdExercises.length, 0)
  })

  it("un ejercicio devuelto por la dependencia con nombre evitado se retira de los ids válidos", async () => {
    const deps = mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], avoid: ["paralelas"] }),
      agent: [
        [{ name: "propose_new_exercise", args: proposeArgs("Fondos") }],
        [{ name: "replace_exercise", args: { itemId: ITEM_DIPS, newExerciseId: BAD_EX } }],
        [done("listo")],
      ],
    })
    deps.proposeNewExercise = async (_a, ctx) => { ctx.knownIds.add(BAD_EX); return { id: BAD_EX, name: "Fondos en paralelas" } }
    const result = await tweakRoutineWithAI(base({ message: "no tengo paralelas" }), "u", log, deps)
    assert.equal(result.status === "done" && result.changes.length, 0)
  })

  it("con intentHint también se aplican las exclusiones dichas en el mensaje", async () => {
    let seenAvoid: string[] | undefined
    const deps = mockDeps({ agent: [[{ name: "search_exercises", args: {} }], [done("sin cambios")]] }, seenOf(), async (_a, ctx) => { seenAvoid = ctx.avoid; return [] })
    await tweakRoutineWithAI(base({ message: "no tengo paralelas, cambia los fondos", intentHint: { intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS] } }), "u", log, deps)
    assert.deepEqual(seenAvoid, ["paralela"])
  })
})

describe("guardián dentro del flujo", () => {
  it("edit_basic: un cambio en un ítem que no es objetivo se descarta y el mensaje solo describe lo aplicado", async () => {
    const result = await tweakRoutineWithAI(base({ message: "ponle 4 series de 8 a la sentadilla" }), "u", log, mockDeps({
      route: route({ intent: "edit_basic", targetItemIds: [ITEM_SQUAT] }),
      agent: [[
        { name: "update_sets", args: { itemId: ITEM_SQUAT, sets: Array.from({ length: 4 }, () => ({ setType: "reps", targetReps: 8, loadType: "rpe", loadValue: 7 })) } },
        { name: "update_sets", args: { itemId: ITEM_PRESS, sets: [{ setType: "reps", targetReps: 12 }] } },
      ], [done("Cambié la sentadilla y el press.")]],
    }))
    assert.equal(result.status, "done")
    if (result.status !== "done") return
    assert.equal(result.changes.length, 2 - 1)
    assert.ok(!/press/i.test(result.message), result.message)
    const press = result.proposedContent.items.find((i) => i.id === ITEM_PRESS)
    assert.deepEqual(press, content().items.find((i) => i.id === ITEM_PRESS))
  })

  it("herramientas que no son de la intención se rechazan (reproduce el update_sets x5 de producción)", async () => {
    const seen = seenOf()
    const result = await tweakRoutineWithAI(base({ message: "no tengo paralelas, sustitúyelo por algo más" }), "u", log, mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS], avoid: ["paralelas"] }),
      agent: [
        [{ name: "search_exercises", args: {} }],
        [
          { name: "replace_exercise", args: { itemId: ITEM_DIPS, newExerciseId: NEW_EX } },
          ...[ITEM_SQUAT, ITEM_PRESS, ITEM_ROW].map((itemId) => ({ name: "update_sets", args: { itemId, sets: [{ setType: "reps", targetReps: 5, loadType: "rpe", loadValue: 9 }] } })),
        ],
      ],
    }, seen))
    assert.equal(result.status, "done")
    if (result.status !== "done") return
    assert.deepEqual(result.changes.map((c) => c.type), ["replace_exercise"])
    for (const itemId of [ITEM_SQUAT, ITEM_PRESS, ITEM_ROW]) {
      assert.deepEqual(result.proposedContent.items.find((i) => i.id === itemId), content().items.find((i) => i.id === itemId))
    }
  })

  it("el resultado de las herramientas es compacto: no repite la rutina completa", async () => {
    const seen = seenOf()
    await tweakRoutineWithAI(base({ message: "pon el descanso de la sentadilla en 100 s" }), "u", log, mockDeps({
      route: route({ intent: "edit_basic", targetItemIds: [ITEM_SQUAT] }),
      agent: [[{ name: "update_item_fields", args: { itemId: ITEM_SQUAT, restSeconds: 100 } }]],
    }, seen))
    assert.equal(seen.agent.length, 1, "cierre automático tras aplicar el cambio")
  })

  it("el modelo que no termina lanza error TRPC", async () => {
    const loop = Array.from({ length: 6 }, () => [{ name: "search_exercises", args: {} }])
    await assert.rejects(tweakRoutineWithAI(base(), "u", log, mockDeps({ route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS] }), agent: loop })), /no logró/)
  })

  it("un cambio fallido sin nada aplicado devuelve un mensaje genérico, no el del modelo", async () => {
    const result = await tweakRoutineWithAI(base(), "u", log, mockDeps({
      route: route({ intent: "replace_with_alternative", targetItemIds: [ITEM_DIPS] }),
      agent: [[{ name: "replace_exercise", args: { itemId: ITEM_DIPS, newExerciseId: NEW_EX } }], [done("Listo, lo cambié.")]],
    }))
    assert.equal(result.status === "done" && result.changes.length, 0)
    if (result.status === "done") assert.match(result.message, /No pude aplicar/)
  })

  it("bloquea fixed_kg inventado salvo que el mensaje traiga pesos", async () => {
    const edit = { name: "update_sets", args: { itemId: ITEM_PRESS, sets: [{ setType: "reps", targetReps: 5, loadType: "fixed_kg", loadValue: 100 }] } }
    const blocked = await tweakRoutineWithAI(base({ message: "más peso al press" }), "u", log, mockDeps({ route: route({ intent: "edit_basic", targetItemIds: [ITEM_PRESS] }), agent: [[edit], [done()]] }))
    assert.equal(blocked.status === "done" && blocked.changes.length, 0)
    const allowed = await tweakRoutineWithAI(base({ message: "pon 100 lbs en el press" }), "u", log, mockDeps({ route: route({ intent: "edit_basic", targetItemIds: [ITEM_PRESS] }), agent: [[edit]] }))
    assert.equal(allowed.status === "done" && allowed.changes.length, 1)
  })

  it("no muta la rutina de entrada", async () => {
    const input = base({ message: "hazla más difícil" })
    const snapshot = structuredClone(input.routineContent)
    await tweakRoutineWithAI(input, "u", log, mockDeps({ route: route({ intent: "adjust_difficulty", direction: "up" }) }))
    assert.deepEqual(input.routineContent, snapshot)
  })
})
