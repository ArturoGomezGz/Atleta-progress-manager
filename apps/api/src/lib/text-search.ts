// Búsqueda de texto en SQL sin distinguir mayúsculas ni acentos, y sin comodines de LIKE.
// Los LLM (y la gente) escriben "flexión" o "Press_banca": la búsqueda debe tratar el texto
// como texto. No depende de la extensión `unaccent` (puede no estar instalada): quita los
// acentos con translate() de Postgres, con la misma tabla en la columna y en el término,
// igual que normalizeText (services/ai-routine-editor/avoid.ts) en JavaScript.

import { sql, type SQL, type SQLWrapper } from "drizzle-orm"

// Letras acentuadas (minúsculas y mayúsculas: lower() con collation C solo baja ASCII) → sin acento
const ACCENTED = "áàâäãåāéèêëēíìîïīóòôöõōúùûüūñçýÿÁÀÂÄÃÅĀÉÈÊËĒÍÌÎÏĪÓÒÔÖÕŌÚÙÛÜŪÑÇÝŸ"
const PLAIN    = "aaaaaaaeeeeeiiiiioooooouuuuuncyyAAAAAAAEEEEEIIIIIOOOOOOUUUUUNCYY"

/** Igual que la columna normalizada en SQL: sin acentos, en minúsculas y sin espacios en los extremos. */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

/** Escapa los comodines de LIKE (`%`, `_`) y el carácter de escape (`\`). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Expresión SQL de la columna sin acentos y en minúsculas. */
export function foldedColumn(column: SQLWrapper): SQL {
  return sql`lower(translate(${column}, ${ACCENTED}, ${PLAIN}))`
}

/** `column` contiene `query` como texto literal, sin distinguir mayúsculas ni acentos. */
export function containsText(column: SQLWrapper, query: string): SQL {
  return sql`${foldedColumn(column)} like ${`%${escapeLike(foldText(query))}%`} escape '\\'`
}

/** `column` es igual a `value`, sin distinguir mayúsculas (comparación literal, sin LIKE). */
export function equalsIgnoringCase(column: SQLWrapper, value: string): SQL {
  return sql`lower(${column}) = lower(${value})`
}
