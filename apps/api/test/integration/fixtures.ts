// Datos base de las pruebas de integración. Las cuentas se crean por HTTP (registro por
// el proxy /api/auth/*, como la web) y lo demás con el caller tRPC de cada usuario, así
// las pruebas recorren el mismo código que producción.
//
// Este módulo NO importa src/ de forma estática: setup.ts fija el entorno antes.

import type { FastifyBaseLogger } from "fastify"

export const FIXTURE_PASSWORD = "contrasena-de-prueba-123"

export const FIXTURE_EMAILS = {
  /** Coach del equipo A, con todos los flags. */
  coachA: "coach-a@test.local",
  /** Coach de otro equipo (B), con todos los flags. */
  coachB: "coach-b@test.local",
  /** Atleta del equipo A, con todos los flags. */
  athleteA: "atleta-a@test.local",
  /** Usuario sin ningún flag (sin `mcp`). */
  noMcp: "sin-mcp@test.local",
} as const

export type FixtureUser = { id: string; email: string; name: string; cookie: string }

const silentLog = (() => {
  const noop = () => {}
  const log = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, child: () => log, level: "silent" }
  return log as unknown as FastifyBaseLogger
})()

/** Cookies de una respuesta (`set-cookie`) en formato de cabecera `cookie`. */
export function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
}

export async function signUp(baseUrl: string, email: string, name: string): Promise<FixtureUser> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email, name, password: FIXTURE_PASSWORD }),
  })
  if (!res.ok) throw new Error(`sign-up ${email} → ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { user: { id: string } }
  return { id: body.user.id, email, name, cookie: cookieHeader(res) }
}

export async function signIn(baseUrl: string, email: string, password = FIXTURE_PASSWORD): Promise<Response> {
  return fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email, password }),
  })
}

/** Caller tRPC con la sesión real (cookie) del usuario. */
export async function callerFor(u: FixtureUser) {
  const [{ auth }, { createCaller }] = await Promise.all([import("../../src/auth"), import("../../src/routers")])
  const session = await auth.api.getSession({ headers: new Headers({ cookie: u.cookie }) })
  if (!session) throw new Error(`sin sesión para ${u.email}`)
  return createCaller({ session, log: silentLog })
}

export type Caller = Awaited<ReturnType<typeof callerFor>>

/** Agrega `member` al equipo como atleta usando el flujo real de invitación. */
async function joinTeam(coach: Caller, member: Caller, teamId: string) {
  const { token } = await coach.teams.generateInviteLink({ teamId })
  await member.teams.joinViaInvite({ token })
}

/** Ejercicios públicos del catálogo sembrado por 04_exercises.sql (visibles para todos). */
export async function catalogExerciseIds(limit = 3): Promise<string[]> {
  const [{ db }, { exercise }, { and, eq, isNull }] = await Promise.all([
    import("@atleta/db/client"),
    import("@atleta/db/schema"),
    import("drizzle-orm"),
  ])
  const rows = await db
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(eq(exercise.isPublic, true), isNull(exercise.ownerTeamId), isNull(exercise.deletedAt)))
    .orderBy(exercise.name)
    .limit(limit)
  if (rows.length < limit) throw new Error("No hay ejercicios de sistema: ¿SEED_DEMO_DATA=true?")
  return rows.map((r) => r.id)
}

/** Ejercicio privado (no público) del equipo indicado. */
export async function createPrivateTeamExercise(teamId: string, createdBy: string, name: string): Promise<string> {
  const [{ db }, { exercise }] = await Promise.all([import("@atleta/db/client"), import("@atleta/db/schema")])
  const [row] = await db
    .insert(exercise)
    .values({ name, isPublic: false, ownerTeamId: teamId, createdBy, difficulty: "beginner", movementPatterns: ["core"] })
    .returning({ id: exercise.id })
  return row!.id
}

export type Fixtures = Awaited<ReturnType<typeof createFixtures>>

/** Coach A + equipo A + atleta de A; coach B + equipo B; usuario sin flags. */
export async function createFixtures(baseUrl: string) {
  const coachA = await signUp(baseUrl, FIXTURE_EMAILS.coachA, "Coach A")
  const coachB = await signUp(baseUrl, FIXTURE_EMAILS.coachB, "Coach B")
  const athleteA = await signUp(baseUrl, FIXTURE_EMAILS.athleteA, "Atleta A")
  const noMcp = await signUp(baseUrl, FIXTURE_EMAILS.noMcp, "Sin MCP")

  const [callerA, callerB, callerAthlete, callerNoMcp] = await Promise.all([coachA, coachB, athleteA, noMcp].map(callerFor))
  const teamA = await callerA!.teams.create({ name: "Equipo A" })
  const teamB = await callerB!.teams.create({ name: "Equipo B" })
  await joinTeam(callerA!, callerAthlete!, teamA.id)

  return {
    users: { coachA, coachB, athleteA, noMcp },
    callers: { coachA: callerA!, coachB: callerB!, athleteA: callerAthlete!, noMcp: callerNoMcp! },
    teams: { a: teamA, b: teamB },
  }
}
