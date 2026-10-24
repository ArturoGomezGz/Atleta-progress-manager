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

La URL del conector es `MCP_RESOURCE_URL` (por defecto `${API_PUBLIC_URL}/mcp`, p. ej.
`https://api-production-85b2.up.railway.app/mcp`). La página **Cuenta → Conectar IA** (`/settings/conectar-ia`,
flag `mcp`) la muestra con botón de copiar (`mcp.connectionInfo`), junto con estas mismas instrucciones, los tokens
personales y las apps conectadas. Las instrucciones viven también en
`apps/web/src/app/(app)/settings/conectar-ia/connection-guide.tsx`: si un cliente renombra sus menús, actualizar ambos.

| Cliente | Cómo |
|---|---|
| Claude.ai / Claude Desktop | Configuración → Conectores → Agregar conector personalizado → nombre «Atleta» + URL → Conectar. Se abre Atleta para iniciar sesión (correo o Google) y aceptar los permisos. Desktop comparte los conectores de la cuenta. |
| Claude Code | `claude mcp add --transport http atleta <url>` y luego `/mcp` → atleta para iniciar sesión en el navegador. Sin navegador: `claude mcp add --transport http atleta <url> --header "Authorization: Bearer atl_pat_…"` con un token personal. |
| ChatGPT | Configuración → Aplicaciones y conectores → Configuración avanzada → activar el modo desarrollador; luego Crear → URL del conector, autenticación OAuth. Depende del plan. |
| mcp-remote (clientes solo stdio) | `{"command":"npx","args":["-y","mcp-remote","<url>"]}` (hace OAuth por su cuenta) o, con token: `"args":["-y","mcp-remote","<url>","--header","Authorization:${ATLETA_AUTH}"], "env":{"ATLETA_AUTH":"Bearer atl_pat_…"}`. |
| MCP Inspector | `npx @modelcontextprotocol/inspector`, transporte Streamable HTTP y la URL. Su origen (p. ej. `http://localhost:6274`) debe estar en `MCP_ALLOWED_ORIGINS`. |

## Autenticación (Paquete B)

Dos tipos de token, ambos como `Authorization: Bearer <token>` en `POST /mcp`:

| Token | Para quién | Dónde vive |
|---|---|---|
| `atl_oat_…` (OAuth, 1 h) + `atl_ort_…` (refresh, 30 días, con `offline_access`) | Claude.ai/Desktop, ChatGPT, Claude Code con `/mcp` | `oauth_access_token` / `oauth_refresh_token` (hash) |
| `atl_pat_…` (token personal) | Claude Code con `--header`, mcp-remote, scripts | `mcp_personal_token` (hash) |

### Servidor de autorización (OAuth 2.1)

`@better-auth/oauth-provider@1.6.9` (versión exacta) en `apps/api/src/auth.ts`. **Issuer: `${BETTER_AUTH_URL}/api/auth`**,
es decir, el origen **web**: la cookie de sesión es del dominio web (el web proxea `/api/auth/*`), así que login y
consentimiento ocurren ahí. El recurso protegido (`/mcp`) está en el origen de la API.

- Configuración: scopes `atleta:read`, `atleta:write`, `offline_access`; registro dinámico (DCR) **público** abierto
  (los conectores no tienen secret: un registro sin autenticar siempre queda `token_endpoint_auth_method: none`);
  grants `authorization_code` y `refresh_token` (sin `client_credentials`); `validAudiences` = URL del recurso (con y
  sin `/` final) para el parámetro `resource`; `disableJwtPlugin` → tokens **opacos** (revocar es inmediato);
  prefijos `atl_oat_` / `atl_ort_` / `atl_ocs_`; `clientPrivileges` solo permite `read` (los usuarios no crean,
  editan, rotan ni listan clientes); `allowPublicClientPrelogin` para que el login muestre el nombre de la app.
- Páginas: `loginPage = ${WEB_URL}/login`, `consentPage = ${WEB_URL}/oauth/consent`. El servidor manda ahí con la query
  de autorización **firmada** (`…&exp=…&sig=…`, vence a los 10 min).
- Web: `createAuthClient({ plugins: [oauthProviderClient()] })`. En una página con `sig`, el plugin agrega
  `oauth_query` a los POST (`signIn.email`, `signUp.email`, `signIn.social`, `oauth2.consent`) y la respuesta trae
  `{ redirect: true, url }` con el siguiente paso, al que el cliente navega solo (por eso login y registro **no** hacen
  `router.push` en modo OAuth y conservan la query completa en sus enlaces; ver
  `apps/web/src/app/(auth)/_components/oauth-flow.tsx`). Con Google, el plugin guarda la query en el estado del login
  social y retoma el flujo al volver (probar a mano).
- Endpoints que usan los clientes (todos bajo `<WEB>/api/auth`): `/oauth2/register`, `/oauth2/authorize`,
  `/oauth2/token` (form-urlencoded: el proxy de `app.ts` reenvía el cuerpo crudo), `/oauth2/revoke`,
  `/oauth2/introspect`. La web usa `/oauth2/public-client-prelogin`, `/oauth2/public-client` y `/oauth2/consent`.
- better-auth 1.6.9 responde **200** (no 201) al registro dinámico; los clientes MCP aceptan cualquier 2xx.

Flujo: cliente → `POST /mcp` sin token → 401 → PRM → metadata del AS → DCR → `/oauth2/authorize` (PKCE S256) →
`/login?…&sig` → `signIn` con `oauth_query` → `/oauth/consent?…&sig` → `oauth2.consent({accept})` →
`redirect_uri?code&state&iss` → `/oauth2/token` → `atl_oat_…`. Si el usuario ya consintió esos scopes para ese cliente
y tiene sesión, authorize devuelve el code directo.

### Discovery

1. `POST /mcp` sin token o con uno inválido → **401** con
   `WWW-Authenticate: Bearer [error="invalid_token", ]resource_metadata="<API>/.well-known/oauth-protected-resource/mcp", scope="atleta:read atleta:write"`.
2. **Protected Resource Metadata** (RFC 9728) en la API: `/.well-known/oauth-protected-resource` y
   `/.well-known/oauth-protected-resource/mcp` → `{ resource, authorization_servers: ["<WEB>/api/auth"], scopes_supported,
   bearer_methods_supported: ["header"], resource_name: "Atleta", resource_documentation: "<WEB>/settings/conectar-ia" }`.
3. **Metadata del AS** (RFC 8414) en `<WEB>/.well-known/oauth-authorization-server/api/auth`: Next la reescribe
   (`/.well-known/:path*` → API) y Fastify la sirve con `oauthProviderAuthServerMetadata(auth)`; también en la raíz
   `/.well-known/oauth-authorization-server` por compatibilidad. El middleware de Next excluye `.well-known`.

### Scopes

| Scope | Permite |
|---|---|
| `atleta:read` | Herramientas de lectura |
| `atleta:write` | Herramientas de escritura (crear, modificar, asignar, programar) |
| `offline_access` | Refresh token (no da acceso a herramientas) |

Los scopes no amplían permisos: el usuario sigue limitado por su rol en cada equipo y sus flags. Las herramientas de
escritura no se registran sin `atleta:write` (y se revalida en el handler). Un token sin `atleta:read` ni
`atleta:write` → 403 `insufficient_scope`. En la web, "Lectura y escritura" crea el token con ambos scopes
(`mcp.createToken` agrega `atleta:read` si se pide `atleta:write`).

### Tokens personales (PAT)

- Formato `atl_pat_<base64url de 30 bytes>`; se guarda el SHA-256 en hex y un prefijo de 12 caracteres para mostrar.
  El token completo solo se devuelve al crearlo (`mcp.createToken`).
- Vigencia 30, 90 (por defecto) o 365 días, o sin vencimiento. Máximo 10 activos por usuario y 10 creados al día.
- `last_used_at` se actualiza como mucho cada 5 minutos. Revocar (`mcp.revokeToken`) es inmediato.
- Código: `apps/api/src/mcp/personal-tokens.ts`.

### Resolución del token (`apps/api/src/mcp/auth.ts`)

`resolveMcpAuth(header, repo, now)` → `{ ok: true, principal } | { ok: false, reason }` (y `resolveMcpPrincipal`, que
devuelve el principal o `null`):

- Header `Bearer <token>` con caracteres base64url (16–512); si no, `malformed`. Sin header, `missing`.
- `atl_pat_…` → busca `sha256hex(token)` en `mcp_personal_token`; exige `revoked_at` nulo y `expires_at` nulo o futuro.
- `atl_oat_…` → quita el prefijo y busca `base64url(sha256(resto))` sin padding (el `defaultHasher` del plugin, con
  `storeTokens: "hashed"`) en `oauth_access_token`, unido a `oauth_client`; exige `expires_at > ahora` y
  `disabled` falso. El plugin no guarda la audiencia de los tokens opacos: el `resource` se valida al emitirlo.
- Cualquier otro prefijo → `unknown_prefix` sin consultar la BD. Al final se carga el usuario (`user_not_found`).
- Esto replica el formato de almacenamiento del plugin: `test/integration/oauth.itest.ts` compara el hash guardado con
  `hashOAuthToken` y fallaría si un upgrade lo cambia.
- `AuthRepo` es inyectable (`createAuthRepo(db)` en producción; uno en memoria en `test/mcp/auth.test.ts`).

### Contexto de herramientas por request (`mcp/http.ts`)

```ts
const ctx = createMcpToolContext(principal, { log: req.log, limiters, now, requestId: String(req.id) })
// = { principal, caller: createMcpCaller(principal, log, now()), features: new Set(activeFeatures(user)),
//     log, now, limiters: { write, exerciseCreate, schedule }, requestId }
const server = createMcpServer(ctx)
```

`limiters` sale de `defaultMcpLimiters()` (request 120/min, write 30/min, exerciseCreate 10/h, schedule 20/h) o de
`buildApp({ mcp: { limiters, authRepo, now } })` en pruebas. Además, `req.raw.auth = toSdkAuthInfo(principal)` llega a
los handlers como `extra.authInfo` (`clientId`, `scopes`, `extra.{kind,userId,tokenId}`; sin el token).

## Seguridad (Paquete B)

- **Consentimiento obligatorio** por cliente y usuario (`oauth_consent`); el DCR rechaza `skip_consent`. La pantalla
  `/oauth/consent` muestra la app, su sitio, la cuenta y los permisos en español (`apps/web/src/lib/mcp-scopes.ts`),
  incluido que la app ve nombres de atletas pero no sus correos. Sin el flag `mcp` solo se puede cancelar.
- **PKCE S256 obligatorio** (`plain` o sin PKCE → error); `redirect_uri` exacto (en loopback admite otro puerto); code
  de un solo uso y 10 min; refresh rotativo (el anterior queda revocado).
- **Proxy `/api/auth/*`** (`app.ts`): 404 para `/admin/*`, `/oauth2/{create,update,delete}-client`, `/oauth2/get-clients`
  y `/oauth2/client/rotate-secret` (además de `clientPrivileges`).
- **Origin** (anti DNS-rebinding): si `POST /mcp` trae `Origin` y no es `WEB_URL` ni está en `MCP_ALLOWED_ORIGINS` → 403,
  antes de autenticar. Sin `Origin` (clientes de servidor) se acepta.
- **CORS** (`@fastify/cors` con `delegator`, `corsOptionsFor` en `mcp/http.ts`): `/mcp` y `/.well-known/*` aceptan esos
  orígenes **sin credenciales** y exponen `WWW-Authenticate`, `Mcp-Session-Id` y `Mcp-Protocol-Version`; el resto de la
  API sigue aceptando solo `WEB_URL` con cookies.
- **Una sesión del conector no administra el conector**: `mcp.*` rechaza (FORBIDDEN) la sesión sintética `mcp_<kind>_<id>`,
  así un token no puede crear tokens ni ver apps.
- **Tasa**: 120 requests/min por usuario en `/mcp` (429 + `Retry-After`), antes de leer el cuerpo; escrituras y
  herramientas costosas con sus limitadores (ver "Contexto de herramientas"); crear PAT 10/día. El plugin limita
  `/oauth2/register` (20/h) y `/oauth2/token` (30/min) por IP; better-auth solo aplica límites en producción. Todo en
  memoria por instancia.
- **Revocación**: `mcp.revokeApp` borra access tokens, refresh tokens y consentimiento de ese usuario y cliente (el
  siguiente request → 401); `oauth_client.disabled = true` invalida todos sus tokens; `mcp.revokeToken` para PAT.
- **Logs**: una línea por request (`[mcp] request` con `kind, userId, clientId|tokenId, rpcMethod, ms, ok, status`) y
  otra por herramienta (`[mcp] tool`, de `tool.ts`). Los rechazos se registran con `warn` y solo el motivo
  (`origin_not_allowed`, `missing`, `malformed`, `unknown_prefix`, `not_found`, `revoked`, `expired`,
  `client_disabled`, `user_not_found`, `insufficient_scope`, `feature_disabled`, `rate_limited`). Nunca tokens,
  argumentos ni contenido.

### Respuestas HTTP de `/mcp`

Los errores de la capa HTTP son JSON-RPC `{ jsonrpc: "2.0", error: { code, message }, id: null }`:

| Status | Cuándo | `code` |
|---|---|---|
| 200 | Respuesta del SDK (JSON, stateless, sin `Mcp-Session-Id`) | — |
| 401 | Sin token, token inválido, revocado, vencido o de un cliente deshabilitado (`WWW-Authenticate`) | -32000 |
| 403 | Origin no permitido; token sin scopes de Atleta (`insufficient_scope`) | -32000 |
| 403 | Usuario sin el flag `mcp` ("El conector MCP aún no está disponible para tu cuenta") | **-32001** |
| 405 | `GET` / `DELETE /mcp` (`Allow: POST`) | -32000 |
| 413 | Cuerpo de más de 256 KB (Fastify) | — |
| 429 | Más de 120 requests/min del usuario (`Retry-After`) | -32000 |

### Pruebas del Paquete B

- Unitarias (`apps/api/test/mcp/`): `personal-tokens.test.ts`, `config.test.ts` (URLs y orígenes) y `auth.test.ts`
  (`resolveMcpAuth` con un `AuthRepo` falso: PAT válido/revocado/vencido, OAuth válido/vencido/cliente deshabilitado,
  header mal formado, prefijo desconocido, scopes).
- Integración (`apps/api/test/integration/`): `oauth.itest.ts` (discovery, OAuth de punta a punta con el `Client` del
  SDK, refresh, negativos, `revokeApp`, cliente deshabilitado, token vencido), `pat.itest.ts` (crear, usar, revocar,
  vencer, solo lectura, límites, sin flag) y `http.itest.ts` (405, Origin, CORS, 413, flag, 429 con limitadores
  inyectados vía `buildApp({ mcp })`). Helpers en `mcp-helpers.ts` (`connectMcp`, `postMcp`, `pkcePair`, `insertPat`).

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
