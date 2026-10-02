// Registro central de feature flags por usuario.
// Cada clave se activa con una allowlist en variables de entorno (sin migraciones):
//   FEATURE_<CLAVE>_USERS=correo@x.com,<user-id>,*   (el `*` la activa para todos)
//   FEATURE_ALL_USERS=correo@x.com                   (activa todas las claves)
// Sin variable, la función queda apagada. Ver docs/feature-flags.md.

import { TRPCError } from "@trpc/server"

export const FEATURES = ["evaluation", "progress", "ai_generator", "team_appearance", "share_links", "scheduled_sessions", "groups"] as const
export type FeatureKey = (typeof FEATURES)[number]

// Una función que depende de otra solo se activa si la otra también lo está
const REQUIRES: Partial<Record<FeatureKey, FeatureKey[]>> = {
  progress: ["evaluation"],
}

type FeatureUser = { id: string; email: string }

function parseList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  )
}

function inAllowlist(user: FeatureUser, value: string | undefined): boolean {
  const list = parseList(value)
  return list.has("*") || list.has(user.id.toLowerCase()) || list.has(user.email.toLowerCase())
}

export function hasFeature(user: FeatureUser, key: FeatureKey): boolean {
  const enabled =
    inAllowlist(user, process.env.FEATURE_ALL_USERS) ||
    inAllowlist(user, process.env[`FEATURE_${key.toUpperCase()}_USERS`])
  if (!enabled) return false
  return (REQUIRES[key] ?? []).every((dep) => hasFeature(user, dep))
}

export function activeFeatures(user: FeatureUser): FeatureKey[] {
  return FEATURES.filter((key) => hasFeature(user, key))
}

export function assertFeature(user: FeatureUser, key: FeatureKey) {
  if (!hasFeature(user, key)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta función aún no está disponible para tu cuenta" })
  }
}
