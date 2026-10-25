import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PgDialect } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { containsText, equalsIgnoringCase, escapeLike, foldText } from "../../src/lib/text-search"

const dialect = new PgDialect()
const render = (q: ReturnType<typeof sql>) => dialect.sqlToQuery(q)

describe("text-search", () => {
  it("foldText quita acentos y mayúsculas como normalizeText", () => {
    assert.equal(foldText("  Flexión de BRAZOS "), "flexion de brazos")
    assert.equal(foldText("Pingüino Ñandú"), "pinguino nandu")
  })

  it("escapeLike escapa %, _ y \\", () => {
    assert.equal(escapeLike("100%_a\\b"), "100\\%\\_a\\\\b")
  })

  it("containsText usa translate() en la columna y el término escapado como parámetro", () => {
    const q = render(containsText(sql.raw('"name"'), "Flexión_%"))
    assert.match(q.sql, /^lower\(translate\("name", \$1, \$2\)\) like \$3 escape '\\'$/)
    assert.equal(q.params[2], "%flexion\\_\\%%")
    const [accented, plain] = q.params as string[]
    assert.equal([...accented!].length, [...plain!].length, "translate() necesita tablas del mismo largo")
    for (const [i, c] of [...accented!].entries()) assert.equal(foldText(c), plain![i]!.toLowerCase(), c)
  })

  it("equalsIgnoringCase compara literal (sin LIKE)", () => {
    const q = render(equalsIgnoringCase(sql.raw('"name"'), "Press_banca%"))
    assert.equal(q.sql, 'lower("name") = lower($1)')
    assert.deepEqual(q.params, ["Press_banca%"])
  })
})
