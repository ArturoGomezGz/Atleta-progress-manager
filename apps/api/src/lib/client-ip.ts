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
 * (req.ip). Se quitan además otros headers de IP que el cliente podría escribir.
 */
export function withClientIp(headers: Headers, ip: string): Headers {
  const out = new Headers(headers)
  for (const h of ["x-forwarded-for", "x-real-ip", "forwarded", "cf-connecting-ip", "true-client-ip", "x-client-ip"]) out.delete(h)
  if (ip) out.set("x-forwarded-for", ip)
  return out
}
