# Conector MCP (Model Context Protocol)

Permite que un asistente de IA externo (Claude.ai, Claude Desktop, Claude Code, ChatGPT, MCP Inspector…)
lea y modifique los datos de un coach en Atleta: catálogo de ejercicios, rutinas, asignados y planes
multi-semana. Está detrás del flag `mcp` (ver `feature-flags.md`); los planes, además, del flag
`training_plans`.

> Estado: en construcción. Este documento se llena por paquetes de trabajo: **A** (fundaciones, hecho),
> **B** (OAuth, PAT, HTTP y UI web), **C** (herramientas, resources y prompts) y **D** (planes).

---

## Arquitectura (Paquete A)

- **Servidor:** `@modelcontextprotocol/sdk` v1, transporte Streamable HTTP en `POST /mcp` del mismo Fastify
  de la API, **stateless** (un `McpServer` y un transporte por request; respuestas JSON).
- **App:** `apps/api/src/app.ts` exporta `buildApp()` (CORS, proxy de better-auth, Telegram, tRPC). `index.ts`
  solo corre migraciones, llama a `buildApp()` y hace `listen`. Los tests de integración levantan la misma app.
- **Reutilización:** las herramientas no duplican reglas de negocio. Llaman a los procedimientos tRPC con
  `createCaller` (`routers/index.ts`) y una **sesión sintética** del usuario (`mcp/context.ts → callerSession`),
  así pasan por los mismos `assertCoach` / `assertMember` / `assertFeature` que la web.
- **Servicios compartidos** (`apps/api/src/services/`), usados por routers y herramientas:
  - `exercise-visibility.ts`: único criterio de "qué ejercicios puede ver/usar un usuario"
    (`exerciseVisibilityWhere`, `canViewExercise`, `assertExercisesVisible`).
  - `routine-content-input.ts`: entrada amigable de contenido de rutina (ver abajo).
  - `session-assign.ts`: `assertAssignableAthletes` y `createAssignedSessions` (cuerpo de `sessions.create`,
    también usado por `sessions.createMany` y por la programación de planes).

### Contrato interno (`apps/api/src/mcp/`)

| Archivo | Qué es |
|---|---|
| `types.ts` | `McpScope` (`atleta:read` \| `atleta:write`), `McpPrincipal`, `AppCaller`, `McpToolContext`, `McpLimiters` |
| `tool.ts` | `registerAtletaTool(server, ctx, def)`: no registra si falta el scope o el flag; revalida el scope en el handler; valida con zod (`INVALID_INPUT`); límite de escrituras; una línea de log por llamada; errores con `toToolError` |
| `errors.ts` | `toToolError`, `McpToolError`, `ErrorDetails` (datos extra como `cause` de un `TRPCError`) |
| `context.ts` | `callerSession`, `createMcpCaller`, `resolveTeamId` (equipo implícito o `AMBIGUOUS_TEAM`) |
| `server.ts` | `createMcpServer(ctx)`: registra `tools/*`, `resources.ts` y `prompts.ts` |
| `tools/*.ts` | `registerAccountTools`, `registerCatalogTools`, `registerRoutineTools`, `registerSkillTools`, `registerAssignmentTools`, `registerSearchFetchTools`, `registerPlanTools` |

### Errores de herramientas

Todo error vuelve como resultado `isError: true` con `content[0].text = "<CODE>: <mensaje>"` y
`structuredContent.error = { code, message, details? }`.

| Origen | Código |
|---|---|
| `TRPCError` `FORBIDDEN` / `UNAUTHORIZED` | `FORBIDDEN` |
| `TRPCError` `NOT_FOUND` | `NOT_FOUND` |
| `TRPCError` `BAD_REQUEST` / `PRECONDITION_FAILED`, `RoutineEditError` | `BAD_REQUEST` |
| `TRPCError` `CONFLICT` | `CONFLICT` ("Vuelve a leerla con get_routine y reintenta") |
| `TRPCError` `TOO_MANY_REQUESTS`, límites propios | `RATE_LIMITED` (`details.retryAfterSeconds`) |
| `ZodError` (o `BAD_REQUEST` con `ZodError` como causa) | `INVALID_INPUT` (3 issues como máximo) |
| Equipo implícito ambiguo | `AMBIGUOUS_TEAM` (`details.teams`) |
| Falta `atleta:write` | `INSUFFICIENT_SCOPE` |
| Cualquier otro | `INTERNAL` (sin mensaje interno en producción; `details.requestId`) |

Nunca se loguean tokens, argumentos ni contenido: solo `{ kind, userId, clientId|tokenId, tool, teamId?, ms, ok, code? }`.

### Contenido de rutina (`routine-content-input.ts`)

Entrada sin `id` obligatorio, sin `order` ni `setNumber`, con el atajo `sets: { count, …serie }`.
`normalizeRoutineContent(input)` genera ids (conserva los válidos no repetidos), numera, expande `count` y
valida con `routineContentSchema`; `toContentInput(content)` es la inversa (formato que `update_routine` acepta).

Límites: 20 elementos, 10 ejercicios por circuito, 12 series por ejercicio, rondas 2–20, JSON ≤ 60 000
caracteres. Por campo: reps 1–200, tiempo 1–3600 s, distancia 1–100 000 m, RPE 1–10, %RM 1–120, kg ≤ 1000
(`loadValue` exige `loadType`), descanso 1–600 s, notas ≤ 300, nombre de circuito ≤ 60, tempo `E-P-C-P`
(`[0-9X]`).

### Reglas de seguridad corregidas en A

- `exercises.get` solo devuelve un ejercicio si es del sistema, público, propio o de un equipo del usuario
  (antes cualquier ejercicio con equipo dueño era visible para todos).
- `routines.updateContent` exige que cada ejercicio **nuevo** del contenido sea visible para quien edita
  (sistema, público, propio o de alguno de sus equipos, como en el selector del editor); los que ya estaban
  se respetan. `BAD_REQUEST` si no.
- `sessions.create` / `createMany` exigen que la rutina sea del equipo indicado (`NOT_FOUND` si no) y que no
  esté archivada (`BAD_REQUEST`).

### Asignar en varias fechas: `sessions.createMany`

`{ routineId, teamId, athleteIds[1..50], dates[1..60] }` (fechas únicas): una sesión por fecha con los mismos
atletas, en una transacción, ordenadas por fecha. A diferencia de `create`, solo las fechas **futuras** exigen
`scheduled_sessions`; hoy o antes queda activa. "Hoy" es UTC, igual que `sessions.create`.

---

## Conexión (Paquete B)

_Pendiente: URL del conector, Claude.ai / Desktop, Claude Code, ChatGPT, mcp-remote, MCP Inspector._

## Autenticación (Paquete B)

_Pendiente: servidor de autorización OAuth 2.1 (`@better-auth/oauth-provider`, issuer `<WEB>/api/auth`),
discovery (PRM y metadata del AS), scopes, tokens personales (`atl_pat_…`), resolución del token._

## Seguridad (Paquete B)

_Pendiente: consentimiento obligatorio, PKCE S256, DCR, denylist del proxy, Origin/CORS, límites de tasa,
401/403/405/413/429._

## Herramientas (Paquete C)

_Pendiente: catálogo de herramientas (cuenta, catálogo, rutinas, habilidades, asignados, search/fetch)._

## Resources y prompts (Paquete C)

_Pendiente._

## Planes de entrenamiento (Paquete D)

_Pendiente: modelo semana/weekday ISO, `create_plan` → `schedule_plan` (dryRun) → `cancel_plan_assignment`._
Esquema en `base-de-datos.md` ("Planes de entrenamiento").

---

## Pruebas

- **Unitarias** (`pnpm --filter @atleta/api test`): sin red ni BD. Cubren `routine-content-input`, `errors`,
  `registerAtletaTool` (servidor en memoria con `InMemoryTransport`) y los flags.
- **Integración** (`pnpm --filter @atleta/api test:integration`, archivos `apps/api/test/integration/*.itest.ts`,
  `--test-concurrency=1`): API real contra Postgres. Sin `TEST_DATABASE_URL` se omiten con un aviso.
  - `scripts/test-db.sh` levanta un Postgres 16 (Docker `postgres:16-alpine` en el puerto 55432 o, sin
    Docker, los binarios de `/usr/lib/postgresql/16/bin` como usuario `postgres`) e imprime la URL;
    `scripts/test-db.sh stop` lo borra.
  - `setup.ts → startTestServer()` fija el entorno (puerto libre, `AUTO_VERIFY_EMAIL`, `SEED_DEMO_DATA`,
    flags por correo), **borra** los schemas `public` y `drizzle` (el nombre de la BD debe contener "test"),
    corre `runMigrations()` y levanta `buildApp()`.
  - `fixtures.ts → createFixtures()`: coach A (todos los flags) con su equipo y un atleta, coach B con otro
    equipo y un usuario sin flags; las cuentas se registran por HTTP y lo demás con el caller de cada usuario.
  - CI: `.github/workflows/api-tests.yml` (typecheck, unitarias e integración con un servicio `postgres:16`).

### Checklist manual en testing

_Pendiente (B/C): MCP Inspector, Claude.ai (conector personalizado, incluido login con Google), Claude Code
(`claude mcp add --transport http`), ChatGPT (developer mode), revocar desde `/settings/conectar-ia`._
