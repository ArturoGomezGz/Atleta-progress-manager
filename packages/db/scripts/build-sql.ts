/**
 * Genera los scripts SQL listos para ejecutar en Railway (o cualquier PostgreSQL 16):
 *
 *   sql/01_schema.sql     Esquema completo + registro en drizzle.__drizzle_migrations
 *   sql/02_catalogs.sql   Grupos musculares, músculos y equipamiento
 *   sql/03_accounts.sql   Cuentas de prueba (verificadas) y equipo "Neo"
 *   sql/04_exercises.sql  Catálogo público de ejercicios con video de YouTube + rutina de ejemplo
 *                         (fuentes: data/calisthenics-exercises.json y data/exercises/*.json)
 *
 * Todos son idempotentes: se pueden ejecutar varias veces sin duplicar datos.
 * Uso: pnpm --filter @atleta/db build-sql   (después de `drizzle-kit generate`)
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(__dirname, "..")
const MIGRATIONS = path.join(ROOT, "src", "migrations")
const OUT = path.join(ROOT, "sql")

// ─── Helpers ──────────────────────────────────────────────────────────────────

const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`)

/** UUID determinista a partir de una clave, para que los seeds sean estables entre ejecuciones. */
function stableUuid(key: string): string {
  const h = crypto.createHash("sha256").update(key).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Mismo formato que @better-auth/utils/password: salt_hex:key_hex (scrypt N=16384 r=16 p=1 dkLen=64). */
function hashPassword(password: string, saltSeed: string): string {
  const salt = crypto.createHash("sha256").update(`salt:${saltSeed}`).digest("hex").slice(0, 32)
  const key = crypto.scryptSync(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 })
  return `${salt}:${key.toString("hex")}`
}

function header(title: string, body: string) {
  return `-- ═══════════════════════════════════════════════════════════════════════════
-- ${title}
-- Generado por packages/db/scripts/build-sql.ts — no editar a mano.
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════════════════
${body}
`
}

// ─── 01 · Schema ──────────────────────────────────────────────────────────────

function buildSchema(): string {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string; when: number }[]
  }

  const blocks: string[] = []
  const bookkeeping: string[] = []

  for (const entry of journal.entries) {
    const raw = fs.readFileSync(path.join(MIGRATIONS, `${entry.tag}.sql`), "utf8")
    // Drizzle identifica cada migración por el sha256 del archivo completo + `when` del journal
    const hash = crypto.createHash("sha256").update(raw).digest("hex")
    const statements = raw.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)

    blocks.push(`-- Migración ${entry.tag}
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '${hash}') THEN
    RAISE NOTICE 'Migración ${entry.tag} ya aplicada, se omite';
    RETURN;
  END IF;
${statements.map((s) => `  EXECUTE $stmt$${s.replace(/;\s*$/, "")}$stmt$;`).join("\n")}
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('${hash}', ${entry.when});
END
$migration$;`)
    bookkeeping.push(entry.tag)
  }

  return header(
    "01 · Esquema de base de datos",
    `-- Incluye las migraciones: ${bookkeeping.join(", ")}
-- La API también corre el migrador de Drizzle al arrancar; como aquí se registra el hash,
-- no intentará volver a crear las tablas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

${blocks.join("\n\n")}`,
  )
}

// ─── 02 · Catálogos ───────────────────────────────────────────────────────────

export const MUSCLE_GROUPS: { name: string; bodyZone: "upper" | "lower" | "core"; muscles: string[] }[] = [
  { name: "Pecho",     bodyZone: "upper", muscles: ["Pectoral mayor", "Pectoral menor", "Serrato anterior"] },
  { name: "Espalda",   bodyZone: "upper", muscles: ["Dorsal ancho", "Trapecio", "Romboides", "Erector espinal", "Redondo mayor"] },
  { name: "Hombro",    bodyZone: "upper", muscles: ["Deltoides anterior", "Deltoides lateral", "Deltoides posterior", "Manguito rotador"] },
  { name: "Brazo",     bodyZone: "upper", muscles: ["Bíceps", "Tríceps", "Braquial", "Braquiorradial"] },
  { name: "Antebrazo", bodyZone: "upper", muscles: ["Flexores del antebrazo", "Extensores del antebrazo"] },
  { name: "Abdomen",   bodyZone: "core",  muscles: ["Recto abdominal", "Oblicuo externo", "Oblicuo interno", "Transverso abdominal"] },
  { name: "Pierna",    bodyZone: "lower", muscles: ["Cuádriceps", "Isquiotibiales", "Pantorrillas", "Sóleo", "Aductores", "Tibial anterior", "Flexores de cadera"] },
  { name: "Glúteo",    bodyZone: "lower", muscles: ["Glúteo mayor", "Glúteo medio", "Glúteo menor"] },
]

export const EQUIPMENT: string[] = [
  // Calistenia
  "Barra de dominadas", "Barra baja", "Paralelas", "Paralelas bajas", "Anillas", "Banda elástica",
  "Cinturón de lastre", "Pared", "Silla", "Banco", "Caja / Step",
  // Gimnasio
  "Mancuernas", "Barra olímpica", "Barra EZ", "Kettlebell", "Máquina / Cable", "Polea alta", "Polea baja",
  "TRX / Suspensión", "Balón medicinal", "Rueda abdominal", "Pelota de estabilidad", "Bosu", "Sled",
  "Cuerda de batalla", "Trap bar", "Máquina Smith", "Disco", "Landmine", "Saco de arena", "Deslizadores",
  "Pica / Palo", "Comba", "Chaleco lastrado",
]

function buildCatalogs(): string {
  const lines: string[] = []
  for (const g of MUSCLE_GROUPS) {
    lines.push(`INSERT INTO "muscle_group" ("name", "body_zone") VALUES (${q(g.name)}, '${g.bodyZone}')
  ON CONFLICT ("name") DO UPDATE SET "body_zone" = EXCLUDED."body_zone";`)
    for (const m of g.muscles) {
      lines.push(`INSERT INTO "muscle" ("name", "muscle_group_id")
  SELECT ${q(m)}, id FROM "muscle_group" WHERE "name" = ${q(g.name)}
  ON CONFLICT ("name", "muscle_group_id") DO NOTHING;`)
    }
  }
  lines.push("")
  for (const e of EQUIPMENT) {
    lines.push(`INSERT INTO "equipment" ("name", "is_global", "created_by") VALUES (${q(e)}, true, NULL) ON CONFLICT DO NOTHING;`)
  }
  return header("02 · Catálogos (músculos y equipamiento)", `BEGIN;\n${lines.join("\n")}\nCOMMIT;`)
}

// ─── 03 · Cuentas de prueba ───────────────────────────────────────────────────

export const TEAM = { id: stableUuid("team:neo"), name: "Neo", maxAthletes: 50, maxCoaches: 10 }

type SeedAccount = {
  email: string
  name: string
  password: string
  role: "coach" | "athlete" | null
  // El seed corre en cada arranque de la API (SEED_DEMO_DATA=true), así que estas cuentas
  // vuelven a "no ha visto la bienvenida" cada vez — sirven para probar el onboarding de
  // usuarios nuevos repetidamente en un PR environment sin tener que registrar una cuenta.
  resetOnboarding?: boolean
}

export const ACCOUNTS: SeedAccount[] = [
  // Cuenta del sistema: publica el catálogo oficial de ejercicios. No pertenece a ningún equipo,
  // así los coaches usan esos ejercicios como "públicos" al armar rutinas.
  { email: "coach@atleta.com",          name: "Atleta",        password: "12345678", role: null },
  { email: "arturogomezgz04@gmail.com", name: "Arturo Gómez",  password: "admin",    role: "coach" },
  { email: "tester@gmail.com",          name: "Tester",        password: "12345678", role: "athlete" },
  { email: "abuela@gmail.com",          name: "Rosa Martínez", password: "12345678", role: "athlete" },
  // Cuentas dedicadas a probar la bienvenida a usuarios nuevos (ver docs/onboarding-bienvenida.md).
  { email: "nuevo.coach@atleta.com",  name: "Coach Nuevo",  password: "12345678", role: "coach",   resetOnboarding: true },
  { email: "nuevo.atleta@atleta.com", name: "Atleta Nuevo", password: "12345678", role: "athlete", resetOnboarding: true },
]

export const EXERCISE_OWNER_EMAIL = "coach@atleta.com"
/** Cuentas que fueron dueñas del catálogo en versiones anteriores. */
const LEGACY_OWNER_EMAILS = ["calixpert@gmail.com"]
export const COACH_EMAIL = "arturogomezgz04@gmail.com"

function buildAccounts(): string {
  const lines: string[] = [
    `-- La cuenta "chinita@gmail.com" de versiones anteriores pasa a ser "tester@gmail.com"
UPDATE "user" SET "email" = 'tester@gmail.com', "name" = 'Tester', "updated_at" = now()
  WHERE "email" = 'chinita@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM "user" WHERE "email" = 'tester@gmail.com');`,
    ...LEGACY_OWNER_EMAILS.map((email) => `-- La cuenta dueña del catálogo "${email}" pasa a ser la cuenta del sistema "${EXERCISE_OWNER_EMAIL}"
UPDATE "user" SET "email" = ${q(EXERCISE_OWNER_EMAIL)}, "updated_at" = now()
  WHERE "email" = ${q(email)}
    AND NOT EXISTS (SELECT 1 FROM "user" WHERE "email" = ${q(EXERCISE_OWNER_EMAIL)});`),
    `INSERT INTO "team" ("id", "name", "max_athletes", "max_coaches")
  VALUES ('${TEAM.id}', ${q(TEAM.name)}, ${TEAM.maxAthletes}, ${TEAM.maxCoaches})
  ON CONFLICT ("id") DO UPDATE SET "max_athletes" = EXCLUDED."max_athletes", "max_coaches" = EXCLUDED."max_coaches";`,
  ]

  for (const a of ACCOUNTS) {
    const userId = stableUuid(`user:${a.email}`)
    const hash = hashPassword(a.password, a.email)
    lines.push(`
-- ${a.name} <${a.email}> · contraseña: ${a.password} · rol: ${a.role ?? "sin equipo"}
INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
  VALUES ('${userId}', ${q(a.name)}, ${q(a.email)}, true, now(), now())
  ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "email_verified" = true, "updated_at" = now();
DELETE FROM "account" WHERE "provider_id" = 'credential'
  AND "user_id" = (SELECT "id" FROM "user" WHERE "email" = ${q(a.email)});
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
  SELECT '${stableUuid(`account:${a.email}`)}', u."id", 'credential', u."id", '${hash}', now(), now()
  FROM "user" u WHERE u."email" = ${q(a.email)};${a.role ? `
INSERT INTO "team_member" ("team_id", "user_id", "role")
  SELECT '${TEAM.id}', u."id", '${a.role}' FROM "user" u
  WHERE u."email" = ${q(a.email)}
    AND NOT EXISTS (SELECT 1 FROM "team_member" tm WHERE tm."team_id" = '${TEAM.id}' AND tm."user_id" = u."id");` : ""}${a.resetOnboarding ? `
-- Se reinicia en cada seed: esta cuenta siempre arranca como si nunca hubiera entrado a la app
DELETE FROM "user_preferences" WHERE "user_id" = (SELECT "id" FROM "user" WHERE "email" = ${q(a.email)});` : ""}`)
  }

  return header("03 · Cuentas de prueba y equipo Neo", `BEGIN;\n${lines.join("\n")}\nCOMMIT;`)
}

// ─── 04 · Ejercicios ──────────────────────────────────────────────────────────

const MOVEMENT_PATTERNS = ["push", "pull", "squat", "hinge", "carry", "rotation", "isometric", "mobility", "core"] as const

/** Formato normalizado de un ejercicio del catálogo (data/exercises/*.json). */
export type SeedExercise = {
  name: string
  description: string
  difficulty: "beginner" | "intermediate" | "advanced"
  patterns: (typeof MOVEMENT_PATTERNS)[number][]
  /** Nombres del catálogo de músculos (MUSCLE_GROUPS) */
  primary: string[]
  secondary: string[]
  /** Nombres del catálogo de equipamiento (EQUIPMENT); vacío = peso corporal */
  equipment: string[]
  youtube_id: string
  youtube_title: string
  channel: string
  orientation: "horizontal" | "vertical"
}

/** Formato original del dataset de calistenia (data/calisthenics-exercises.json). */
type DatasetExercise = {
  name: string
  category: "push" | "pull" | "core" | "leg"
  muscle_groups: string[]
  level: "pre-beginner" | "beginner" | "intermediate" | "advanced"
  equipment: string[]
  youtube_id: string
  youtube_verified: boolean
  orientation: "horizontal" | "vertical"
  description_es: string
  youtube_title?: string
}

const MUSCLE_MAP: Record<string, [group: string, muscle: string]> = {
  "chest": ["Pecho", "Pectoral mayor"],
  "serratus": ["Pecho", "Serrato anterior"],
  "triceps": ["Brazo", "Tríceps"],
  "biceps": ["Brazo", "Bíceps"],
  "front-deltoid": ["Hombro", "Deltoides anterior"],
  "rear-deltoid": ["Hombro", "Deltoides posterior"],
  "rotator-cuff": ["Hombro", "Manguito rotador"],
  "abs": ["Abdomen", "Recto abdominal"],
  "obliques": ["Abdomen", "Oblicuo externo"],
  "forearms": ["Antebrazo", "Flexores del antebrazo"],
  "upper-back": ["Espalda", "Romboides"],
  "traps": ["Espalda", "Trapecio"],
  "lats": ["Espalda", "Dorsal ancho"],
  "lower-back": ["Espalda", "Erector espinal"],
  "spinal-erectors": ["Espalda", "Erector espinal"],
  "glutes": ["Glúteo", "Glúteo mayor"],
  "abductors": ["Glúteo", "Glúteo medio"],
  "quads": ["Pierna", "Cuádriceps"],
  "hamstrings": ["Pierna", "Isquiotibiales"],
  "adductors": ["Pierna", "Aductores"],
  "hip-flexors": ["Pierna", "Flexores de cadera"],
  "calves-rear": ["Pierna", "Pantorrillas"],
  "calves-front": ["Pierna", "Tibial anterior"],
}

const EQUIPMENT_MAP: Record<string, string | null> = {
  "suelo": null,
  "pared": "Pared",
  "silla": "Silla",
  "banco": "Banco",
  "cajón": "Caja / Step",
  "anillas": "Anillas",
  "paralelas": "Paralelas",
  "paralelas bajas": "Paralelas bajas",
  "banda de resistencia": "Banda elástica",
  "cinturón de lastre": "Cinturón de lastre",
  "barra": "Barra de dominadas",
  "barra alta": "Barra de dominadas",
  "barra de dominadas": "Barra de dominadas",
  "barra baja": "Barra baja",
}

const PATTERN_MAP: Record<DatasetExercise["category"], string> = {
  push: "push", pull: "pull", core: "core", leg: "squat",
}

export const exerciseUuid = (name: string) => stableUuid(`exercise:${name}`)

/** Convierte el dataset original de calistenia al formato normalizado. */
function fromCalisthenicsDataset(ex: DatasetExercise): SeedExercise {
  if (!ex.youtube_verified || !ex.youtube_id) throw new Error(`Ejercicio sin video verificado: ${ex.name}`)
  const muscles = [...new Set(ex.muscle_groups.map((slug) => {
    const mapped = MUSCLE_MAP[slug]
    if (!mapped) throw new Error(`Músculo sin mapear: ${slug}`)
    return mapped[1]
  }))]
  return {
    name: ex.name,
    description: ex.description_es,
    difficulty: ex.level === "pre-beginner" ? "beginner" : ex.level,
    patterns: [PATTERN_MAP[ex.category] as SeedExercise["patterns"][number]],
    // En el dataset original los dos primeros grupos son los principales
    primary: ex.muscle_groups.slice(0, 2).map((slug) => MUSCLE_MAP[slug][1]).filter((m, i, a) => a.indexOf(m) === i),
    secondary: muscles.filter((m) => !ex.muscle_groups.slice(0, 2).some((slug) => MUSCLE_MAP[slug][1] === m)),
    equipment: [...new Set(ex.equipment.map((e) => {
      if (!(e in EQUIPMENT_MAP)) throw new Error(`Equipamiento sin mapear: ${e}`)
      return EQUIPMENT_MAP[e]
    }).filter((e): e is string => !!e))],
    youtube_id: ex.youtube_id,
    youtube_title: ex.youtube_title ?? ex.name,
    channel: "Calixpert",
    orientation: ex.orientation,
  }
}

/** Clave para detectar nombres repetidos: sin mayúsculas, acentos, signos ni plurales simples. */
export function exerciseNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 3 ? w.replace(/(es|s)$/, "") : w))
    .join(" ")
}

/** Valida el catálogo completo; lanza con todos los problemas encontrados. */
export function validateCatalog(dataset: SeedExercise[]) {
  const muscleNames = new Set(MUSCLE_GROUPS.flatMap((g) => g.muscles))
  const equipment = new Set(EQUIPMENT)
  const names = new Map<string, string>()
  const videos = new Map<string, string>()
  const errors: string[] = []

  for (const ex of dataset) {
    const key = exerciseNameKey(ex.name)
    if (names.has(key)) errors.push(`Nombre repetido: "${ex.name}" ≈ "${names.get(key)}"`)
    names.set(key, ex.name)
    if (!/^[A-Za-z0-9_-]{11}$/.test(ex.youtube_id)) errors.push(`${ex.name}: youtube_id inválido "${ex.youtube_id}"`)
    if (videos.has(ex.youtube_id)) errors.push(`Video repetido ${ex.youtube_id}: "${ex.name}" y "${videos.get(ex.youtube_id)}"`)
    videos.set(ex.youtube_id, ex.name)
    if (!ex.description?.trim()) errors.push(`${ex.name}: sin descripción`)
    if (!["beginner", "intermediate", "advanced"].includes(ex.difficulty)) errors.push(`${ex.name}: dificultad "${ex.difficulty}"`)
    if (!ex.patterns.length) errors.push(`${ex.name}: sin patrón de movimiento`)
    for (const p of ex.patterns) if (!MOVEMENT_PATTERNS.includes(p)) errors.push(`${ex.name}: patrón "${p}"`)
    if (!ex.primary.length) errors.push(`${ex.name}: sin músculo principal`)
    for (const m of [...ex.primary, ...ex.secondary]) if (!muscleNames.has(m)) errors.push(`${ex.name}: músculo "${m}"`)
    for (const e of ex.equipment) if (!equipment.has(e)) errors.push(`${ex.name}: equipamiento "${e}"`)
  }
  if (errors.length) throw new Error(`Catálogo de ejercicios inválido:\n  ${errors.join("\n  ")}`)
}

function buildExercises(dataset: SeedExercise[]): string {
  validateCatalog(dataset)
  const muscleGroup = new Map(MUSCLE_GROUPS.flatMap((g) => g.muscles.map((m) => [m, g.name] as const)))
  const adminId = `(SELECT "id" FROM "user" WHERE "email" = ${q(EXERCISE_OWNER_EMAIL)})`
  const seedIds = dataset.map((ex) => `'${exerciseUuid(ex.name)}'`).join(", ")
  const lines: string[] = [
    // Bases sembradas con versiones anteriores: los ejercicios eran de otra cuenta (coach o Calixpert).
    // Se transfieren a la cuenta del sistema conservando los mismos IDs (rutinas y sesiones siguen apuntando bien).
    `-- Transferir el catálogo sembrado a ${EXERCISE_OWNER_EMAIL}
UPDATE "exercise" SET "owner_user_id" = ${adminId}, "owner_team_id" = NULL, "created_by" = ${adminId}, "is_public" = true, "updated_at" = now()
  WHERE "id" IN (${seedIds})
    AND "owner_user_id" IS DISTINCT FROM ${adminId};`,
  ]

  for (const ex of dataset) {
    const id = exerciseUuid(ex.name)
    const exists = `EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '${id}')`

    lines.push(`
-- ${ex.name} · ${ex.channel}
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('${id}', ${q(ex.name)}, ${q(ex.description)}, '${ex.difficulty}', '{${[...new Set(ex.patterns)].join(",")}}', '${ex.youtube_id}', ${q(ex.youtube_title)}, '${ex.orientation}', true, ${adminId}, ${adminId})
  ON CONFLICT DO NOTHING;`)

    const roles = [
      ...ex.primary.map((m) => [m, "primary"] as const),
      ...ex.secondary.filter((m) => !ex.primary.includes(m)).map((m) => [m, "secondary"] as const),
    ]
    for (const [muscle, role] of roles) {
      lines.push(`INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '${id}', m."id", '${role}' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = ${q(muscle)} AND g."name" = ${q(muscleGroup.get(muscle)!)} AND ${exists}
  ON CONFLICT DO NOTHING;`)
    }

    for (const eqName of new Set(ex.equipment)) {
      lines.push(`INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '${id}', e."id" FROM "equipment" e
  WHERE e."name" = ${q(eqName)} AND e."is_global" = true AND e."created_by" IS NULL AND ${exists}
  ON CONFLICT DO NOTHING;`)
    }
  }

  lines.push("\n" + buildDemoRoutine(dataset))
  return header(`04 · Catálogo de ${dataset.length} ejercicios (YouTube) + rutina de ejemplo`, `BEGIN;\n${lines.join("\n")}\nCOMMIT;`)
}

function buildDemoRoutine(dataset: SeedExercise[]): string {
  const pick = (name: string) => {
    if (!dataset.some((d) => d.name === name)) throw new Error(`Ejercicio de la rutina demo no existe: ${name}`)
    return exerciseUuid(name)
  }
  const reps = (n: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ setNumber: i + 1, setType: "reps", targetReps: n }))
  const time = (seconds: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ setNumber: i + 1, setType: "time", targetDurationSeconds: seconds }))

  const first = dataset[0].name
  const content = {
    v: 1,
    items: [
      { type: "exercise", id: stableUuid("demo:1"), exerciseId: pick(first), order: 0, restSeconds: 60, notes: "Baja despacio y mantén el cuerpo recto.", sets: reps(8, 3) },
      ...dataset.slice(1, 3).map((d, i) => ({
        type: "exercise", id: stableUuid(`demo:${i + 2}`), exerciseId: pick(d.name), order: i + 1, restSeconds: 90, sets: reps(10, 3),
      })),
      {
        type: "block", id: stableUuid("demo:block"), order: 3, name: "Circuito final", rounds: 2,
        exercises: dataset.filter((d) => d.patterns.includes("core")).slice(0, 2).map((d, i) => ({
          id: stableUuid(`demo:block:${i}`), exerciseId: pick(d.name), order: 4 + i, sets: time(30, 1),
        })),
      },
    ],
  }

  return `-- Rutina de ejemplo del equipo Neo
INSERT INTO "routine" ("id", "name", "team_id", "created_by", "category", "content")
  SELECT '${stableUuid("routine:demo")}', 'rutina de ejemplo', '${TEAM.id}', u."id", 'training', ${q(JSON.stringify(content))}::jsonb
  FROM "user" u WHERE u."email" = ${q(COACH_EMAIL)}
  ON CONFLICT ("id") DO NOTHING;`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/** Todas las fuentes del catálogo: el dataset original de calistenia + data/exercises/*.json (orden alfabético). */
export function loadCatalog(): SeedExercise[] {
  const calisthenics = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "calisthenics-exercises.json"), "utf8"),
  ) as DatasetExercise[]
  const dir = path.join(ROOT, "data", "exercises")
  const extra = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
        .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as SeedExercise[])
    : []
  return [...calisthenics.map(fromCalisthenicsDataset), ...extra]
}

function main() {
  const dataset = loadCatalog()

  fs.mkdirSync(OUT, { recursive: true })
  const files: [string, string][] = [
    ["01_schema.sql", buildSchema()],
    ["02_catalogs.sql", buildCatalogs()],
    ["03_accounts.sql", buildAccounts()],
    ["04_exercises.sql", buildExercises(dataset)],
  ]
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(OUT, name), content)
    console.log(`✓ sql/${name} (${(content.length / 1024).toFixed(1)} KB)`)
  }
}

if (require.main === module) main()
