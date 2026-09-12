/**
 * Genera los scripts SQL listos para ejecutar en Railway (o cualquier PostgreSQL 16):
 *
 *   sql/01_schema.sql     Esquema completo + registro en drizzle.__drizzle_migrations
 *   sql/02_catalogs.sql   Grupos musculares, músculos y equipamiento
 *   sql/03_accounts.sql   Cuentas de prueba (verificadas) y equipo "Neo"
 *   sql/04_exercises.sql  100 ejercicios de calistenia con video de YouTube + rutina de ejemplo
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
  "Cuerda de batalla", "Trap bar",
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

export const ACCOUNTS = [
  { email: "arturogomezgz04@gmail.com", name: "Arturo Gómez", password: "admin",    role: "coach"   as const },
  { email: "tester@gmail.com",          name: "Tester",       password: "12345678", role: "athlete" as const },
  { email: "abuela@gmail.com",          name: "Rosa Martínez", password: "12345678", role: "athlete" as const },
]

export const ADMIN_EMAIL = ACCOUNTS[0].email

function buildAccounts(): string {
  const lines: string[] = [
    `-- La cuenta "chinita@gmail.com" de versiones anteriores pasa a ser "tester@gmail.com"
UPDATE "user" SET "email" = 'tester@gmail.com', "name" = 'Tester', "updated_at" = now()
  WHERE "email" = 'chinita@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM "user" WHERE "email" = 'tester@gmail.com');`,
    `INSERT INTO "team" ("id", "name", "max_athletes", "max_coaches")
  VALUES ('${TEAM.id}', ${q(TEAM.name)}, ${TEAM.maxAthletes}, ${TEAM.maxCoaches})
  ON CONFLICT ("id") DO UPDATE SET "max_athletes" = EXCLUDED."max_athletes", "max_coaches" = EXCLUDED."max_coaches";`,
  ]

  for (const a of ACCOUNTS) {
    const userId = stableUuid(`user:${a.email}`)
    const hash = hashPassword(a.password, a.email)
    lines.push(`
-- ${a.name} <${a.email}> · contraseña: ${a.password} · rol: ${a.role}
INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
  VALUES ('${userId}', ${q(a.name)}, ${q(a.email)}, true, now(), now())
  ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "email_verified" = true, "updated_at" = now();
DELETE FROM "account" WHERE "provider_id" = 'credential'
  AND "user_id" = (SELECT "id" FROM "user" WHERE "email" = ${q(a.email)});
INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
  SELECT '${stableUuid(`account:${a.email}`)}', u."id", 'credential', u."id", '${hash}', now(), now()
  FROM "user" u WHERE u."email" = ${q(a.email)};
INSERT INTO "team_member" ("team_id", "user_id", "role")
  SELECT '${TEAM.id}', u."id", '${a.role}' FROM "user" u
  WHERE u."email" = ${q(a.email)}
    AND NOT EXISTS (SELECT 1 FROM "team_member" tm WHERE tm."team_id" = '${TEAM.id}' AND tm."user_id" = u."id");`)
  }

  return header("03 · Cuentas de prueba y equipo Neo", `BEGIN;\n${lines.join("\n")}\nCOMMIT;`)
}

// ─── 04 · Ejercicios ──────────────────────────────────────────────────────────

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

function buildExercises(dataset: DatasetExercise[]): string {
  const adminId = `(SELECT "id" FROM "user" WHERE "email" = ${q(ADMIN_EMAIL)})`
  const lines: string[] = []

  for (const ex of dataset) {
    if (!ex.youtube_verified || !ex.youtube_id) throw new Error(`Ejercicio sin video verificado: ${ex.name}`)
    const id = exerciseUuid(ex.name)
    const difficulty = ex.level === "pre-beginner" ? "beginner" : ex.level
    const pattern = PATTERN_MAP[ex.category]

    lines.push(`
-- ${ex.name}
INSERT INTO "exercise" ("id", "name", "description", "difficulty", "movement_patterns", "youtube_video_id", "youtube_title", "video_orientation", "is_public", "owner_user_id", "created_by")
  VALUES ('${id}', ${q(ex.name)}, ${q(ex.description_es)}, '${difficulty}', '{${pattern}}', '${ex.youtube_id}', ${q(ex.youtube_title ?? null)}, '${ex.orientation}', true, ${adminId}, ${adminId})
  ON CONFLICT DO NOTHING;`)

    const seen = new Set<string>()
    ex.muscle_groups.forEach((slug, i) => {
      const mapped = MUSCLE_MAP[slug]
      if (!mapped) throw new Error(`Músculo sin mapear: ${slug}`)
      const key = mapped.join("/")
      if (seen.has(key)) return
      seen.add(key)
      const role = i < 2 ? "primary" : "secondary"
      lines.push(`INSERT INTO "exercise_muscle" ("exercise_id", "muscle_id", "role")
  SELECT '${id}', m."id", '${role}' FROM "muscle" m JOIN "muscle_group" g ON g."id" = m."muscle_group_id"
  WHERE m."name" = ${q(mapped[1])} AND g."name" = ${q(mapped[0])} AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '${id}')
  ON CONFLICT DO NOTHING;`)
    })

    for (const eqName of new Set(ex.equipment.map((e) => EQUIPMENT_MAP[e]).filter((e): e is string => !!e))) {
      lines.push(`INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id")
  SELECT '${id}', e."id" FROM "equipment" e
  WHERE e."name" = ${q(eqName)} AND e."is_global" = true AND e."created_by" IS NULL AND EXISTS (SELECT 1 FROM "exercise" WHERE "id" = '${id}')
  ON CONFLICT DO NOTHING;`)
    }
    for (const e of ex.equipment) {
      if (!(e in EQUIPMENT_MAP)) throw new Error(`Equipamiento sin mapear: ${e}`)
    }
  }

  lines.push("\n" + buildDemoRoutine(dataset))
  return header("04 · 100 ejercicios de calistenia (YouTube) + rutina de ejemplo", `BEGIN;\n${lines.join("\n")}\nCOMMIT;`)
}

function buildDemoRoutine(dataset: DatasetExercise[]): string {
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
        exercises: dataset.filter((d) => d.category === "core").slice(0, 2).map((d, i) => ({
          id: stableUuid(`demo:block:${i}`), exerciseId: pick(d.name), order: 4 + i, sets: time(30, 1),
        })),
      },
    ],
  }

  return `-- Rutina de ejemplo del equipo Neo
INSERT INTO "routine" ("id", "name", "team_id", "created_by", "category", "content")
  SELECT '${stableUuid("routine:demo")}', 'rutina de ejemplo', '${TEAM.id}', u."id", 'training', ${q(JSON.stringify(content))}::jsonb
  FROM "user" u WHERE u."email" = ${q(ADMIN_EMAIL)}
  ON CONFLICT ("id") DO NOTHING;`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const dataset = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "calisthenics-exercises.json"), "utf8"),
  ) as DatasetExercise[]

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
