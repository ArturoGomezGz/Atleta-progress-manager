// Tokens personales (PAT) del conector MCP: `atl_pat_<base64url de 30 bytes>`.
// El token completo solo se muestra al crearlo; en la BD queda su SHA-256 (hex) y un
// prefijo de 12 caracteres para reconocerlo en la lista. Ver docs/mcp.md ("Autenticación").

import { createHash, randomBytes } from "node:crypto"

export const PAT_PREFIX = "atl_pat_"
/** Caracteres que se guardan para mostrar (`atl_pat_` + 4). */
export const PAT_DISPLAY_PREFIX_LENGTH = 12
/** Vigencias que se pueden elegir (días); null = no expira. */
export const PAT_EXPIRY_DAYS = [30, 90, 365] as const
export type PatExpiryDays = (typeof PAT_EXPIRY_DAYS)[number] | null
export const PAT_DEFAULT_EXPIRY_DAYS: PatExpiryDays = 90
/** Máximo de tokens activos (no revocados ni vencidos) por usuario. */
export const MAX_ACTIVE_PATS = 10
/** `last_used_at` se actualiza como mucho cada 5 minutos. */
export const PAT_TOUCH_INTERVAL_MS = 5 * 60_000

const DAY_MS = 24 * 60 * 60_000

export function hashPersonalToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function isPersonalToken(token: string): boolean {
  return token.startsWith(PAT_PREFIX)
}

/** Token nuevo + lo que se guarda (hash y prefijo). El token no se persiste. */
export function generatePersonalToken(): { token: string; hash: string; prefix: string } {
  const token = `${PAT_PREFIX}${randomBytes(30).toString("base64url")}`
  return { token, hash: hashPersonalToken(token), prefix: token.slice(0, PAT_DISPLAY_PREFIX_LENGTH) }
}

export function patExpiresAt(days: PatExpiryDays, now: Date = new Date()): Date | null {
  return days === null ? null : new Date(now.getTime() + days * DAY_MS)
}

/** ¿Toca actualizar last_used_at? */
export function shouldTouchPat(lastUsedAt: Date | null, now: Date): boolean {
  return !lastUsedAt || now.getTime() - lastUsedAt.getTime() >= PAT_TOUCH_INTERVAL_MS
}
