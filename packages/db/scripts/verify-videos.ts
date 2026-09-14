/**
 * Verifica que cada video del catálogo de ejercicios exista en YouTube y se pueda embeber.
 * Usa el endpoint público oEmbed (sin API key): 200 = OK, 401 = embed deshabilitado, 400/404 = no existe.
 *
 * Uso: pnpm --filter @atleta/db verify-videos
 */
import { loadCatalog, validateCatalog } from "./build-sql"

const CONCURRENCY = 8

async function check(id: string): Promise<{ status: number; title?: string; author?: string }> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status !== 200) return { status: res.status }
      const body = (await res.json()) as { title: string; author_name: string }
      return { status: 200, title: body.title, author: body.author_name }
    } catch (err) {
      if (attempt >= 2) throw err
    }
  }
}

async function main() {
  const catalog = loadCatalog()
  validateCatalog(catalog)

  const failures: string[] = []
  const warnings: string[] = []
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < catalog.length) {
      const ex = catalog[next++]
      const r = await check(ex.youtube_id)
      if (r.status !== 200) {
        failures.push(`${ex.name} (${ex.youtube_id}): HTTP ${r.status}${r.status === 401 ? " — embed deshabilitado" : ""}`)
      } else if (r.author !== ex.channel) {
        warnings.push(`${ex.name} (${ex.youtube_id}): canal "${r.author}", el dataset dice "${ex.channel}"`)
      }
    }
  }))

  for (const w of warnings) console.warn(`⚠️  ${w}`)
  for (const f of failures) console.error(`❌ ${f}`)
  console.log(`${catalog.length - failures.length}/${catalog.length} videos verificados`)
  if (failures.length) process.exit(1)
}

main()
