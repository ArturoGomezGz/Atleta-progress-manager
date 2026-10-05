// Limitador de ventana deslizante en memoria (por proceso). Suficiente para frenar abuso
// de endpoints costosos (p. ej. IA) con una sola instancia de la API; si se escala a varias
// instancias, cada una lleva su propia cuenta.

export type RateLimiter = {
  /** Registra un intento. Devuelve ok=false (y los segundos a esperar) si se superó el límite. */
  hit(key: string, now?: number): { ok: true } | { ok: false; retryAfterSeconds: number }
}

export function createRateLimiter(opts: { max: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const hits = new Map<string, number[]>()
  const maxKeys = opts.maxKeys ?? 5000

  return {
    hit(key, now = Date.now()) {
      const cutoff = now - opts.windowMs
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff)

      if (recent.length >= opts.max) {
        hits.set(key, recent)
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + opts.windowMs - now) / 1000)) }
      }

      recent.push(now)
      hits.delete(key) // reinsertar para mantener el orden de uso (LRU simple)
      hits.set(key, recent)

      if (hits.size > maxKeys) {
        for (const [k, times] of hits) {
          if (!times.some((t) => t > cutoff)) hits.delete(k)
          if (hits.size <= maxKeys) break
        }
        // Si siguen siendo demasiadas, descarta las más antiguas
        for (const k of hits.keys()) {
          if (hits.size <= maxKeys) break
          hits.delete(k)
        }
      }
      return { ok: true }
    },
  }
}
