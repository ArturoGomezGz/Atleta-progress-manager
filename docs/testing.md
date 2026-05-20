# Testing

Estrategia de pruebas automatizadas del monorepo. Cubre tres capas: unitaria, integración y E2E. Todas corren en GitHub Actions en cada PR y push a `master`.

---

## Stack de pruebas

| Capa | Herramienta | Scope |
|---|---|---|
| **Unitaria** | Vitest | Funciones puras, schemas Zod, lógica de negocio sin IO |
| **Integración** | Vitest + `createCallerFactory` (tRPC) | Procedimientos tRPC contra una PostgreSQL real de test |
| **E2E** | Playwright *(pendiente)* | Flujos completos UI + API |
| **Cobertura** | `@vitest/coverage-v8` | Reporte `lcov` + consola |

---

## Estructura de archivos

```
apps/api/
├── src/
│   ├── lib/
│   │   └── epley.ts                        # Fórmula Epley — función pura testeable
│   └── __tests__/
│       ├── global-setup.ts                 # Corre migraciones una vez antes de todos los tests
│       ├── setup.ts                        # Mocks globales (Anthropic SDK, servicios externos)
│       ├── helpers/
│       │   ├── caller.ts                   # Factories tRPC con sesiones mock
│       │   ├── db.ts                       # Limpieza de tablas entre tests (truncateAll)
│       │   └── seed.ts                     # Inserción de datos mínimos de prueba
│       ├── unit/
│       │   ├── epley.test.ts               # Fórmula de 1RM
│       │   └── schemas.test.ts             # Validación de schemas Zod
│       └── integration/
│           ├── teams.test.ts
│           ├── sessions.test.ts
│           ├── routines.test.ts
│           └── rms.test.ts
├── vitest.config.ts
└── package.json
.github/
└── workflows/
    └── test.yml                            # CI: PostgreSQL service + pnpm + vitest
```

---

## Correr tests localmente

### Requisitos previos

1. Docker corriendo con la BD de test, **o** una instancia PostgreSQL local con una DB llamada `atleta_test`.

```bash
# Opción A — crear la DB en una instancia PostgreSQL existente
psql -U postgres -c "CREATE DATABASE atleta_test;"
```

2. Definir la variable de entorno `DATABASE_URL_TEST`:

```bash
# Exportar en la shell o agregar a .env.test (no committed)
export DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/atleta_test
```

### Comandos

```bash
# Todos los tests (unit + integración)
pnpm --filter @atleta/api test

# Con reporte de cobertura
pnpm --filter @atleta/api test:coverage

# Modo watch (desarrollo)
pnpm --filter @atleta/api test:watch

# Solo tests unitarios
pnpm --filter @atleta/api test src/__tests__/unit

# Solo integración
pnpm --filter @atleta/api test src/__tests__/integration
```

> Las migraciones se aplican automáticamente a `atleta_test` al inicio de cada ejecución — no es necesario correrlas manualmente.

---

## Capas de prueba

### 1. Unitaria — funciones puras

Sin base de datos ni red. Prueba lógica extraída a módulos puros en `src/lib/`.

**Qué se prueba:**
- `epley(weightLbs, reps)` — fórmula de estimación de 1RM
- Validación de schemas Zod (`routineContentSchema`, `routineSetSchema`, etc.)
- Helpers de transformación de datos

**Convención:** un test unitario no puede importar `@atleta/db/client` ni hacer llamadas de red.

```ts
// src/__tests__/unit/epley.test.ts
import { epley } from "../../lib/epley"

it("100 lbs x 5 reps produce 1RM de aprox 116.67", () => {
  expect(epley(100, 5)).toBeCloseTo(116.67, 1)
})
```

---

### 2. Integración — procedimientos tRPC

Cada test llama a un procedimiento tRPC directamente (sin HTTP) usando `createCallerFactory`. La base de datos es real (`atleta_test`). Cada test empieza con tablas limpias gracias a `truncateAll()` en `beforeEach`.

**Patrón estándar:**

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { makeCaller, makeAnonymousCaller } from "../helpers/caller"
import { truncateAll } from "../helpers/db"
import { seedUser, seedTeam } from "../helpers/seed"

describe("teams.create", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("crea un equipo y asigna al creador como coach", async () => {
    const coach = await seedUser()
    const caller = makeCaller(coach)

    const result = await caller.teams.create({ name: "Equipo A" })

    expect(result.name).toBe("Equipo A")
  })

  it("lanza UNAUTHORIZED sin sesion", async () => {
    const caller = makeAnonymousCaller()
    await expect(caller.teams.create({ name: "X" })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})
```

**Helpers disponibles:**

| Helper | Descripción |
|---|---|
| `makeCaller(user)` | Caller tRPC con sesión de usuario autenticado |
| `makeAnonymousCaller()` | Caller sin sesión (para probar `UNAUTHORIZED`) |
| `truncateAll()` | Limpia todas las tablas de negocio en cascade |
| `seedUser(overrides?)` | Inserta un usuario en la tabla `user` |
| `seedTeam(creatorId)` | Crea un equipo y asigna al creador como coach |
| `addAthlete(teamId, userId)` | Añade un usuario como atleta al equipo |
| `seedExercise(overrides?)` | Crea un ejercicio sin dueño |
| `seedRoutine(teamId, creatorId, opts?)` | Crea una rutina con contenido opcional |

**Servicios externos mockeados globalmente en `setup.ts`:**
- Anthropic SDK — evita llamadas reales a la API de IA
- Cloudflare Stream — mockeado con respuestas vacías

---

### 3. E2E — Playwright *(pendiente)*

Segunda fase. Cubrirá los flows críticos end-to-end:
- Registro → login → crear equipo
- Crear rutina → iniciar sesión → registrar series → completar
- Flujo de evaluación → verificar 1RM generado automáticamente

---

## Cobertura de procedimientos

| Router / módulo | Procedimientos cubiertos | Estado |
|---|---|---|
| `teams` | `create`, `generateInviteLink`, `joinViaInvite`, `removeMember`, `updateMemberRole` | ✅ |
| `sessions` | `create`, `activate`, `recordSet`, `complete`, `cancel`, `completeMySession` | ✅ |
| `routines` | `create`, `updateContent`, `rename`, `delete` | ✅ |
| `rms` | `listByAthlete`, `setManual`, `exerciseReport` | ✅ |
| `exercises` | `create`, `update`, `delete`, `list` | 🔜 |
| `groups` | CRUD básico | 🔜 |
| `preferences` | `get`, `update` | 🔜 |
| `lib/epley` | Todos los casos limite | ✅ |

---

## GitHub Actions

El workflow `.github/workflows/test.yml` corre automáticamente en:
- Cada `push` a `master` o `testing`
- Cada Pull Request hacia `master`

**Pasos del workflow:**
1. Levanta un servicio PostgreSQL 16 nativo de GitHub Actions
2. Instala dependencias con `pnpm install --frozen-lockfile`
3. Ejecuta `pnpm --filter @atleta/api test:coverage`
4. Sube el reporte de cobertura como artifact descargable

**Variables de entorno en CI:**

| Variable | Valor |
|---|---|
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@localhost:5432/atleta_test` |

> `ANTHROPIC_API_KEY` y `CLOUDFLARE_*` no son necesarios en CI porque los servicios externos estan mockeados globalmente.

---

## Convenciones

### Nomenclatura de tests

```
describe("<router>.<procedimiento>", () => {
  it("<descripcion de lo que debe pasar en caso feliz>", ...)
  it("falla con <CODIGO_ERROR> cuando <condicion>", ...)
})
```

### Aislamiento

- Cada test es completamente independiente.
- Siempre incluir `beforeEach(truncateAll)` en tests de integración.
- No reutilizar IDs hardcodeados entre tests — los helpers de seed generan UUIDs únicos.
- No usar `afterEach` para cleanup manual: `truncateAll` en `beforeEach` es suficiente y más seguro.

### Assertions de errores tRPC

```ts
// Correcto — verifica el codigo de error del dominio
await expect(caller.teams.create({ name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" })

// Evitar — demasiado acoplado al mensaje exacto (puede cambiar)
await expect(...).rejects.toThrow("El equipo ha alcanzado el limite")
```

### Lógica de negocio pura

Antes de agregar lógica calculada inline en un router (fórmulas, transformaciones), extraerla a `src/lib/` y cubrirla con tests unitarios. La fórmula Epley es el ejemplo de referencia.

---

## Proceso al agregar funcionalidades

1. Si introduces lógica pura → agregar test en `src/__tests__/unit/`
2. Si agregas o cambias un procedimiento tRPC → actualizar `src/__tests__/integration/<router>.test.ts`
3. Cubrir siempre: caso feliz + casos de autorización (coach vs atleta, sin sesión)
4. Correr `pnpm --filter @atleta/api test:coverage` y verificar que la cobertura no baje
5. Actualizar la tabla de cobertura en este documento si es necesario
