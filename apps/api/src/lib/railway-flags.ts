// Fuente principal de los feature flags: Railway Feature Flags (SDK `railway`).
// Si no está configurada o falla, `readRailwayFlag` devuelve undefined y `hasFeature`
// usa las allowlists de entorno. Ver docs/feature-flags.md.

import { flags } from "railway"

type FlagUser = { id: string; email: string }
export type FlagContext = { key: string; email: string; env: string }
export type RailwayFlagReader = (name: string, ctx: FlagContext) => boolean | undefined

let ready = false

export async function initRailwayFlags(): Promise<void> {
  if (!process.env.RAILWAY_TOKEN && !process.env.RAILWAY_API_TOKEN) {
    console.log("Railway Feature Flags: sin RAILWAY_TOKEN, se usan las allowlists de entorno")
    return
  }
  try {
    // timeoutMs acota la primera sincronización: el arranque nunca se queda esperando a Railway
    await flags.init({ timeoutMs: 5000 })
    ready = flags.synced
    console.log(
      ready
        ? `Railway Feature Flags: sincronizados (${flags.list().length} flags)`
        : "Railway Feature Flags: sin sincronizar, se usan las allowlists de entorno",
    )
  } catch (err) {
    ready = false
    console.error("Railway Feature Flags: no se pudo iniciar, se usan las allowlists de entorno:", (err as Error)?.message)
  }
}

// Lectura síncrona. undefined = "usa el respaldo" (no configurado, sin sincronizar, flag inexistente o cualquier error)
function defaultReader(name: string, ctx: FlagContext): boolean | undefined {
  if (!ready) return undefined
  try {
    if (!flags.synced || !flags.has(name)) return undefined
    const res = flags.evaluateBoolean(name, ctx, false)
    if (res.reason === "NOT_FOUND" || res.reason === "TYPE_MISMATCH" || res.reason === "NO_KEY") return undefined
    return res.value
  } catch {
    return undefined
  }
}

let reader: RailwayFlagReader = defaultReader

export function readRailwayFlag(key: string, user: FlagUser): boolean | undefined {
  try {
    // `key` es la identidad de bucketing (% de rollout); `env` permite apuntar reglas a un ambiente (los flags son del proyecto entero)
    return reader(key, { key: user.id, email: user.email.toLowerCase(), env: process.env.RAILWAY_ENVIRONMENT_NAME ?? "local" })
  } catch {
    return undefined
  }
}

// Solo para pruebas: inyecta un lector falso (sin argumento restaura el real)
export function setRailwayFlagReader(fn?: RailwayFlagReader) {
  reader = fn ?? defaultReader
}
