#!/usr/bin/env node
// Levanta el entorno mock completo: API real sobre PGlite en memoria (apps/api/src/mock)
// + web de Next.js apuntando a ella. Sin Docker, sin PostgreSQL, sin variables de entorno.
//
//   node scripts/mock/run.mjs dev     → next dev   (pnpm dev:mock)
//   node scripts/mock/run.mjs start   → next start (contenedor Dockerfile.mock; requiere `next build` previo)
//
// La web es la única cara pública: proxea /trpc y /api/auth a la API (next.config.ts),
// así que en un despliegue basta con exponer el puerto de la web.

import { spawn } from "node:child_process"

const isWindows = process.platform === "win32"
const mode = process.argv[2] === "start" ? "start" : "dev"
const webPort = process.env.PORT ?? "3000"
const apiPort = process.env.MOCK_API_PORT ?? "3001"
const publicUrl =
  process.env.PUBLIC_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${webPort}`)

const children = []

function run(name, args, env) {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: isWindows,
    // Grupo de procesos propio: pnpm no reenvía la señal a tsx/next, así que al
    // cerrar se mata el grupo entero para no dejar puertos ocupados
    detached: !isWindows,
  })
  child.on("exit", (code) => {
    console.log(`[mock] ${name} terminó (código ${code}); cerrando el resto`)
    shutdown(code ?? 1)
  })
  children.push(child)
}

let closing = false
function shutdown(code = 0) {
  if (closing) return
  closing = true
  for (const c of children) {
    if (c.exitCode !== null) continue
    try {
      if (isWindows) spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"])
      else process.kill(-c.pid, "SIGTERM")
    } catch {}
  }
  process.exit(code)
}
process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))
process.on("SIGHUP", () => shutdown(0))

run("API mock", ["--filter", "@atleta/api", "mock"], {
  PORT: apiPort,
  // Igual que en producción: la URL de auth es la de la web, que proxea /api/auth
  WEB_URL: publicUrl,
  BETTER_AUTH_URL: publicUrl,
})

run("web", ["--filter", "@atleta/web", mode, ...(mode === "dev" ? ["--port", webPort] : [])], {
  PORT: webPort,
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
})

console.log(`[mock] Web en ${publicUrl} · API mock en :${apiPort}`)
