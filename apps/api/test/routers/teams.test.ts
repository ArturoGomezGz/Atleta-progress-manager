import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { assertAthleteInTeam, assertCoach, assertMember } from "../../src/routers/teams"

// Fake mínimo de `tx.select().from().where().limit()`. No valida la cláusula `where`:
// solo prueba el contrato de los helpers (lanzan o no, y con qué código).
type Tx = NonNullable<Parameters<typeof assertMember>[2]>
const fakeTx = (rows: unknown[]) =>
  ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) }) }) as unknown as Tx

const withCode = (code: string) => (err: unknown) => err instanceof TRPCError && err.code === code

describe("teams auth helpers", () => {
  it("assertMember sin filas rechaza con FORBIDDEN", async () => {
    await assert.rejects(assertMember("u1", "t1", fakeTx([])), withCode("FORBIDDEN"))
  })

  it("assertMember con fila la devuelve", async () => {
    const row = { role: "athlete" }
    assert.deepEqual(await assertMember("u1", "t1", fakeTx([row])), row)
  })

  it("assertCoach con rol athlete rechaza con FORBIDDEN", async () => {
    await assert.rejects(assertCoach("u1", "t1", fakeTx([{ role: "athlete" }])), withCode("FORBIDDEN"))
  })

  it("assertCoach con rol coach resuelve", async () => {
    await assert.doesNotReject(assertCoach("u1", "t1", fakeTx([{ role: "coach" }])))
  })

  it("assertCoach sin filas rechaza con FORBIDDEN, no TypeError", async () => {
    await assert.rejects(assertCoach("u1", "t1", fakeTx([])), withCode("FORBIDDEN"))
  })

  it("assertAthleteInTeam sin filas rechaza con NOT_FOUND", async () => {
    // NOT_FOUND (no FORBIDDEN) a propósito: no debe revelar si el atleta pertenece a otro equipo.
    await assert.rejects(assertAthleteInTeam("a1", "t1", fakeTx([])), withCode("NOT_FOUND"))
  })
})
