import { vi } from "vitest"

// Resend lanza en el constructor si no hay API key — mock antes de que auth.ts se importe.
vi.mock("resend", () => {
  const mockSend = vi.fn().mockResolvedValue({ data: { id: "mock-email-id" }, error: null })
  const Resend = vi.fn().mockImplementation(() => ({ emails: { send: mockSend } }))
  return { Resend }
})

// Evitar llamadas reales a la API de Anthropic durante los tests.
// Los tests de integración que invocan procedimientos que disparan reportes de IA
// (sessions.complete, rms.setManual) seguirán funcionando porque el trigger
// es fire-and-forget — el error del mock no afecta el resultado del test.
vi.mock("@anthropic-ai/sdk", () => {
  const mock = vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Progreso simulado en tests." }],
      }),
    },
  }))
  return { default: mock }
})

// Evitar llamadas reales a Cloudflare Stream.
vi.mock("../services/cloudflare-stream", () => ({
  createDirectUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: "http://mock", uid: "mock-uid" }),
  deleteVideo: vi.fn().mockResolvedValue(undefined),
}))
