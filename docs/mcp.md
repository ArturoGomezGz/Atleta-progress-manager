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

Un plan es una plantilla de 1 a 16 semanas. Cada semana tiene **huecos** (entrenamientos) por día, y cada
hueco apunta a una rutina del equipo. Programar el plan a atletas crea asignados normales con fecha: el
atleta los ve en "Hoy" y en `sessions.myPending` igual que cualquier asignado. Todo está detrás del flag
`training_plans`, que requiere `scheduled_sessions`. Esquema en `base-de-datos.md` ("Planes de entrenamiento").

**Código:**

| Archivo | Qué es |
|---|---|
| `services/plan-calendar.ts` | Puro: `isoWeekday`, `mondayOf`, `addDays`, `workoutDate`, `computePlanCalendar` |
| `services/training-plan-input.ts` | Puro (zod): schemas, shapes de las herramientas y límites |
| `services/training-plans.ts` | `listPlans`, `getPlan`, `createPlan`, `updatePlan`, `duplicatePlan`, `schedulePlan`, `cancelPlanAssignment` (aplican `assertCoach` / `assertMember`) |
| `routers/plans.ts` | `plans.list/get` (query) y `plans.create/update/duplicate/schedule/cancelAssignment` (mutation), todos con `featureProcedure("training_plans")` |
| `mcp/tools/plans.ts` | `registerPlanTools`: las 7 herramientas (llaman a `plans.*` con el caller del usuario) y el prompt `planificar_mesociclo` |

### Calendario

- `weekday` es ISO: 1 = lunes … 7 = domingo.
- La semana 1 es la semana (lunes a domingo) que contiene `startDate`.
- Fecha de un hueco = `lunesDe(startDate) + (semana − 1)·7 + (weekday − 1)`.
- Varios entrenamientos el mismo día se ordenan por `position`, que se asigna en el orden en que llegan. Si
  se agregan después, van al final del día.
- Se omiten y se reportan en `skipped`, con esta prioridad:
  1. `before_start`: el hueco cae antes de `startDate` (por ejemplo, si se empieza a mitad de semana).
  2. `past`: el hueco cae antes de hoy.
  3. `no_routine`: el hueco no tiene rutina (se borró la rutina).
- "Hoy" es UTC, igual que en `sessions.create`. Un hueco con fecha de hoy queda activo y uno futuro queda
  programado. En los dos casos el atleta empieza su sesión.

### Reglas

- **Rutinas:** solo de entrenamiento, del mismo equipo y no archivadas. Si no, `BAD_REQUEST`, sin revelar si
  la rutina existe en otro equipo. Se valida al crear y al editar el plan, y otra vez al programarlo (una rutina
  archivada después bloquea la programación, también en `dryRun`).
- **Rutinas nuevas dentro del plan:** `routines[{key, name, content}]`, con el mismo formato que
  `create_routine` (`routine-content-input.ts`). Sus ejercicios tienen que ser visibles para quien edita. Los
  huecos las referencian con `routineKey`. Cada hueco lleva **exactamente uno** de `routineId` o `routineKey`.
- **Límites:**

  | Qué | Máximo |
  |---|---|
  | Semanas | 16 |
  | Huecos por plan | 112 |
  | Rutinas nuevas por llamada | 30 |
  | Atletas por programación | 50 |
  | Sesiones de atleta por programación (huecos programados × atletas) | 200 |
  | Nombre del plan / de una rutina nueva | 120 caracteres |
  | Descripción | 2000 caracteres |
  | Objetivo | 300 caracteres |
  | Semana: nombre / enfoque / notas | 60 / 120 / 500 caracteres |
  | Notas de un hueco | 300 caracteres |
  | `key` de una rutina nueva | 40 caracteres |

- **Escrituras en una transacción:** `create`, `update`, `duplicate`, `schedule` y `cancelAssignment`. Si algo
  falla, no se guarda nada.
- **Concurrencia:** `update` exige `expectedUpdatedAt` (el `updatedAt` de la última lectura o escritura). Corre
  con `SELECT … FOR UPDATE` y, si el plan cambió, falla con `CONFLICT` y devuelve `details.updatedAt`.
- **Reducir semanas** solo se permite si no quedan huecos en las semanas que se quitan. En la misma llamada
  se pueden quitar con `removeWorkoutIds` o `replaceWorkouts`. El nombre, el enfoque y las notas de esas
  semanas se borran con ellas.
- **Estado del plan** (`draft` / `active` / `archived`): lo cambia el coach con `update_plan`. Un plan nuevo o
  duplicado nace en `draft`. Programar no cambia el estado. Un plan `archived` no se puede programar y no
  aparece en `list_plans` salvo con `includeArchived`.
- **Programar:** crea un `training_plan_assignment` y, por cada hueco programable, un `training_session` con
  todos los atletas, usando `createAssignedSessions`. El snapshot de contenido es idéntico al de
  `sessions.create`. Cada sesión guarda `plan_assignment_id` y `plan_workout_id`. Solo atletas del equipo
  (o el coach con auto-entrenamiento). Con `dryRun: true` calcula lo mismo sin escribir nada y devuelve
  `assignmentId: null`.
- **Lo ya programado no cambia:** editar el plan o sus rutinas no modifica las sesiones ya creadas (igual que un
  asignado suelto). `replaceWorkouts` o `removeWorkoutIds` dejan esas sesiones con `plan_workout_id = null`,
  pero conservan `plan_assignment_id`.
- **Cancelar:** `cancelAssignment` cancela (`training_session.status = cancelled`, igual que `sessions.cancel`)
  solo las sesiones que ningún atleta empezó: las que ya están en curso o completadas se conservan. Con
  `fromDate`, solo cancela desde esa fecha y la asignación sigue activa. Sin `fromDate`, la asignación pasa a
  `cancelled`.
- **Lectura:** `list` y `get` están abiertos a cualquier miembro del equipo. Las asignaciones (atletas y avance)
  solo las ve el coach; el atleta recibe `assignments: []`.

### Herramientas

Todas exigen el flag `training_plans`. Las de lectura usan el scope `atleta:read` y las de escritura
`atleta:write`. Con `teamId` omitido se usa el único equipo donde el usuario es coach (en `list_plans` vale
cualquier rol).

| Herramienta | Input | Output |
|---|---|---|
| `list_plans` (R) | `{teamId?, includeArchived?}` | `{teamId, plans[{planId, name, goal, weeks, status, workoutCount, activeAssignments, updatedAt}]}` |
| `get_plan` (R) | `{planId}` | `{planId, teamId, name, description, goal, weeks, status, createdAt, updatedAt, schedule[{week, name, focus, notes, days[{weekday, workouts[{workoutId, position, routineId, routineName, notes}]}]}], assignments[{assignmentId, startDate, status, createdAt, cancelledAt, athletes[{athleteId, name}], sessions{total, completed, cancelled}}]}` |
| `create_plan` (W, coach) | `{teamId?, name, description?, goal?, weeks, weekMeta?[{week, name?, focus?, notes?}], routines?[{key, name, content}], workouts[{week, weekday, routineId? \| routineKey?, notes?}]}` | `{planId, updatedAt, createdRoutines[{key, routineId}], workoutCount}` |
| `update_plan` (W, coach, destructiva) | `{planId, expectedUpdatedAt, name?, description?, goal?, weeks?, status?, weekMeta?, routines?, addWorkouts?, removeWorkoutIds?, replaceWorkouts?}` (`null` borra `description`, `goal` o un campo de `weekMeta`; `replaceWorkouts` no se combina con `addWorkouts` ni `removeWorkoutIds`) | `{planId, updatedAt, createdRoutines, workoutCount}`; `CONFLICT` |
| `duplicate_plan` (W, coach) | `{planId, name?, copyRoutines?=false}` | `{planId, name, updatedAt, workoutCount, createdRoutines[{sourceRoutineId, routineId, name}]}` |
| `schedule_plan` (W, coach) | `{planId, athleteIds[1..50], startDate, dryRun?=false}` | `{assignmentId \| null, dryRun, startDate, athleteIds, sessions[{date, week, weekday, position, workoutId, routineId, routineName, sessionId?, status?}], skipped[{workoutId, week, weekday, reason}]}` |
| `cancel_plan_assignment` (W, coach, destructiva) | `{assignmentId, fromDate?}` | `{assignmentId, status, cancelledSessions, keptSessions}` |

Notas:
- `schedule_plan` sin `dryRun` cuenta para el límite de asignaciones (`limiters.schedule`, 20 por hora,
  compartido con `assign_routine`). Pasarlo devuelve `RATE_LIMITED`. `dryRun` no cuenta.
- El `CONFLICT` de `update_plan` sugiere releer con `get_plan`: la herramienta reemplaza el mensaje genérico
  de `errors.ts`, que menciona `get_routine`.
- Las reglas cruzadas (key inexistente o repetida, semana fuera del plan, sin cambios) las valida el schema del
  router y vuelven como `INVALID_INPUT`.

### Prompt `planificar_mesociclo`

- **Argumentos:** `{objetivo, semanas, dias_por_semana, nivel?, equipamiento?, fecha_inicio?, atletas?}`.
  Todos son texto, porque los argumentos de un prompt MCP siempre son strings.
- **Cuándo se registra:** solo si el principal tiene `atleta:write` y el flag `training_plans`.
- **Flujo que propone:**
  1. `whoami`
  2. `list_athletes`
  3. `search_exercises` / `list_routines`
  4. Propuesta y confirmación del usuario.
  5. `create_plan` con `routines[]` y `routineKey`.
  6. `schedule_plan` con `dryRun: true`.
  7. Confirmación del usuario.
  8. `schedule_plan`.
- **Regla que incluye:** no guardar, asignar ni archivar nada sin confirmación.

### Pruebas

- **Unitarias:**
  - `test/services/plan-calendar.test.ts`: alineación al lunes, inicio a mitad de semana, `past`,
    `no_routine`, cambio de año, 29 de febrero de 2028 y orden por `position`.
  - `test/services/training-plan-input.test.ts`: exactamente uno de `routineId` / `routineKey`, límites y
    reglas cruzadas.
- **Integración:** `test/integration/plans.itest.ts`, con un `McpServer` en memoria que solo registra las
  herramientas de planes y un `McpToolContext` real. Cubre:
  - El flujo `create_plan` (4 semanas × 3 días, rutinas por key) → `get_plan` → `schedule_plan` con `dryRun`
    (comprueba que no escribe) → programación real (fechas, `plan_assignment_id` / `plan_workout_id`,
    estados, snapshot y `myPending` del atleta) → `cancel_plan_assignment` desde una fecha y después completo.
  - `CONFLICT` y reducción de semanas, `duplicate_plan`.
  - Multi-tenant, rutinas de evaluación o archivadas, tasa y scope de solo lectura.
  - Flags: sin `training_plans`, o sin `scheduled_sessions`.

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
