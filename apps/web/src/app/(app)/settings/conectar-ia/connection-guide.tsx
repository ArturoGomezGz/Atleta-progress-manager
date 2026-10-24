"use client"

// Instrucciones de conexión por cliente (las mismas que docs/mcp.md, "Conexión"). Los menús de
// cada app pueden cambiar de nombre: si cambian, actualizar aquí y en el doc.

import { cn } from "@/lib/utils"
import { useState } from "react"
import { CodeBlock } from "./code-block"

const CLIENTS = [
  { id: "claude", label: "Claude" },
  { id: "claude-code", label: "Claude Code" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "otros", label: "Otros" },
] as const

type ClientId = (typeof CLIENTS)[number]["id"]

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-1.5 text-sm text-foreground marker:text-muted-foreground">{children}</ol>
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

export function ConnectionGuide({ mcpUrl }: { mcpUrl: string }) {
  const [client, setClient] = useState<ClientId>("claude")

  const mcpRemote = JSON.stringify({ mcpServers: { atleta: { command: "npx", args: ["-y", "mcp-remote", mcpUrl] } } }, null, 2)
  const mcpRemoteToken = JSON.stringify(
    {
      mcpServers: {
        atleta: {
          command: "npx",
          args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:${ATLETA_AUTH}"],
          env: { ATLETA_AUTH: "Bearer atl_pat_…" },
        },
      },
    },
    null,
    2,
  )

  return (
    <div className="p-4 space-y-4">
      <div role="tablist" aria-label="Cliente de IA" className="inline-flex flex-wrap gap-0.5 p-0.5 rounded-lg border border-border bg-background">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={client === c.id}
            onClick={() => setClient(c.id)}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer",
              client === c.id ? "bg-card text-foreground font-medium ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-3">
        {client === "claude" && (
          <>
            <p className="text-sm text-muted-foreground">Claude.ai y la app de escritorio de Claude (comparten los conectores).</p>
            <Steps>
              <li>Abre Configuración → Conectores → Agregar conector personalizado.</li>
              <li>Escribe «Atleta» como nombre y pega la URL del conector.</li>
              <li>Pulsa Conectar: se abre Atleta para que inicies sesión y revises los permisos.</li>
              <li>En un chat, activa Atleta desde el menú de herramientas y pídele, por ejemplo, «arma un entrenamiento de fuerza de 45 minutos».</li>
            </Steps>
          </>
        )}

        {client === "claude-code" && (
          <>
            <p className="text-sm text-muted-foreground">En la terminal, agrega el conector:</p>
            <CodeBlock code={`claude mcp add --transport http atleta ${mcpUrl}`} label="Copiar comando" />
            <Note>Después, dentro de Claude Code, ejecuta /mcp y elige «atleta» para iniciar sesión en el navegador.</Note>
            <p className="text-sm text-muted-foreground">O, sin navegador, con un token personal (créalo abajo):</p>
            <CodeBlock
              code={`claude mcp add --transport http atleta ${mcpUrl} --header "Authorization: Bearer atl_pat_…"`}
              label="Copiar comando con token"
            />
          </>
        )}

        {client === "chatgpt" && (
          <>
            <Steps>
              <li>En ChatGPT abre Configuración → Aplicaciones y conectores → Configuración avanzada y activa el modo desarrollador.</li>
              <li>Vuelve a Aplicaciones y conectores y pulsa Crear.</li>
              <li>Pega la URL del conector, elige OAuth como autenticación y guarda.</li>
              <li>Inicia sesión en Atleta cuando se abra la ventana y revisa los permisos.</li>
            </Steps>
            <Note>El modo desarrollador depende de tu plan de ChatGPT.</Note>
          </>
        )}

        {client === "otros" && (
          <>
            <p className="text-sm text-muted-foreground">
              Cualquier cliente MCP con transporte HTTP («Streamable HTTP») acepta la URL del conector y el inicio de sesión
              con OAuth. Si tu cliente solo ejecuta servidores locales, usa mcp-remote:
            </p>
            <CodeBlock code={mcpRemote} label="Copiar configuración" />
            <p className="text-sm text-muted-foreground">Con un token personal en lugar del inicio de sesión:</p>
            <CodeBlock code={mcpRemoteToken} label="Copiar configuración con token" />
            <Note>Reemplaza atl_pat_… por tu token. No lo compartas ni lo subas a un repositorio.</Note>
          </>
        )}
      </div>
    </div>
  )
}
