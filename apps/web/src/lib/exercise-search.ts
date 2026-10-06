// Búsqueda de ejercicios en el cliente (la lista completa ya está en memoria).
// Tolera mayúsculas, tildes, guiones y espacios ("pull-up" = "pull up" = "pullup"), plurales,
// errores de tecleo y términos en español (los nombres del catálogo están en inglés), y ordena
// por relevancia: lo que coincide con el nombre pesa mucho más que una palabra suelta en la descripción.

export type SearchDoc = {
  name: string
  /** Patrón, nivel, equipo, músculos, zona…: pesan menos que el nombre */
  keywords: string[]
  description: string
}

export type SearchEntry = {
  nameText: string
  nameCompact: string
  nameList: string[]
  nameForms: Set<string>
  kwText: string
  kwList: string[]
  kwForms: Set<string>
  descList: string[]
  descForms: Set<string>
}

type QueryToken = {
  /** Escrito por la persona, con sus variantes singulares */
  forms: string[]
  raw: string
  /** Equivalentes en inglés ("dominada" → "pull up") */
  phrases: string[]
  /** El token es (el inicio de) una palabra con sinónimos: solo cuenta como palabra completa */
  exactOnly: boolean
}

export type ParsedQuery = { text: string; compact: string; tokens: QueryToken[] }

// Términos en español → cómo aparecen en los nombres del catálogo (en inglés). Claves en singular.
const SEARCH_SYNONYMS: Record<string, string[]> = {
  flexion: ["push up", "pushup"],
  lagartija: ["push up", "pushup"],
  dominada: ["pull up", "pullup", "chin up"],
  fondo: ["dip"],
  sentadilla: ["squat", "pistol"],
  zancada: ["lunge"],
  estocada: ["lunge"],
  plancha: ["plank", "planche"],
  puente: ["bridge"],
  remo: ["row"],
  pino: ["handstand"],
  vertical: ["handstand"],
  elevacion: ["raise"],
  colgado: ["hang"],
  banca: ["bench"],
  muerto: ["deadlift"],
  tiron: ["pull"],
  empuje: ["push"],
  pecho: ["chest"],
  espalda: ["back", "lat"],
  hombro: ["shoulder"],
  pierna: ["leg"],
  gluteo: ["glute"],
  abdominal: ["crunch", "sit up", "ab wheel"],
  cuadriceps: ["quad", "squat"],
  isquiotibial: ["hamstring"],
  pantorrilla: ["calf"],
  gemelo: ["calf"],
  antebrazo: ["forearm"],
  brazo: ["arm"],
  cadera: ["hip"],
  cuerda: ["rope"],
  salto: ["jump"],
  saltar: ["jump"],
  mancuerna: ["dumbbell"],
  barra: ["bar", "barbell"],
  anilla: ["ring"],
  paralela: ["parallel"],
  banda: ["band"],
  liga: ["band"],
  polea: ["cable"],
  silla: ["chair"],
  pared: ["wall"],
  escapula: ["scapula"],
  tijera: ["scissor"],
  gateo: ["crawl"],
  arrastre: ["crawl"],
  balanceo: ["swing"],
  giro: ["twist", "rotation"],
  estiramiento: ["stretch"],
  caminata: ["walk"],
  oso: ["bear"],
  cangrejo: ["crab"],
  rana: ["frog"],
  escalador: ["climber"],
  lumbar: ["back extension", "hyperextension", "good morning"],
  agarre: ["grip"],
  bulgara: ["bulgarian"],
  pesa: ["kettlebell"],
  inclinada: ["incline"],
  declinada: ["decline"],
  bicicleta: ["bicycle"],
  pajaro: ["bird"],
}

// ── Texto ─────────────────────────────────────────────────────────────────────

export function normalizeText(s: string) {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** La palabra y sus formas singulares: "lunges" → lunges, lunge, lung; "dips" → dips, dip. */
function forms(w: string): string[] {
  const out = [w]
  if (w.length >= 3 && w.endsWith("s") && !w.endsWith("ss")) out.push(w.slice(0, -1))
  if (w.length > 4 && w.endsWith("es")) out.push(w.slice(0, -2))
  if (w.length > 4 && w.endsWith("ies")) out.push(`${w.slice(0, -3)}y`)
  return out
}

/** Palabras del texto más las pegadas de dos en dos ("push up" → "pushup"), para encontrar "pushup" o "lsit". */
function wordsWithJoins(words: string[]) {
  const list = [...words]
  for (let i = 0; i < words.length - 1; i++) list.push(words[i] + words[i + 1])
  return list
}

function formSet(list: string[]) {
  const set = new Set<string>()
  for (const w of list) for (const f of forms(w)) set.add(f)
  return set
}

/** Distancia de edición con transposición (Damerau, restringida). */
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    prev2.splice(0, prev2.length, ...prev)
    prev = cur
  }
  return prev[b.length]
}

const maxTypos = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0)

// ── Índice ────────────────────────────────────────────────────────────────────

export function buildSearchEntry(doc: SearchDoc): SearchEntry {
  const nameText = normalizeText(doc.name)
  const nameList = wordsWithJoins(nameText.split(" ").filter(Boolean))
  const kwText = normalizeText(doc.keywords.join(" "))
  const kwList = wordsWithJoins(kwText.split(" ").filter(Boolean))
  const descList = normalizeText(doc.description).split(" ").filter(Boolean)
  return {
    nameText,
    nameCompact: nameText.replace(/ /g, ""),
    nameList,
    nameForms: formSet(nameList),
    kwText,
    kwList,
    kwForms: formSet(kwList),
    descList,
    descForms: formSet(descList),
  }
}

// ── Consulta ──────────────────────────────────────────────────────────────────

export function parseQuery(query: string): ParsedQuery | null {
  const text = normalizeText(query)
  if (!text) return null
  const tokens = text.split(" ").map((raw): QueryToken => {
    const tokenForms = forms(raw)
    const keys = Object.keys(SEARCH_SYNONYMS).filter((key) =>
      (raw.length >= 3 && key.startsWith(raw)) ||
      tokenForms.includes(key) ||
      (raw.length >= 6 && editDistance(raw, key, 1) <= 1),
    )
    return {
      raw,
      forms: tokenForms,
      phrases: [...new Set(keys.flatMap((key) => SEARCH_SYNONYMS[key]))],
      exactOnly: keys.length > 0,
    }
  })
  return { text, compact: tokens.map((t) => t.raw).join(""), tokens }
}

// ── Puntaje ───────────────────────────────────────────────────────────────────

function fieldScore(
  token: QueryToken,
  list: string[],
  formsOfField: Set<string>,
  w: { exact: number; prefix: number; substring: number; fuzzy: number },
) {
  if (token.forms.some((f) => formsOfField.has(f))) return w.exact
  if (token.exactOnly) return 0
  const t = token.raw
  let best = 0
  for (const word of list) {
    if (word.startsWith(t)) return w.prefix
    if (best < w.substring && t.length >= 4 && word.includes(t)) best = w.substring
    if (best < w.fuzzy && t.length >= 4) {
      const max = maxTypos(t.length)
      // También contra el inicio de la palabra: "pushap" mientras se escribe "pushups"
      if (editDistance(t, word, max) <= max || editDistance(t, word.slice(0, t.length), max) <= max) best = w.fuzzy
    }
  }
  return best
}

const NAME_W = { exact: 100, prefix: 70, substring: 40, fuzzy: 45 }
const KEYWORD_W = { exact: 30, prefix: 20, substring: 10, fuzzy: 15 }

function tokenScore(entry: SearchEntry, token: QueryToken) {
  // "flexion" escrito en español busca push ups; "Hip Flexion" coincide, pero debe ir detrás
  let best = fieldScore(token, entry.nameList, entry.nameForms, token.exactOnly ? { ...NAME_W, exact: 60 } : NAME_W)
  if (best < 100) {
    for (const phrase of token.phrases) {
      const hit = entry.nameText.includes(phrase) || entry.nameCompact.includes(phrase.replace(/ /g, ""))
      if (hit) best = Math.max(best, 85)
      else if (entry.kwText.includes(phrase)) best = Math.max(best, 25)
    }
  }
  if (best < 30) best = Math.max(best, fieldScore(token, entry.kwList, entry.kwForms, KEYWORD_W))
  if (best === 0) {
    // La descripción solo desempata y completa: palabra entera o inicio de palabra
    if (token.forms.some((f) => entry.descForms.has(f))) best = 8
    else if (!token.exactOnly && token.raw.length >= 3 && entry.descList.some((word) => word.startsWith(token.raw))) best = 5
  }
  return best
}

/** 0 = no coincide; mayor = más relevante. Todas las palabras escritas deben coincidir (AND). */
export function scoreEntry(entry: SearchEntry, query: ParsedQuery) {
  let total = 0
  for (const token of query.tokens) {
    const s = tokenScore(entry, token)
    if (s === 0) return 0
    total += s
  }
  if (entry.nameText === query.text || entry.nameCompact === query.compact) total += 300
  else if (entry.nameText.startsWith(query.text) || entry.nameCompact.startsWith(query.compact)) total += 100
  else if (entry.nameCompact.includes(query.compact)) total += 40
  // A igualdad, el nombre más corto (más general) primero
  return total - entry.nameText.length * 0.1
}
