import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export type RmEntry = { rmLbs: string; recordedAt: Date | string; source: "auto" | "manual" }

export async function generateExerciseProgressReport(input: {
  exerciseName: string
  current: RmEntry
  history: RmEntry[]
}): Promise<string> {
  const { exerciseName, current, history } = input
  const previousEntry = history.length >= 2 ? history[history.length - 2] : null
  const pctChange = previousEntry
    ? (((Number(current.rmLbs) - Number(previousEntry.rmLbs)) / Number(previousEntry.rmLbs)) * 100).toFixed(1)
    : null

  const historyLines = history
    .map((h) => {
      const date = new Date(h.recordedAt).toLocaleDateString("es", { dateStyle: "medium" })
      return `  - ${date}: ${h.rmLbs} lbs (${h.source === "auto" ? "automático" : "manual"})`
    })
    .join("\n")

  const prompt = `Eres un asistente de entrenamiento deportivo. En 2 oraciones cortas en español y sin formato markdown, resume el progreso del atleta en "${exerciseName}": menciona el PR actual, ${pctChange ? `el cambio de ${pctChange}% respecto al registro anterior` : "que es el primer registro"}, y termina con una frase de aliento o advertencia según la tendencia.

Historial:
${historyLines}

PR actual: ${current.rmLbs} lbs (${new Date(current.recordedAt).toLocaleDateString("es", { dateStyle: "long" })})`

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== "text") throw new Error("Unexpected response from Anthropic")
  return block.text.trim()
}
