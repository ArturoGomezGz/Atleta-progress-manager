import { teamMember } from "@atleta/db/schema"
import { TRPCError } from "@trpc/server"
import assert from "node:assert/strict"
import { before, describe, it } from "node:test"

// @atleta/db/client crea el cliente postgres al importarse (sin conectar hasta
// la primera query); .toSQL() no ejecuta nada contra la DB. Import dinámico en
// before() porque los tests se compilan a CJS (sin top-level await).
process.env.DATABASE_URL ??= "postgres://test@localhost/test"
let mod: typeof import("../../src/lib/team-access")
before(async () => {
  mod = await import("../../src/lib/team-access")
})
const requireMember: typeof mod.requireMember = (m) => mod.requireMember(m)
const requireCoach: typeof mod.requireCoach = (m) => mod.requireCoach(m)
const requireAthlete: typeof mod.requireAthlete = (m) => mod.requireAthlete(m)
const memberQuery = (u: string, t: string) => mod.memberQuery(u, t)
const athleteInTeamQuery = (a: string, t: string) => mod.athleteInTeamQuery(a, t)

const row = (overrides: Partial<typeof teamMember.$inferSelect> = {}): typeof teamMember.$inferSelect => ({
  id: "m1",
  teamId: "t1",
  userId: "u1",
  role: "athlete",
  selfAthlete: false,
  joinedAt: new Date(0),
  ...overrides,
})

const isTrpcError = (code: TRPCError["code"]) => (err: unknown) => {
  assert.ok(err instanceof TRPCError)
  assert.equal(err.code, code)
  return true
}

describe("requireMember", () => {
  it("lanza FORBIDDEN si no hay fila", () => {
    assert.throws(() => requireMember(undefined), isTrpcError("FORBIDDEN"))
  })

  it("devuelve la fila tal cual si existe", () => {
    const r = row()
    assert.equal(requireMember(r), r)
  })
})

describe("requireCoach", () => {
  it("lanza FORBIDDEN si el rol no es coach", () => {
    assert.throws(() => requireCoach(row({ role: "athlete" })), isTrpcError("FORBIDDEN"))
  })

  it("pasa con rol coach, también con selfAthlete", () => {
    const coach = row({ role: "coach" })
    assert.equal(requireCoach(coach), coach)
    const selfCoach = row({ role: "coach", selfAthlete: true })
    assert.equal(requireCoach(selfCoach), selfCoach)
  })
})

describe("requireAthlete", () => {
  it("lanza NOT_FOUND (no FORBIDDEN) si no hay fila, para no revelar otros equipos", () => {
    assert.throws(() => requireAthlete(undefined), (err: unknown) => {
      assert.ok(err instanceof TRPCError)
      assert.notEqual(err.code, "FORBIDDEN")
      assert.equal(err.code, "NOT_FOUND")
      return true
    })
  })

  it("devuelve la fila tal cual si existe", () => {
    const r = row()
    assert.equal(requireAthlete(r), r)
  })
})

describe("memberQuery", () => {
  it("filtra por usuario y por equipo", () => {
    const { sql, params } = memberQuery("u1", "t1").toSQL()
    assert.ok(params.includes("u1"))
    assert.ok(params.includes("t1"))
    assert.ok(sql.includes(`"${teamMember.userId.name}" = `))
    assert.ok(sql.includes(`"${teamMember.teamId.name}" = `))
  })
})

describe("athleteInTeamQuery", () => {
  it("filtra por atleta, equipo y rol athlete", () => {
    const { sql, params } = athleteInTeamQuery("a1", "t1").toSQL()
    assert.ok(params.includes("a1"))
    assert.ok(params.includes("t1"))
    assert.ok(params.includes("athlete"))
    assert.ok(sql.includes(`"${teamMember.userId.name}" = `))
    assert.ok(sql.includes(`"${teamMember.teamId.name}" = `))
  })
})
