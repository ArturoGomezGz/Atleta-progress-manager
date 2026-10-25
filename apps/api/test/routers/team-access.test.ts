import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TRPCError } from "@trpc/server"
import { decideAthleteInTeam, decideMembership, type TeamMemberRow } from "../../src/routers/team-access"

function member(overrides: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    teamId: "00000000-0000-0000-0000-0000000000aa",
    userId: "u1",
    role: "athlete",
    selfAthlete: false,
    joinedAt: new Date(0),
    ...overrides,
  }
}

function throwsCode(fn: () => unknown, code: TRPCError["code"]) {
  assert.throws(fn, (err: unknown) => err instanceof TRPCError && err.code === code)
}

describe("decideMembership", () => {
  it("sin member lanza FORBIDDEN", () => {
    throwsCode(() => decideMembership(undefined, "member"), "FORBIDDEN")
    throwsCode(() => decideMembership(undefined, "coach"), "FORBIDDEN")
  })

  it("athlete exigiendo coach lanza FORBIDDEN, aunque tenga selfAthlete", () => {
    throwsCode(() => decideMembership(member({ role: "athlete" }), "coach"), "FORBIDDEN")
    throwsCode(() => decideMembership(member({ role: "athlete", selfAthlete: true }), "coach"), "FORBIDDEN")
  })

  it("athlete exigiendo member lo devuelve", () => {
    const m = member({ role: "athlete" })
    assert.equal(decideMembership(m, "member"), m)
  })

  it("coach pasa tanto member como coach y devuelve el mismo member", () => {
    const m = member({ role: "coach" })
    assert.equal(decideMembership(m, "member"), m)
    assert.equal(decideMembership(m, "coach"), m)
  })
})

describe("decideAthleteInTeam", () => {
  it("sin member lanza NOT_FOUND (no FORBIDDEN)", () => {
    throwsCode(() => decideAthleteInTeam(undefined), "NOT_FOUND")
  })

  it("devuelve athlete y coach con selfAthlete", () => {
    const athlete = member({ role: "athlete" })
    const selfCoach = member({ role: "coach", selfAthlete: true })
    assert.equal(decideAthleteInTeam(athlete), athlete)
    assert.equal(decideAthleteInTeam(selfCoach), selfCoach)
  })

  // El filtro role = "athlete" OR selfAthlete vive en la consulta SQL de
  // assertAthleteInTeam, no en la decisión: cualquier fila que llegue se acepta.
  it("no re-filtra por rol: un coach sin selfAthlete también se devuelve", () => {
    const coach = member({ role: "coach", selfAthlete: false })
    assert.equal(decideAthleteInTeam(coach), coach)
  })
})
