import { GoogleGenerativeAI } from "@google/generative-ai"

// Se crea bajo demanda para que la API arranque aunque GEMINI_API_KEY no esté configurada
let genai: GoogleGenerativeAI | null = null
function getGenai() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no configurada")
  genai ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genai
}

export type RmEntry = { rmLbs: string; recordedAt: Date | string; source: "auto" | "manual" }

// Devuelve null (tratado como "primer registro") si no hay RM previo, si es <= 0 o si el resultado no es finito
export function computePctChange(currentRmLbs: string, previousRmLbs: string | null | undefined): string | null {
  if (previousRmLbs == null) return null
  const previous = Number(previousRmLbs)
  if (!(previous > 0)) return null
  const pct = ((Number(currentRmLbs) - previous) / previous) * 100
  return Number.isFinite(pct) ? pct.toFixed(1) : null
}

export async function generateExerciseProgressReport(input: {
  exerciseName: string
  current: RmEntry
  history: RmEntry[]
}): Promise<string> {
  const { exerciseName, current, history } = input
  const previousEntry = history.length >= 2 ? history[history.length - 2] : null
  const pctChange = computePctChange(current.rmLbs, previousEntry?.rmLbs)

  const historyLines = history
    .map((h) => {
      const date = new Date(h.recordedAt).toLocaleDateString("es", { dateStyle: "medium" })
      return `  - ${date}: ${h.rmLbs} lbs (${h.source === "auto" ? "automático" : "manual"})`
    })
    .join("\n")

  const prompt = `Eres un entrenador deportivo. En 3 oraciones en español y sin formato markdown, analiza el progreso del atleta en "${exerciseName}": menciona el PR actual, ${pctChange ? `el cambio de ${pctChange}% respecto al registro anterior` : "que es el primer registro"}, y cierra siempre con un mensaje motivacional breve que anime a seguir mejorando y a mantener la técnica.

Historial:
${historyLines}

PR actual: ${current.rmLbs} lbs (${new Date(current.recordedAt).toLocaleDateString("es", { dateStyle: "long" })})`

  const model = getGenai().getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } } as any,
  })

  return result.response.text().trim()
}
