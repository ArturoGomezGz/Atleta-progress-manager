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

  const prompt = `Eres un asistente de entrenamiento deportivo. Analiza el progreso del atleta en el ejercicio "${exerciseName}" y escribe un mini-reporte en español (2-4 oraciones, entre 150 y 250 palabras).

Debe cubrir:
1. Estado actual del PR.
2. Cambio porcentual respecto a la medición anterior${pctChange ? ` (${pctChange}%)` : " (primer registro)"}.
3. Tendencia general del historial.
4. Frase de aliento si progresa bien, o advertencia constructiva si hay estancamiento o retroceso.

Historial:
${historyLines}

PR actual: ${current.rmLbs} lbs (${new Date(current.recordedAt).toLocaleDateString("es", { dateStyle: "long" })})

Escribe solo el reporte, sin encabezados ni listas.`

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== "text") throw new Error("Unexpected response from Anthropic")
  return block.text.trim()
}
