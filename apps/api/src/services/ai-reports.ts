import { GoogleGenerativeAI } from "@google/generative-ai"

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } },
  })

  return result.response.text().trim()
}
