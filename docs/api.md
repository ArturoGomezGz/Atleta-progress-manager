# API Reference

El backend expone dos tipos de endpoints bajo `http://localhost:3001`:

| Prefijo | Tecnología | Uso |
|---|---|---|
| `/api/auth/*` | better-auth | Registro, login, logout, sesión |
| `/trpc/*` | tRPC v11 | Todos los datos de la aplicación |

---

## Autenticación (`/api/auth/*`)

Gestionado por better-auth. El cliente web usa `better-auth/react` para llamar estos endpoints automáticamente.

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/sign-up/email` | POST | Registro con email y contraseña |
| `/api/auth/sign-in/email` | POST | Login |
| `/api/auth/sign-out` | POST | Logout |
| `/api/auth/get-session` | GET | Sesión activa del usuario |

Las cookies de sesión son `httpOnly` y se envían automáticamente con `credentials: "include"`.

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
| `routines.create` | mutation | Crear rutina en un equipo. | Coach del equipo |
| `routines.list` | query | Rutinas de un equipo. | Miembro del equipo |
| `routines.get` | query | Rutina con sus ejercicios (incluye nombre del ejercicio). | Miembro del equipo |
| `routines.addExercise` | mutation | Agregar ejercicio a la rutina con targets. | Coach del equipo |
| `routines.updateExercise` | mutation | Actualizar sets/reps/peso objetivo de un ejercicio. | Coach del equipo |
| `routines.removeExercise` | mutation | Eliminar ejercicio de la rutina. | Coach del equipo |
| `routines.delete` | mutation | Eliminar rutina completa. | Coach del equipo |

### `sessions`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `sessions.create` | mutation | Iniciar sesión: hace snapshot de la rutina y enrolla atletas. | Coach del equipo |
| `sessions.get` | query | Sesión con ejercicios (snapshot) y atletas. | Miembro del equipo |
| `sessions.athleteSets` | query | Todas las series de un atleta en la sesión. | Miembro del equipo |
| `sessions.recordSet` | mutation | Registrar una serie para un atleta. | Coach del equipo |
| `sessions.updateSetStatus` | mutation | Cambiar estado de una serie a `valid` o `invalid`. | Coach del equipo |
| `sessions.deleteSet` | mutation | Eliminar una serie registrada. | Coach del equipo |
| `sessions.addSessionExercise` | mutation | Agregar ejercicio extra sobre la marcha. | Coach del equipo |
| `sessions.cancelAthlete` | mutation | Cancelar la sesión para un atleta específico. | Coach del equipo |
| `sessions.complete` | mutation | Marcar sesión como completada. | Coach del equipo |
| `sessions.cancel` | mutation | Cancelar sesión completa. | Coach del equipo |

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
