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
| `tool.ts` | `registerAtletaTool(server, ctx, def)`: no registra si falta el scope o el flag; revalida el scope en el handler; valida con zod en un objeto **estricto** (un campo desconocido es `INVALID_INPUT`, no se descarta) y rechaza textos con `\u0000` o surrogates sueltos (`INVALID_INPUT`; Postgres no los guarda); límite de escrituras; una línea de log por llamada; errores con `toToolError`. Genera el JSON Schema publicado sin `$ref` (`publishedInputSchema`) |
| `errors.ts` | `toToolError`, `McpToolError`, `ErrorDetails` (datos extra como `cause` de un `TRPCError`) |
| `context.ts` | `callerSession`, `createMcpCaller`, `resolveTeamId` (equipo implícito o `AMBIGUOUS_TEAM`) |
| `server.ts` | `createMcpServer(ctx)`: registra `tools/*`, `resources.ts` y `prompts.ts`; en `tools/list` publica el `inputSchema` sin `$ref` de `tool.ts` (algunos clientes no resuelven referencias) |
| `tools/*.ts` | `registerAccountTools`, `registerCatalogTools`, `registerRoutineTools`, `registerSkillTools`, `registerAssignmentTools`, `registerSearchFetchTools`, `registerPlanTools` |

### Errores de herramientas

Todo error vuelve como resultado `isError: true` con `content[0].text = "<CODE>: <mensaje>"` y
`structuredContent.error = { code, message, details? }`.

| Origen | Código |
|---|---|
| `TRPCError` `FORBIDDEN` / `UNAUTHORIZED` | `FORBIDDEN` |
| `TRPCError` `NOT_FOUND` | `NOT_FOUND` |
| `TRPCError` `BAD_REQUEST` / `PRECONDITION_FAILED`, `RoutineEditError` | `BAD_REQUEST` |
| `TRPCError` `CONFLICT` | `CONFLICT` + la pista de la causa (`ErrorDetails.hint`, p. ej. "Vuelve a leerla con get_routine y reintenta"); sin pista, "Vuelve a leerlo y reintenta con su updatedAt actual" |
| `TRPCError` `TOO_MANY_REQUESTS`, límites propios | `RATE_LIMITED` (`details.retryAfterSeconds`) |
| `ZodError` (o `BAD_REQUEST` con `ZodError` como causa) | `INVALID_INPUT` (3 issues como máximo, en español y con la ruta del campo) |
| Campo desconocido en el nivel superior, texto con `\u0000` o surrogates sueltos | `INVALID_INPUT` |
| Equipo implícito ambiguo | `AMBIGUOUS_TEAM` (`details.teams`) |
| Falta `atleta:write` | `INSUFFICIENT_SCOPE` |
| Cualquier otro | `INTERNAL` (sin mensaje interno en producción; `details.requestId`) |

Nunca se loguean tokens, argumentos ni contenido: solo `{ kind, userId, clientId|tokenId, tool, teamId?, ms, ok, code? }`.

Mensajes de `INVALID_INPUT` (`issueMessageEs` en `errors.ts`): `Argumentos inválidos: <ruta>: <mensaje>; … Corrige
los campos y reintenta.`, con `details.issues[{path, message}]`. Los issues comunes de zod se traducen
(`invalid_type` → "es obligatorio" / "se esperaba número y llegó texto", `too_small`/`too_big`, uuid, fecha ISO,
regex, enum con sus opciones, `unrecognized_keys` con el nombre del campo); los mensajes propios del schema se
conservan. Una unión que falla (p. ej. `sets`, lista o atajo `{ count }`) se aplana al issue más profundo de sus
alternativas, en vez del genérico "Invalid input".

### Contenido de rutina (`routine-content-input.ts`)

Entrada sin `id` obligatorio, sin `order` ni `setNumber`, con el atajo `sets: { count, …serie }`.
`normalizeRoutineContent(input)` genera ids (conserva los válidos no repetidos), numera, expande `count` y
valida con `routineContentSchema`; `toContentInput(content)` es la inversa (formato que `update_routine` acepta).

Límites de tamaño: 20 elementos, 10 ejercicios por circuito, 12 series por ejercicio, rondas 2–20, JSON ≤ 60 000
caracteres. Por campo acepta lo mismo que `routineContentSchema` (lo que guarda el editor web), para que el
`content` de `get_routine` `detail` de una rutina hecha en la web vuelva a entrar por `update_routine`: reps,
tiempo, distancia y descanso son enteros ≥ 1 sin tope; `tempo`, `notes` y el nombre del circuito son texto libre
(un tempo con formato `E-P-C-P`, `[0-9X]`, se guarda en mayúsculas; cualquier otro, tal cual). La carga sí se
acota por tipo: RPE 1–10, %RM 1–120, kg > 0 y ≤ 1000 (`loadValue` exige `loadType`). Una rutina web que pase
los límites de tamaño (p. ej. más de 20 elementos o de 12 series) sigue sin poder reescribirse entera con
`update_routine`: se edita con las herramientas atómicas o en la web.

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
  memoria por instancia. La IP es `req.ip` de Fastify según `TRUST_PROXY` (1 salto por defecto en producción, el
  edge de Railway): el proxy `/api/auth/*` reescribe `X-Forwarded-For` con ese valor, así que rotar el header no
  evade el límite (ver [deploy.md](./deploy.md#ip-del-cliente-y-trust_proxy)).
- **Sin batches JSON-RPC**: un cuerpo que es un arreglo responde 400 (`-32600`) antes del transporte. MCP 2025-06-18
  eliminó los batches y, aceptándolos, un batch contaba como una sola request para el límite por usuario.
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
| 400 | Batch JSON-RPC (el cuerpo es un arreglo): "Batch JSON-RPC no soportado…" | **-32600** |
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
| `find_alternatives` | R, miembro | `{routineId, itemId, avoid?≤8, easier?}` | `{routineId, itemId, candidates[≤8]{id,name,pattern,muscles,equipment,difficulty}}` (equivalentes por patrón o músculo primario, dificultad no mayor, sin los ya presentes en la rutina; no modifica nada; ítem que no es ejercicio de la rutina → `BAD_REQUEST`) |
| `create_exercise` | W, coach | `{teamId?, name 2..80, description≤400, difficulty, movementPatterns[≤4], contraindications?}` | `{id, name, teamId, existed}` (si ya hay uno visible con ese nombre exacto, sin distinguir mayúsculas, lo devuelve; la comparación es literal: `%` o `_` no son comodines) |
| `list_routines` | R, miembro | `{teamId?, category?, kind?, query?, includeArchived?, limit?≤100=50}` | `{teamId, total, routines[{id,name,category,kind,updatedAt,archived,itemCount,exerciseCount}]}` (más reciente primero) |
| `get_routine` | R | `{routineId, format?: "outline" o "detail"}` | `{id,teamId,name,category,updatedAt,archived,itemCount,exerciseCount}` + `items` (outline) o `content` + `exerciseNames` (detail) |
| `create_routine` | W, coach | `{teamId?, name 1..120, category?="training", kind?="main" (solo entrenamientos), content?: RoutineContentInput}` | `{routineId, teamId, name, kind, updatedAt, itemCount}` |
| `update_routine` | W, coach | `{routineId, expectedUpdatedAt, name?, kind?, content?}` (al menos uno) | `{routineId, name, kind, updatedAt, itemCount}`; `CONFLICT` |
| `edit_routine` | W, coach | `{routineId, expectedUpdatedAt?, ops[1..25]}` (operaciones `{op, …}` del editor) | `{routineId, updatedAt, changes[{type,itemId,summary}]}`; atómica |
| `add_exercise`, `replace_exercise`, `remove_item`, `move_item`, `update_sets`, `update_item_fields`, `update_block`, `adjust_difficulty`, `adjust_rest` | W, coach | `{routineId, expectedUpdatedAt?}` + la entrada de la habilidad | `{routineId, updatedAt, saved, result, message?, changes[]}` |
| `duplicate_routine` | W, coach | `{routineId, name?}` | `{routineId, name, updatedAt}` |
| `archive_routine` | W, coach, destructiva | `{routineId, archived?=true}` | `{routineId, archived, updatedAt}` |
| `assign_routine` | W, coach | `{routineId, athleteIds[1..50], dates?[1..60], kind?, insertIndex?, position?, scheduledTime? "HH:MM"}` | `{routineId, teamId, athleteIds, sessions[{sessionId,date,status,kind,position,scheduledTime}]}` |
| `assign_sequence` | W, coach | `{athleteIds[1..50], dates[1..60], steps[1..10]: [{routineId, kind?, scheduledTime?}]}` (solo entrenamientos) | `{teamId, athleteIds, sessions[{sessionId,routineId,date,status,kind,position,scheduledTime}]}`; `position` = índice del paso; todo o nada; comparte el límite de 20/h con `assign_routine` |
| `list_assignments` | R, miembro | `{teamId?, athleteId?, from?, to?, status?[], planAssignmentId?, limit?≤100=50}` | `{teamId, today, assignments[{sessionId,routineId,routineName,scheduledDate,kind,position,scheduledTime,startedAt,status,planAssignmentId,athletes?}]}` |
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
compuesta sin margen no escribe (`saved: false`). Como en `edit_routine`, `add_exercise` puede repetir un ejercicio
que ya está en la rutina (el editor web con IA no). `find_alternatives` es la habilidad de catálogo del editor
(solo lectura). `create_exercise` usa `services/exercise-create.ts` (no es una habilidad: el editor con IA no
crea ejercicios). No exigen `ai_routine_tweaks` (no hay LLM interno). Detalle
y decisiones en [habilidades-ia-rutinas.md](habilidades-ia-rutinas.md) §5.

**Asignados**
- `assign_routine` toma el equipo de la rutina. Sin `dates` crea una sesión disponible ya
  (`sessions.create`); con `dates`, una por fecha en una transacción (`sessions.createMany`): hoy o antes queda
  activa y las futuras programadas, que requieren `scheduled_sessions`. Atletas de otro equipo → `BAD_REQUEST`.
  Orden del día: sin `insertIndex` la rutina va **al final** de lo que esos atletas ya tienen ese día (la primera
  queda en 0). Con `insertIndex` (0 = al inicio, n = al final, n = entrenamientos que ya tienen ese día) se inserta ahí
  y las demás se renumeran; `BAD_REQUEST` si excede n o quedaría antes de una rutina ya completada o en curso.
  `position` es un orden absoluto avanzado (no combinar con `insertIndex`). Ver `sessions.dayPlan` en [api.md](api.md).
- `assign_sequence` (`sessions.createSequence`; la web ya no la usa, queda para la API) crea, por cada fecha, una sesión por paso con `position` = índice del
  paso, en una transacción; las evaluaciones en `steps` → `BAD_REQUEST`. El atleta no puede iniciar un paso hasta
  completar o saltar los anteriores del día (reglas en `apps/api/src/services/session-rules.ts`).
- `list_assignments`: el coach ve los atletas de cada sesión y puede filtrar por `athleteId`; un atleta solo
  consulta sus propias sesiones (se ignora `athleteId`) y sin la lista de atletas.
- `cancel_assignment` cancela la sesión entera; con `athleteId`, solo a ese atleta (como en la web, solo en
  sesiones de evaluación; en entrenamiento → `BAD_REQUEST`).

**search / fetch** (forma que espera ChatGPT): `search` busca por nombre en las rutinas de los equipos del
usuario y en el catálogo visible; `fetch` devuelve la rutina o el ejercicio como texto, con `url` a la web.
Otros módulos pueden sumar tipos de id con `addSearchFetchProvider(server, {kind, search?, fetch})`
(`tools/search-fetch.ts`); el módulo de planes suma `plan:<uuid>` (con `training_plans`): `search` busca por
nombre u objetivo en los planes no archivados de los equipos del usuario y `fetch` devuelve el plan como texto
(semanas, días, rutinas y asignaciones). Un id cuyo uuid no es válido → `INVALID_INPUT`.

**Búsqueda por nombre** (`search_exercises` y `search`): sin distinguir mayúsculas ni acentos ("flexión"
encuentra "Flexion") y con el texto literal (`%`, `_` y `\` se escapan; no son comodines de LIKE). En SQL se
usa `translate()` de Postgres con la misma tabla de acentos en la columna y en el término (`lib/text-search.ts`),
sin depender de la extensión `unaccent`.

## Resources y prompts (Paquete C)

Resources (`mcp/resources.ts`, solo con `atleta:read`):

| URI | Contenido |
|---|---|
| `atleta://guia/contenido-rutina` | Markdown: formato de `RoutineContentInput` con ejemplo y su JSON Schema (`zod-to-json-schema`) |
| `atleta://guia/programacion` | Markdown: RPE / % RM / kg, tempo E-P-C-P, perSide, objetivos, circuitos, límites seguros de `difficulty.ts`, calendario (semana lunes–domingo) y "confirma antes de escribir" |
| `atleta://rutinas/{routineId}` | JSON igual a `get_routine` (outline); errores como `"<CÓDIGO>: mensaje"` |

La plantilla `atleta://planes/{planId}` (JSON igual a `get_plan`, con `training_plans`) y el prompt
`planificar_mesociclo` los registra el módulo de planes (`tools/plans.ts`).

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
- **Programar no es acumulativo (idempotencia ante reintentos):** si ya hay una asignación `active` del mismo plan
  con la misma `startDate` y exactamente los mismos atletas (los de sus sesiones), `schedule` responde `CONFLICT`
  con `details.assignmentId` y la pista "revísalo con get_plan… cancela antes esa asignación con
  cancel_plan_assignment", sin crear nada. La comprobación corre en la transacción con el plan bloqueado
  (`SELECT … FOR UPDATE`): dos llamadas idénticas simultáneas dan una asignación y un `CONFLICT`. En `dryRun` se
  avisa con `duplicateOf` (el `assignmentId` existente o `null`). Otra fecha u otros atletas sí crean otra
  asignación; tras cancelar la asignación (sin `fromDate`) se puede volver a programar igual.
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
| `schedule_plan` (W, coach) | `{planId, athleteIds[1..50], startDate, dryRun?=false}` | `{assignmentId \| null, dryRun, startDate, athleteIds, sessions[{date, week, weekday, position, workoutId, routineId, routineName, sessionId?, status?}], skipped[{workoutId, week, weekday, reason}], duplicateOf?}` (`duplicateOf` solo en `dryRun`); `CONFLICT` con `details.assignmentId` si ya está programado igual |
| `cancel_plan_assignment` (W, coach, destructiva) | `{assignmentId, fromDate?}` | `{assignmentId, status, cancelledSessions, keptSessions}` |

Notas:
- `schedule_plan` sin `dryRun` cuenta para el límite de asignaciones (`limiters.schedule`, 20 por hora,
  compartido con `assign_routine`). Pasarlo devuelve `RATE_LIMITED`. `dryRun` no cuenta.
- El `CONFLICT` de `update_plan` sugiere releer con `get_plan`: lo lleva `plans.update` como pista
  (`ErrorDetails.hint`), que `errors.ts` añade al mensaje.
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
  - QA: `e2e-agent.itest.ts` (un agente completo por HTTP: OAuth → descubrimiento → rutinas y herramientas
    atómicas → asignar → plan 6×4 → schedule_plan → el atleta con su token → cancelar → search/fetch →
    refresh → revokeApp), `adversarial.itest.ts` (IDOR en todas las herramientas con ids, atleta con
    escrituras, entradas malformadas, concurrencia, calendario, HTTP, regresión web y calidad de esquemas y
    respuestas) y `production.itest.ts` (`NODE_ENV=production`: INTERNAL sin detalles, logs sin tokens ni
    contenido, límite del registro dinámico). Los casos que hoy reproducen un bug conocido van con
    `{ todo: "BUG-N: …" }`: no ponen la suite en rojo y pasan a verde cuando se corrige.
  - CI: `.github/workflows/api-tests.yml` (typecheck, unitarias e integración con un servicio `postgres:16`).

### Checklist manual en testing

_Pendiente (B/C): MCP Inspector, Claude.ai (conector personalizado, incluido login con Google), Claude Code
(`claude mcp add --transport http`), ChatGPT (developer mode), revocar desde `/settings/conectar-ia`._
