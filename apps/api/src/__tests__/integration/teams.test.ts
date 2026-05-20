import { beforeEach, describe, expect, it } from "vitest"
import { makeAnonymousCaller, makeCaller } from "../helpers/caller"
import { truncateAll } from "../helpers/db"
import { addAthlete, seedTeam, seedUser } from "../helpers/seed"

beforeEach(async () => {
  await truncateAll()
})

// ── teams.create ──────────────────────────────────────────────────────────────

describe("teams.create", () => {
  it("crea un equipo y el creador queda como coach", async () => {
    const coach = await seedUser()
    const result = await makeCaller(coach).teams.create({ name: "Equipo A" })

    expect(result.name).toBe("Equipo A")
    expect(result.id).toBeDefined()
  })

  it("lanza UNAUTHORIZED sin sesión", async () => {
    await expect(makeAnonymousCaller().teams.create({ name: "X" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})

// ── teams.list ────────────────────────────────────────────────────────────────

describe("teams.list", () => {
  it("devuelve solo los equipos donde el usuario es miembro", async () => {
    const coach = await seedUser()
    const other = await seedUser()
    await seedTeam(coach.id, "Mi Equipo")
    await seedTeam(other.id, "Equipo Ajeno")

    const result = await makeCaller(coach).teams.list()

    expect(result).toHaveLength(1)
    expect(result[0].team.name).toBe("Mi Equipo")
    expect(result[0].role).toBe("coach")
  })
})

// ── teams.generateInviteLink ──────────────────────────────────────────────────

describe("teams.generateInviteLink", () => {
  it("genera un token con fecha de expiración futura", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)

    const result = await makeCaller(coach).teams.generateInviteLink({ teamId: team.id })

    expect(result.token).toBeDefined()
    expect(result.token.length).toBeGreaterThan(0)
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    await expect(makeCaller(athlete).teams.generateInviteLink({ teamId: team.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("lanza BAD_REQUEST si el equipo está lleno (maxAthletes)", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    // El equipo tiene maxAthletes = 1 por defecto; al agregar 1 atleta queda lleno
    await addAthlete(team.id, athlete.id)

    await expect(makeCaller(coach).teams.generateInviteLink({ teamId: team.id }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

// ── teams.joinViaInvite ───────────────────────────────────────────────────────

describe("teams.joinViaInvite", () => {
  it("atleta se une al equipo con token válido", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)

    const { token } = await makeCaller(coach).teams.generateInviteLink({ teamId: team.id })
    const result = await makeCaller(athlete).teams.joinViaInvite({ token })

    expect(result.teamId).toBe(team.id)
    expect(result.alreadyMember).toBe(false)
  })

  it("el token se elimina tras el primer uso (single-use)", async () => {
    const coach = await seedUser()
    const athlete1 = await seedUser()
    const athlete2 = await seedUser()
    const team = await seedTeam(coach.id)

    const { token } = await makeCaller(coach).teams.generateInviteLink({ teamId: team.id })
    await makeCaller(athlete1).teams.joinViaInvite({ token })

    await expect(makeCaller(athlete2).teams.joinViaInvite({ token }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("lanza NOT_FOUND con token inválido", async () => {
    const user = await seedUser()
    await expect(makeCaller(user).teams.joinViaInvite({ token: "token-inexistente" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

// ── teams.members ─────────────────────────────────────────────────────────────

describe("teams.members", () => {
  it("devuelve la lista de miembros con sus roles", async () => {
    const coach = await seedUser({ name: "Coach Test" })
    const athlete = await seedUser({ name: "Athlete Test" })
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    const members = await makeCaller(coach).teams.members({ teamId: team.id })

    expect(members).toHaveLength(2)
    const roles = members.map((m) => m.role).sort()
    expect(roles).toEqual(["athlete", "coach"])
  })

  it("lanza FORBIDDEN si el usuario no es miembro", async () => {
    const coach = await seedUser()
    const outsider = await seedUser()
    const team = await seedTeam(coach.id)

    await expect(makeCaller(outsider).teams.members({ teamId: team.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// ── teams.removeMember ────────────────────────────────────────────────────────

describe("teams.removeMember", () => {
  it("coach elimina a un atleta del equipo", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    await makeCaller(coach).teams.removeMember({ teamId: team.id, userId: athlete.id })

    const members = await makeCaller(coach).teams.members({ teamId: team.id })
    expect(members.every((m) => m.userId !== athlete.id)).toBe(true)
  })

  it("lanza BAD_REQUEST si el coach intenta eliminarse a sí mismo", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)

    await expect(makeCaller(coach).teams.removeMember({ teamId: team.id, userId: coach.id }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

// ── teams.updateMemberRole ────────────────────────────────────────────────────

describe("teams.updateMemberRole", () => {
  it("coach puede promover a un atleta a coach", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    await makeCaller(coach).teams.updateMemberRole({ teamId: team.id, userId: athlete.id, role: "coach" })

    const members = await makeCaller(coach).teams.members({ teamId: team.id })
    const updated = members.find((m) => m.userId === athlete.id)
    expect(updated?.role).toBe("coach")
  })

  it("lanza BAD_REQUEST si el coach intenta cambiar su propio rol", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)

    await expect(makeCaller(coach).teams.updateMemberRole({ teamId: team.id, userId: coach.id, role: "athlete" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

// ── teams.deleteTeam ──────────────────────────────────────────────────────────

describe("teams.deleteTeam", () => {
  it("coach puede eliminar el equipo", async () => {
    const coach = await seedUser()
    const team = await seedTeam(coach.id)

    await makeCaller(coach).teams.deleteTeam({ teamId: team.id })

    const list = await makeCaller(coach).teams.list()
    expect(list.every((t) => t.team.id !== team.id)).toBe(true)
  })

  it("lanza FORBIDDEN si lo intenta un atleta", async () => {
    const coach = await seedUser()
    const athlete = await seedUser()
    const team = await seedTeam(coach.id)
    await addAthlete(team.id, athlete.id)

    await expect(makeCaller(athlete).teams.deleteTeam({ teamId: team.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
