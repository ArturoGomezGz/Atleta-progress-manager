"use client"

// Conectar IA (flag `mcp`): URL del conector MCP, instrucciones por cliente, tokens personales y
// apps conectadas. Ver docs/mcp.md.

import { useFeatures } from "@/lib/features"
import { trpc } from "@/lib/trpc/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { BackToSettings, Group } from "../settings-ui"
import { CodeBlock } from "./code-block"
import { ConnectedApps } from "./connected-apps"
import { ConnectionGuide } from "./connection-guide"
import { PersonalTokens } from "./personal-tokens"

function ConnectAiContent() {
  const { data: info } = trpc.mcp.connectionInfo.useQuery(undefined, { staleTime: Infinity })

  return (
    <>
      <Group title="URL del conector" description="Pégala en tu asistente de IA para que pueda usar tus datos de Atleta.">
        <div className="p-4">{info ? <CodeBlock code={info.mcpUrl} label="Copiar URL" /> : <p className="text-sm text-muted-foreground">Cargando…</p>}</div>
      </Group>

      <Group title="Cómo conectar">{info && <ConnectionGuide mcpUrl={info.mcpUrl} />}</Group>

      <Group title="Apps conectadas" description="Apps a las que diste permiso iniciando sesión en Atleta.">
        <ConnectedApps />
      </Group>

      <Group
        title="Tokens personales"
        description="Para clientes que no inician sesión por su cuenta (Claude Code con --header, mcp-remote o scripts)."
      >
        <PersonalTokens />
      </Group>
    </>
  )
}

export default function ConnectAiPage() {
  const router = useRouter()
  const { isLoading, has } = useFeatures()
  const allowed = has("mcp")

  useEffect(() => {
    if (!isLoading && !allowed) router.replace("/settings")
  }, [isLoading, allowed, router])

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <BackToSettings />
        <h1 className="text-2xl font-bold text-foreground">Conectar IA</h1>
        <p className="text-sm text-muted-foreground">
          Conecta Atleta con Claude, ChatGPT u otro asistente compatible con MCP para crear entrenamientos, asignarlos y
          planificar con lenguaje natural. El asistente usa tus mismos permisos.
        </p>
      </div>
      {allowed && <ConnectAiContent />}
    </div>
  )
}
