// IP real del cliente para los límites de tasa de better-auth (registro dinámico OAuth,
// /oauth2/token, login…). better-auth toma la IP del PRIMER valor de X-Forwarded-For, que lo
// escribe el cliente: rotándolo se evadían los límites, y sin el header no limitaba nada.
//
// La API calcula la IP con `trustProxy` de Fastify (req.ip) y el proxy /api/auth/* de app.ts
// reescribe X-Forwarded-For con ese único valor antes de llamar a better-auth.
//
// TRUST_PROXY (ver docs/deploy.md, "IP del cliente y TRUST_PROXY"):
//   - sin valor: 1 en producción (Railway pone siempre exactamente un proxy, su edge, delante de
//     la API y agrega la IP que vio al final de X-Forwarded-For; ese último valor no lo controla
//     el cliente) y `false` fuera de producción (sin proxy: se usa la IP del socket);
//   - un número N: confía en los N últimos saltos (req.ip = el valor N-ésimo desde el final);
//   - "false"/"0": no confía en X-Forwarded-For (IP del socket);
//   - "true": confía en todo el header (inseguro salvo que la API no sea accesible desde fuera);
//   - una lista de IPs/CIDR separadas por comas: confía solo en esos proxies.
//
// WEB_PROXY_SECRET: el web (Next en Vercel) reenvía /api/auth/* a la API, así que con TRUST_PROXY=1
// req.ip es la IP de salida del web y todos sus usuarios compartirían el límite de login. El
// middleware del web firma esas peticiones con `x-atleta-web-proxy: <WEB_PROXY_SECRET>`; si coincide,
// la API confía en un salto más (la IP que el web puso en X-Forwarded-For). Sin la firma (llamadas
// directas a la API: conectores MCP, app móvil, atacantes) no cambia nada.

import { createHash, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"

/** Header con el que el web firma las peticiones que reenvía a la API. */
export const WEB_PROXY_HEADER = "x-atleta-web-proxy"

export type TrustProxy = boolean | number | string[]

export function trustProxyFrom(value: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): TrustProxy {
  const v = value?.trim().toLowerCase()
  if (!v) return nodeEnv === "production" ? 1 : false
  if (v === "false" || v === "0") return false
  if (v === "true") return true
  if (/^\d+$/.test(v)) return Number(v)
  return v.split(",").map((s) => s.trim()).filter(Boolean)
}

/**
 * Headers para better-auth con X-Forwarded-For reemplazado por la IP del cliente ya resuelta
 * (req.ip). Se quitan además otros headers de IP que el cliente podría escribir y la firma del web.
 */
export function withClientIp(headers: Headers, ip: string): Headers {
  const out = new Headers(headers)
  for (const h of [WEB_PROXY_HEADER, "x-forwarded-for", "x-real-ip", "forwarded", "cf-connecting-ip", "true-client-ip", "x-client-ip"]) out.delete(h)
  if (ip) out.set("x-forwarded-for", ip)
  return out
}

/** ¿El header trae el secreto compartido con el web? Comparación en tiempo constante; sin secreto, nunca. */
export function isWebProxySignature(header: string | string[] | undefined, secret: string | undefined = process.env.WEB_PROXY_SECRET): boolean {
  if (!secret || typeof header !== "string" || !header) return false
  const a = createHash("sha256").update(header).digest()
  const b = createHash("sha256").update(secret).digest()
  return timingSafeEqual(a, b)
}

/**
 * IP del cliente cuando la petición viene firmada por el web: el salto anterior al que ya resolvió
 * trustProxy. `trustedAddrs` es req.ips de Fastify ([socket, …X-Forwarded-For al revés] hasta req.ip,
 * incluida; undefined sin trustProxy, que equivale a solo el socket). Si ese salto no existe o no es
 * una IP válida, se queda `fallback` (req.ip).
 */
export function webProxiedClientIp(opts: {
  xff: string | string[] | undefined
  socketIp: string | undefined
  trustedAddrs: string[] | undefined
  fallback: string
}): string {
  const raw = Array.isArray(opts.xff) ? opts.xff.join(",") : (opts.xff ?? "")
  const hops = raw.split(",").map((s) => s.trim()).filter(Boolean).reverse()
  const all = [opts.socketIp ?? "", ...hops]
  const next = all[opts.trustedAddrs?.length ?? 1]
  return next && isIP(next) ? next : opts.fallback
}
