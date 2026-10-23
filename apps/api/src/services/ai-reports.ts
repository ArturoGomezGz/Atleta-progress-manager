import { GoogleGenerativeAI } from "@google/generative-ai"

// Se crea bajo demanda para que la API arranque aunque GEMINI_API_KEY no esté configurada
let genai: GoogleGenerativeAI | null = null
function getGenai() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no configurada")
  genai ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genai
}

export type RmEntry = { rmLbs: string; recordedAt: Date | string; source: "auto" | "manual" }

type ProgressReportInput = {
  exerciseName: string
  current: RmEntry
  history: RmEntry[]
}

// Función pura: arma el prompt sin llamar a Gemini
export function buildProgressPrompt(input: ProgressReportInput): string {
  const { exerciseName, current, history } = input
  const previousEntry = history.length >= 2 ? history[history.length - 2] : null
  let pctChange: string | null = null
  if (previousEntry) {
    const prev = Number(previousEntry.rmLbs)
    const ratio = ((Number(current.rmLbs) - prev) / prev) * 100
    if (prev > 0 && Number.isFinite(ratio)) pctChange = ratio.toFixed(1)
  }
  const changePhrase = pctChange
    ? `el cambio de ${pctChange}% respecto al registro anterior`
    : previousEntry
      ? "sin porcentaje de cambio respecto al registro anterior"
      : "que es el primer registro"

  const historyLines = history
    .map((h) => {
      const date = new Date(h.recordedAt).toLocaleDateString("es", { dateStyle: "medium" })
      return `  - ${date}: ${h.rmLbs} lbs (${h.source === "auto" ? "automático" : "manual"})`
    })
    .join("\n")

  return `Eres un entrenador deportivo. En 3 oraciones en español y sin formato markdown, analiza el progreso del atleta en "${exerciseName}": menciona el PR actual, ${changePhrase}, y cierra siempre con un mensaje motivacional breve que anime a seguir mejorando y a mantener la técnica.

Historial:
${historyLines}

PR actual: ${current.rmLbs} lbs (${new Date(current.recordedAt).toLocaleDateString("es", { dateStyle: "long" })})`
}

export async function generateExerciseProgressReport(input: ProgressReportInput): Promise<string> {
  const prompt = buildProgressPrompt(input)

  const model = getGenai().getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } } as any,
  })

  const text = result.response.text().trim()
  // Lanzar evita que report-trigger sobrescriba un reporte previo válido con uno vacío
  if (!text) throw new Error("Gemini devolvió un reporte vacío")
  return text
}
