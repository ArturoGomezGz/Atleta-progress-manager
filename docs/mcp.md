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

Código en `apps/api/src/mcp/tools/*.ts`; vistas compactas en `mcp/format.ts`. Cada herramienta llama a los
procedimientos tRPC con el caller del usuario (mismas reglas que la web). `createMcpServer` (`mcp/server.ts`)
publica además `instructions` en español con el flujo recomendado y la regla "confirma con el usuario antes de
guardar, asignar, cancelar o archivar".

**Convenciones**
- `teamId?`: si se omite se usa el único equipo donde el usuario es coach (en lecturas de miembro, su único
  equipo); si hay varios, `AMBIGUOUS_TEAM` con la lista.
- Fechas `YYYY-MM-DD`; "hoy" es UTC (lo devuelve `whoami.today`).
- Toda escritura sobre una rutina devuelve `updatedAt` (ISO) para encadenarlo como `expectedUpdatedAt`.
- R = scope `atleta:read`, W = `atleta:write`. Sin el scope la herramienta no aparece en `tools/list` y, si se
  llama igual, responde `INSUFFICIENT_SCOPE`. Anotaciones: `readOnlyHint` en las R, `destructiveHint` en las que
  borran, archivan o cancelan, `openWorldHint: false` en todas.
- Toda W cuenta para el límite de escrituras (30/min por usuario); `create_exercise` (10/h) y `assign_routine`
  (20/h) tienen además el suyo. Pasarlo devuelve `RATE_LIMITED` con `details.retryAfterSeconds`.

| Herramienta | Scope / rol | Entrada | Salida |
|---|---|---|---|
| `whoami` | R | `{}` | `{user{id,name,email}, teams[{teamId,name,role,selfAthlete}], defaultTeamId, features[], scopes[], today, limits{maxItems,maxBlockExercises,maxSets,maxPlanWeeks}}` |
| `list_athletes` | R, coach | `{teamId?}` | `{teamId, athletes[{athleteId,name,role,selfAthlete}], groups?[{groupId,name,athleteIds}]}`; sin correos; `groups` solo con el flag `groups` |
| `search_exercises` | R, miembro | `{teamId?, query?≤80, movementPattern?, bodyZone?, difficulty?, warmupOnly?, avoid?≤8}` | `{teamId, results[≤12]{id,name,difficulty,patterns,equipment,primaryMuscles,warmup?,contraindications?}}` |
| `get_exercises` | R | `{teamId?, ids[1..30]}` | `{exercises[{id,name,description,difficulty,patterns,equipment,muscles,contraindications,videoUrl}], notFound[]}` |
| `create_exercise` | W, coach | `{teamId?, name 2..80, description≤400, difficulty, movementPatterns[≤4], contraindications?}` | `{id, name, teamId, existed}` (si ya hay uno visible con ese nombre lo devuelve) |
| `list_routines` | R, miembro | `{teamId?, category?, query?, includeArchived?, limit?≤100=50}` | `{teamId, total, routines[{id,name,category,updatedAt,archived,itemCount,exerciseCount}]}` (más reciente primero) |
| `get_routine` | R | `{routineId, format?: "outline" o "detail"}` | `{id,teamId,name,category,updatedAt,archived,itemCount,exerciseCount}` + `items` (outline) o `content` + `exerciseNames` (detail) |
| `create_routine` | W, coach | `{teamId?, name 1..120, category?="training", content?: RoutineContentInput}` | `{routineId, teamId, name, updatedAt, itemCount}` |
| `update_routine` | W, coach | `{routineId, expectedUpdatedAt, name?, content?}` (al menos uno) | `{routineId, name, updatedAt, itemCount}`; `CONFLICT` |
| `edit_routine` | W, coach | `{routineId, expectedUpdatedAt?, ops[1..25]}` (operaciones `{op, …}` del editor) | `{routineId, updatedAt, changes[{type,itemId,summary}]}`; atómica |
| `add_exercise`, `replace_exercise`, `remove_item`, `move_item`, `update_sets`, `update_item_fields`, `update_block`, `adjust_difficulty`, `adjust_rest` | W, coach | `{routineId, expectedUpdatedAt?}` + la entrada de la habilidad | `{routineId, updatedAt, saved, result, message?, changes[]}` |
| `duplicate_routine` | W, coach | `{routineId, name?}` | `{routineId, name, updatedAt}` |
| `archive_routine` | W, coach, destructiva | `{routineId, archived?=true}` | `{routineId, archived, updatedAt}` |
| `assign_routine` | W, coach | `{routineId, athleteIds[1..50], dates?[1..60]}` | `{routineId, teamId, athleteIds, sessions[{sessionId,date,status}]}` |
| `list_assignments` | R, miembro | `{teamId?, athleteId?, from?, to?, status?[], planAssignmentId?, limit?≤100=50}` | `{teamId, today, assignments[{sessionId,routineId,routineName,scheduledDate,startedAt,status,planAssignmentId,athletes?}]}` |
| `cancel_assignment` | W, coach, destructiva | `{sessionId, athleteId?}` | `{sessionId, cancelled: "session" o "athlete"}` |
| `search` | R | `{query}` | `{results[{id,title,url}]}` con ids `routine:<uuid>` / `exercise:<uuid>` |
| `fetch` | R | `{id}` | `{id, title, text, url, metadata}` |

Las herramientas de planes (`list_plans`, `get_plan`, `create_plan`, `update_plan`, `duplicate_plan`,
`schedule_plan`, `cancel_plan_assignment`) se describen en "Planes de entrenamiento".

**Rutinas**
- `get_routine` "outline" da elementos legibles (`position` desde 0, `id` del elemento, `exerciseId`, nombre y
  series resumidas como "3 × 8 reps @ RPE 7"); "detail" da `content` exactamente en el formato de entrada
  (`toContentInput`), listo para modificar y enviar a `update_routine`, conservando los ids.
- Las ediciones guardan directamente (no hay borrador). `expectedUpdatedAt` es obligatorio en `update_routine`
  y opcional en `edit_routine` y las habilidades: si no coincide con la rutina falla con `CONFLICT`
  (`details.updatedAt` = versión vigente) antes de editar; sin él se usa el `updatedAt` recién leído.
  `routines.updateContent` vuelve a comprobarlo con la fila bloqueada (`SELECT … FOR UPDATE`), así que dos
  escrituras simultáneas con la misma versión no se pisan: una gana y la otra recibe `CONFLICT`.
- `edit_routine` aplica todas las operaciones sobre una copia (`applyEdits`) y guarda una sola vez; si una falla
  responde `BAD_REQUEST` con "Operación N (op): …" y `details.opIndex`, sin cambiar nada.
- Los `exerciseId` nuevos (en `create_routine`, `update_routine`, `add_exercise`, `replace_exercise`,
  `edit_routine`) deben ser visibles para el usuario (sistema, públicos, propios o de sus equipos): si no,
  `BAD_REQUEST`. En el conector se admiten `percent_rm` y `fixed_kg` (el coach dirige).
- Archivar saca la rutina de `list_routines` (salvo `includeArchived`) y `assign_routine` la rechaza
  (`BAD_REQUEST`); lo ya asignado no cambia. `archive_routine` con `archived: false` la restaura.
- Sin el flag `evaluation` el campo `category` solo admite `"training"` (el JSON Schema lo refleja) y las
  rutinas de evaluación no se ven.

**Habilidades del editor.** Las nueve herramientas de edición y ajuste se generan del registro de habilidades
(`services/ai-routine-editor/adapters/mcp.ts`): mismo nombre que la habilidad, misma descripción y mismo zod
(incluido el `refine` de `adjust_rest`). Se ejecutan con `createRuntime` sobre la rutina guardada; una
compuesta sin margen no escribe (`saved: false`). No exigen `ai_routine_tweaks` (no hay LLM interno). Detalle
y decisiones en [habilidades-ia-rutinas.md](habilidades-ia-rutinas.md) §5.

**Asignados**
- `assign_routine` toma el equipo de la rutina. Sin `dates` crea una sesión disponible ya
  (`sessions.create`); con `dates`, una por fecha en una transacción (`sessions.createMany`): hoy o antes queda
  activa y las futuras programadas, que requieren `scheduled_sessions`. Atletas de otro equipo → `BAD_REQUEST`.
- `list_assignments`: el coach ve los atletas de cada sesión y puede filtrar por `athleteId`; un atleta solo
  consulta sus propias sesiones (se ignora `athleteId`) y sin la lista de atletas.
- `cancel_assignment` cancela la sesión entera; con `athleteId`, solo a ese atleta (como en la web, solo en
  sesiones de evaluación; en entrenamiento → `BAD_REQUEST`).

**search / fetch** (forma que espera ChatGPT): `search` busca por nombre en las rutinas de los equipos del
usuario y en el catálogo visible; `fetch` devuelve la rutina o el ejercicio como texto, con `url` a la web.
Otros módulos pueden sumar tipos de id con `addSearchFetchProvider(server, {kind, search?, fetch})`
(`tools/search-fetch.ts`), p. ej. `plan:<uuid>`.

## Resources y prompts (Paquete C)

Resources (`mcp/resources.ts`, solo con `atleta:read`):

| URI | Contenido |
|---|---|
| `atleta://guia/contenido-rutina` | Markdown: formato de `RoutineContentInput` con ejemplo y su JSON Schema (`zod-to-json-schema`) |
| `atleta://guia/programacion` | Markdown: RPE / % RM / kg, tempo E-P-C-P, perSide, objetivos, circuitos, límites seguros de `difficulty.ts`, calendario (semana lunes–domingo) y "confirma antes de escribir" |
| `atleta://rutinas/{routineId}` | JSON igual a `get_routine` (outline); errores como `"<CÓDIGO>: mensaje"` |

La plantilla `atleta://planes/{planId}` y el prompt `planificar_mesociclo` pertenecen a planes.

Prompts (`mcp/prompts.ts`; argumentos de texto):

| Prompt | Argumentos | Flujo |
|---|---|---|
| `crear_entrenamiento` | `objetivo`, `duracion_minutos?`, `nivel?`, `equipamiento?` | whoami → guías → search_exercises (con `avoid`) → propuesta en texto → confirmación → create_routine |
| `ajustar_entrenamiento` | `routine_id`, `cambio` | get_routine → herramienta más acotada (o edit_routine) → confirmación → guardar con `expectedUpdatedAt` (reintentar si `CONFLICT`) |
| `revisar_adherencia` | `athlete_id?`, `desde?` | whoami / list_athletes → list_assignments → resumen por atleta, sin modificar nada |

Los dos primeros solo se ofrecen con `atleta:write`.

**Pruebas de este paquete.** Unitarias: `test/mcp/server.test.ts` (`createMcpServer` completo con un caller
falso: scopes, flags, errores, edición atómica, resources y prompts), `test/mcp/format.test.ts` y
`test/services/ai-routine-editor/mcp-adapter.test.ts`. Integración: `tools-routines`, `tools-assignments` y
`multitenant.itest.ts`, con `test/integration/mcp-inmemory.ts → mcpClientFor(user)`: el `Client` del SDK
conectado por `InMemoryTransport` a `createMcpServer` con un contexto real (principal del usuario,
`createMcpCaller`, flags reales y limitadores inyectables), sin pasar por `/mcp`.

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
