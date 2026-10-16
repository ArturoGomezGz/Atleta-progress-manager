import { TRPCError } from "@trpc/server"
import { createRateLimiter, type RateLimiter } from "./rate-limit"

// Límite por cliente (IP) para los endpoints públicos de enlaces compartidos
// (`share.preview` y `share.start`): frena que se usen como oráculo para adivinar
// códigos y como vector barato de carga contra la base de datos.
// Comparte cubeta entre ambos endpoints (en memoria, por proceso).
export const SHARE_RATE_MAX = 30
export const SHARE_RATE_WINDOW_MS = 60 * 1000

export const shareRateLimiter = createRateLimiter({ max: SHARE_RATE_MAX, windowMs: SHARE_RATE_WINDOW_MS })

export function shareRateKey(ip: string): string {
  return `share:${ip}`
}

/** Registra un intento del cliente; lanza TOO_MANY_REQUESTS si superó el límite. */
export function assertShareRate(ip: string, limiter: RateLimiter = shareRateLimiter, now?: number): void {
  const limit = limiter.hit(shareRateKey(ip), now)
  if (!limit.ok) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Demasiados intentos seguidos. Intenta de nuevo en ${limit.retryAfterSeconds} s.`,
    })
  }
}
