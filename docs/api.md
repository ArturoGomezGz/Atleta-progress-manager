# API Reference

El backend expone dos tipos de endpoints bajo `http://localhost:3001`:

| Prefijo | Tecnología | Uso |
|---|---|---|
| `/api/auth/*` | better-auth | Registro, login, logout, sesión y servidor de autorización OAuth del conector MCP |
| `/trpc/*` | tRPC v11 | Todos los datos de la aplicación |
| `/mcp`, `/.well-known/*` | MCP SDK (Streamable HTTP) | Conector MCP para asistentes de IA (ver [mcp.md](./mcp.md)) |

---

## Autenticación (`/api/auth/*`)

Gestionado por better-auth. El cliente web usa `better-auth/react` para llamar estos endpoints automáticamente.

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/sign-up/email` | POST | Registro con email y contraseña |
| `/api/auth/sign-in/email` | POST | Login |
| `/api/auth/sign-out` | POST | Logout |
| `/api/auth/get-session` | GET | Sesión activa del usuario |
| `/api/auth/oauth2/register` | POST | Registro dinámico de un cliente OAuth público (conector MCP; sin `skip_consent`) |
| `/api/auth/oauth2/authorize` | GET | Autorización OAuth 2.1 (PKCE S256 obligatorio); manda a `/login` y `/oauth/consent` del web |
| `/api/auth/oauth2/consent` | POST | Aceptar o rechazar el consentimiento (`{ accept, oauth_query }`, con sesión) |
| `/api/auth/oauth2/token` | POST | Canje de code y refresh (`application/x-www-form-urlencoded`) |
| `/api/auth/oauth2/revoke`, `/oauth2/introspect` | POST | Revocación e introspección de tokens |
| `/api/auth/oauth2/public-client`, `/oauth2/public-client-prelogin` | GET / POST | Nombre y sitio de la app para el login y el consentimiento |

Las cookies de sesión son `httpOnly` y se envían automáticamente con `credentials: "include"`.

El proxy responde 404 a `/api/auth/admin/*` y a la administración de clientes OAuth (`/oauth2/create-client`,
`/update-client`, `/delete-client`, `/get-clients`, `/client/rotate-secret`).

### Conector MCP (fuera de `/api/auth`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/mcp` | POST | Servidor MCP (Streamable HTTP stateless, respuesta JSON). `Authorization: Bearer atl_oat_…` o `atl_pat_…`. 401/403/405/413/429 en [mcp.md](./mcp.md#respuestas-http-de-mcp) |
| `/mcp` | GET, DELETE | 405 (`Allow: POST`) |
| `/.well-known/oauth-protected-resource[/mcp]` | GET | Protected Resource Metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server[/api/auth]` | GET | Metadata del servidor de autorización (RFC 8414); el web la expone en `<WEB>/.well-known/oauth-authorization-server/api/auth` |

---

## Procedimientos tRPC

Todos los procedimientos requieren sesión activa salvo que se indique lo contrario.
La autorización de rol (coach/atleta) se verifica dentro de cada procedimiento.

### `teams`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `teams.create` | mutation | Crear equipo. El creador queda como coach automáticamente. | Cualquier usuario |
| `teams.list` | query | Equipos del usuario autenticado con su rol. | Propio usuario |
| `teams.members` | query | Miembros de un equipo. | Miembro del equipo |
| `teams.addMember` | mutation | Agregar usuario al equipo con rol. | Coach |
| `teams.removeMember` | mutation | Eliminar miembro del equipo. | Coach |

### `exercises`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `exercises.list` | query | Lista completa del catálogo global ordenada por nombre. | Cualquier usuario autenticado |
| `exercises.create` | mutation | Agregar ejercicio al catálogo global. | Cualquier usuario autenticado |
| `exercises.delete` | mutation | Eliminar ejercicio del catálogo. | Cualquier usuario autenticado |

> **Pendiente**: definir si la gestión del catálogo requiere un rol de administrador global.

### `routines`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `routines.create` | mutation | Crear rutina en un equipo. `content` opcional (la usa el conector MCP): se validan los límites (20 elementos, 10 por circuito, 12 series) y que cada ejercicio sea visible para quien crea (`BAD_REQUEST` si no). | Coach del equipo |
| `routines.duplicate` | mutation | Copia una rutina con ids nuevos (`name` opcional). | Coach del equipo |
| `routines.list` | query | Rutinas de un equipo. Filtro `category`; las archivadas solo con `includeArchived: true`. | Miembro del equipo |
| `routines.get` | query | Rutina con nombres e información de sus ejercicios (`exerciseNames`, `exerciseInfo`) y `archivedAt`. | Miembro del equipo |
| `routines.updateContent` | mutation | Guarda el contenido completo (y opcionalmente `name`). Cada ejercicio **nuevo** debe ser visible (`BAD_REQUEST`). Con `expectedUpdatedAt` (ISO) aplica concurrencia optimista: bloquea la fila (`SELECT … FOR UPDATE`) y, si su `updatedAt` ya no es ese, falla con `CONFLICT`. Sin él se comporta como siempre (la web). | Coach del equipo |
| `routines.rename` | mutation | Cambia el nombre; acepta `expectedUpdatedAt` igual que `updateContent`. | Coach del equipo |
| `routines.archive` | mutation | `{id, archived = true}`: archiva (sale de `list` y no se puede asignar con `sessions.create`/`createMany`) o restaura con `archived: false`. Lo ya asignado no cambia. | Coach del equipo |
| `routines.delete` | mutation | Eliminar rutina completa. | Coach del equipo |
| `routines.aiAvailable` / `generateWithAI` / `tweakWithAI` | query / mutation | Generación y ajustes con IA (ver [ia-generacion-rutinas.md](ia-generacion-rutinas.md)). | Miembro / Coach del equipo |

### `sessions`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `sessions.myPending` | query | Sesiones pendientes del atleta en todos sus equipos (activas y de entrenamiento programadas), sin fecha primero. La usa la app Android. | Usuario autenticado |
| `sessions.list` | query | Sesiones del equipo (con `planAssignmentId` y, para el coach, los atletas asignados). Filtros opcionales: `category`, `athleteId` (solo sesiones donde ese atleta está asignado), `from`/`to` (fecha programada o, sin fecha, el día UTC en que se creó), `status[]`, `planAssignmentId` y `limit` (1–500; sin límite por defecto). | Miembro del equipo |
| `sessions.create` | mutation | Iniciar sesión: hace snapshot de la rutina y enrolla atletas. | Coach del equipo |
| `sessions.createMany` | mutation | Igual que `create` para varias fechas a la vez (una sesión por fecha, máx. 60 fechas y 50 atletas, en una transacción). Solo las fechas futuras exigen `scheduled_sessions`. | Coach del equipo |
| `sessions.get` | query | Sesión con ejercicios (snapshot) y atletas. | Miembro del equipo |
| `sessions.athleteSets` | query | Todas las series de un atleta en la sesión. | Miembro del equipo |
| `sessions.recordSet` | mutation | Registrar una serie para un atleta. | Coach del equipo |
| `sessions.updateSetStatus` | mutation | Cambiar estado de una serie a `valid` o `invalid`. | Coach del equipo |
| `sessions.deleteSet` | mutation | Eliminar una serie registrada. | Coach del equipo |
| `sessions.addSessionExercise` | mutation | Agregar ejercicio extra sobre la marcha. | Coach del equipo |
| `sessions.cancelAthlete` | mutation | Cancelar la sesión para un atleta específico. | Coach del equipo |
| `sessions.complete` | mutation | Marcar sesión como completada. | Coach del equipo |
| `sessions.cancel` | mutation | Cancelar sesión completa. | Coach del equipo |

### `mcp`

Conector MCP: lo usa la página "Conectar IA" (`/settings/conectar-ia`). Todo requiere el flag `mcp` y una sesión web:
la sesión sintética de un token del conector recibe `FORBIDDEN`. Ver `docs/mcp.md`.

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `mcp.connectionInfo` | query | `{ mcpUrl, scopes }`: URL del conector para pegar en el cliente. | Flag `mcp` |
| `mcp.listTokens` | query | Tokens personales no revocados `[{ id, name, prefix, scopes, createdAt, lastUsedAt, expiresAt }]` (incluye vencidos; nunca el token). | Propio usuario |
| `mcp.createToken` | mutation | `{ name 1..60, scopes[≥1], expiresInDays: 30\|90\|365\|null = 90 }` → `{ id, token, prefix, expiresAt }`. El token solo se devuelve aquí. `atleta:write` agrega `atleta:read`. Máx. 10 activos (`BAD_REQUEST`) y 10 por día (`TOO_MANY_REQUESTS`). | Propio usuario |
| `mcp.revokeToken` | mutation | `{ id }`: revoca un token personal (`NOT_FOUND` si no es suyo o ya estaba revocado). | Propio usuario |
| `mcp.listConnectedApps` | query | Apps OAuth con consentimiento `[{ clientId, name, uri, icon, scopes, connectedAt, updatedAt }]`. | Propio usuario |
| `mcp.revokeApp` | mutation | `{ clientId }`: borra los access y refresh tokens y el consentimiento de esa app (`NOT_FOUND` si no estaba conectada). | Propio usuario |

### `share`

Rutinas compartidas por enlace. Los procedimientos marcados como **público** no
requieren sesión — son la única superficie del API abierta a invitados.
Ver `docs/rutinas-compartidas.md`.

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `share.forRoutine` | query | Enlace activo de la rutina y su resumen de uso. | Coach del equipo |
| `share.createLink` | mutation | Generar el enlace (o devolver el vigente). Solo rutinas de entrenamiento. | Coach del equipo |
| `share.revokeLink` | mutation | Desactivar el enlace. | Coach del equipo |
| `share.listForTeam` | query | Enlaces activos del equipo, para mostrarlos junto a las sesiones. | Coach del equipo |
| `share.attendance` | query | Asistencia del enlace: cada entrenamiento, quién lo hizo y su avance. | Coach del equipo |
| `share.preview` | query | Rutina y quién la comparte, antes de empezar. | **Público** (código válido) |
| `share.start` | mutation | Empezar el entrenamiento; devuelve el token del invitado. | **Público** (código válido) |
| `share.workout` | query | Estado del entrenamiento del invitado. | **Público** (token) |
| `share.recordSet` | mutation | Registrar una serie; solo las que existen en el snapshot. | **Público** (token) |
| `share.complete` | mutation | Cerrar el entrenamiento y devolver el resumen. | **Público** (token) |
| `share.claim` | mutation | Convertir el entrenamiento anónimo en una sesión de la cuenta. | Usuario autenticado |

---

## Contexto tRPC

Cada request tRPC recibe el contexto:

```ts
{
  session: {
    user: { id, name, email },
    session: { ... }
  } | null
}
```

La sesión se obtiene llamando a `auth.api.getSession()` con los headers del request en cada llamada.

---

## Manejo de errores

tRPC usa los códigos estándar de `TRPCError`:

| Código | Cuándo se usa |
|---|---|
| `UNAUTHORIZED` | Sin sesión activa |
| `FORBIDDEN` | Sin el rol requerido (no es coach, no es miembro) |
| `NOT_FOUND` | Recurso no existe |
| `BAD_REQUEST` | Operación no válida (ej. registrar serie en sesión no activa) |
| `CONFLICT` | Concurrencia optimista: `routines.updateContent` / `rename` con un `expectedUpdatedAt` que ya no es el `updatedAt` de la rutina. El error lleva el `updatedAt` vigente como causa (el conector MCP lo devuelve en `details.updatedAt`); hay que volver a leer la rutina y reintentar |
| `TOO_MANY_REQUESTS` | Enlace compartido con demasiados entrenamientos en la última hora |
