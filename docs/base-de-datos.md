# Diseño de base de datos

PostgreSQL 16. Schema gestionado con Drizzle ORM en `packages/db/src/schema/`.

---

## Tablas de autenticación (better-auth)

Gestionadas internamente por better-auth. No modificar manualmente.

| Tabla | Descripción |
|---|---|
| `user` | Usuarios del sistema (coach y atletas) |
| `session` | Sesiones activas de autenticación |
| `account` | Cuentas de proveedor (email/password, OAuth futuro) |
| `verification` | Tokens de verificación de email |

---

## Tablas de dominio

### `team`
Agrupa entrenadores y atletas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text | Nombre del equipo |
| `created_at` | timestamp | |

### `team_member`
Pertenencia de un usuario a un equipo con rol específico.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid FK → team | cascade delete |
| `user_id` | text FK → user | cascade delete |
| `role` | enum | `coach` \| `athlete` |
| `joined_at` | timestamp | |

---

### `exercise`
Catálogo global de ejercicios. Único para toda la plataforma.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text UNIQUE | Nombre del ejercicio |
| `description` | text nullable | Descripción opcional |
| `created_at` | timestamp | |

---

### `routine`
Plantilla de entrenamiento creada por un entrenador. **Nunca se modifica desde una sesión activa.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | Nombre de la rutina |
| `team_id` | uuid FK → team | cascade delete |
| `created_by` | text FK → user | |
| `category` | enum | `evaluation` \| `training`. Su significado no cambia |
| `kind` | enum `routine_kind` nullable | Tipo fijo: `warmup` \| `main` \| `recovery`. Regla (aplicada en la API): `evaluation` → `null`; `training` → obligatorio (por defecto `main`). Migración 0007 rellenó las existentes con `main` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `archived_at` | timestamp nullable | Archivada: fuera de las listas por defecto y no se puede asignar; `null` = activa |

### `routine_exercise`
Ejercicios que componen una rutina. El orden no es estricto — el entrenador navega libremente entre ejercicios durante la sesión.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine | cascade delete |
| `exercise_id` | uuid FK → exercise | |
| `order` | integer | Orden de referencia, no obligatorio en ejecución |

> ⚠️ **Pendiente de migración**: actualmente tiene `target_sets`, `target_reps`, `target_weight`. Se eliminarán.

### `routine_set_target` *(pendiente)*
Define los objetivos de cada serie dentro de un ejercicio de rutina. Cada campo es independientemente nullable — un set puede tener reps definidas pero %RM libre, o ambos libres (set abierto / max effort).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_exercise_id` | uuid FK → routine_exercise | cascade delete |
| `set_number` | integer | Número de serie (1, 2, 3…) |
| `target_reps` | integer nullable | Reps objetivo. `null` = libre |
| `target_percent` | numeric(5,2) nullable | %RM objetivo. `null` = libre |

**Combinaciones válidas:**

| `target_reps` | `target_percent` | Significado |
|---|---|---|
| `5` | `80.00` | Set cerrado: 5 reps al 80%RM |
| `3` | `null` | Reps definidas, peso libre |
| `null` | `90.00` | %RM definido, reps libres |
| `null` | `null` | Set abierto / max effort |

---

### `training_session`
Ejecución real de una rutina. Independiente de la plantilla original.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine nullable | Solo referencia histórica; `SET NULL` si se borra la rutina |
| `team_id` | uuid FK → team | cascade delete |
| `started_by` | text FK → user | Entrenador que inició |
| `started_at` | timestamptz | Sin restricción de horario |
| `scheduled_date` | date nullable | Día programado; `null` = "Ahora" |
| `kind` | enum `routine_kind` nullable | Copia del tipo de la rutina al asignar (puede sobreescribirse); `null` en evaluaciones |
| `position` | integer NOT NULL default 0 | Orden dentro del día para un mismo atleta (por defecto warmup 0, main 1, recovery 2; en secuencias, el índice del paso; en planes, la posición del hueco). Un entrenamiento no se puede iniciar mientras haya otro del mismo día con `position` menor sin completar ni saltar |
| `scheduled_time` | time nullable | Hora sugerida ("HH:MM" en la API), solo informativa |
| `status` | enum | `active` \| `completed` \| `cancelled` |
| `plan_assignment_id` | uuid FK → training_plan_assignment nullable | Sesión creada al programar un plan; `SET NULL` |
| `plan_workout_id` | uuid FK → training_plan_workout nullable | Hueco del plan que la originó; `SET NULL` |

Índice `training_session_team_date_position_idx` sobre (`team_id`, `scheduled_date`, `position`).

### `session_exercise`
Snapshot de `routine_exercise` al iniciar la sesión. Puede recibir ejercicios extra añadidos en ejecución.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → training_session | cascade delete |
| `exercise_id` | uuid FK → exercise | |
| `order` | integer | |

> ⚠️ **Pendiente de migración**: actualmente tiene `target_sets`, `target_reps`, `target_weight`. Se eliminarán.

### `session_set_target` *(pendiente)*
Snapshot de `routine_set_target` al iniciar la sesión. Preserva los objetivos planeados aunque la rutina se modifique después.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_exercise_id` | uuid FK → session_exercise | cascade delete |
| `set_number` | integer | |
| `target_reps` | integer nullable | Copiado de `routine_set_target`. `null` = libre |
| `target_percent` | numeric(5,2) nullable | Copiado de `routine_set_target`. `null` = libre |

> Los ejercicios añadidos en ejecución (no planeados) no tienen filas en esta tabla.

### `athlete_session`
Atleta participando en una sesión. El entrenador puede cancelarle la sesión individualmente.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → training_session | cascade delete |
| `athlete_id` | text FK → user | |
| `status` | enum | `active` \| `cancelled` |

### `set_record`
Serie individual registrada durante la sesión. Captura **lo que realmente ocurrió** — siempre en libras.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `athlete_session_id` | uuid FK → athlete_session | cascade delete |
| `session_exercise_id` | uuid FK → session_exercise | cascade delete |
| `session_set_target_id` | uuid FK → session_set_target nullable | `null` para sets extra sin objetivo planeado |
| `set_number` | integer | Número de serie (1, 2, 3…) |
| `reps` | integer | Repeticiones ejecutadas |
| `weight_lbs` | numeric(6,2) | Peso en libras. `0` para peso corporal sin carga adicional |
| `status` | enum | `valid` \| `invalid` |
| `recorded_by` | text FK → user | Coach que registró |
| `recorded_at` | timestamptz | |

> ⚠️ **Pendiente de migración**: columna `weight` (nullable) → `weight_lbs` (not null, default 0).

**Separación planeado / ejecutado:** el `%RM` solo existe en la planeación (`routine_set_target`, `session_set_target`). El registro de ejecución usa libras + reps. El link `session_set_target_id` permite comparar objetivo vs realidad para análisis de progreso.

---

## Rutinas compartidas con invitados

Ver `docs/rutinas-compartidas.md` para el flujo completo.

### `routine_share`
Enlace público de una rutina de entrenamiento.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine | cascade delete |
| `team_id` | uuid FK → team | cascade delete |
| `code` | text UNIQUE | 8 caracteres sin `0/O/1/I`; viaja en `/r/<code>` |
| `created_by` | text FK → user | Coach que lo generó |
| `revoked_at` | timestamptz nullable | `null` = activo |
| `created_at` | timestamptz | |

### `guest_workout`
Ejecución anónima de una rutina compartida.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `share_id` | uuid FK → routine_share | cascade delete |
| `routine_id` | uuid FK → routine nullable | `SET NULL` si se borra la rutina |
| `team_id` | uuid FK → team | cascade delete |
| `token` | text UNIQUE | Credencial del invitado; vive en su `localStorage` |
| `routine_name` | text | Copiado al empezar |
| `content` | jsonb | Snapshot de `RoutineContent` al empezar |
| `status` | enum | `active` \| `completed` \| `claimed` |
| `started_at` / `completed_at` | timestamptz | |
| `claimed_by` | text FK → user nullable | Cuenta que lo guardó |
| `claimed_at` | timestamptz nullable | |
| `claimed_session_id` | uuid FK → training_session nullable | Sesión generada al reclamar |

### `guest_set_record`
Serie registrada sin cuenta. No referencia `session_exercise` porque esa fila
todavía no existe: la posición en el contenido aplanado basta para reconstruirla.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `guest_workout_id` | uuid FK → guest_workout | cascade delete |
| `exercise_id` | uuid FK → exercise | cascade delete |
| `exercise_order` | integer | Posición en el contenido aplanado |
| `set_number` | integer | |
| `reps` | integer | |
| `weight_lbs` | numeric(6,2) | |
| `recorded_at` | timestamptz | |

---

## Conector MCP: OAuth y tokens personales

Ver `docs/mcp.md`. Las cuatro tablas `oauth_*` son las que pide `@better-auth/oauth-provider@1.6.9`:
los nombres de export del schema Drizzle (`oauthClient`, `oauthAccessToken`, `oauthRefreshToken`,
`oauthConsent`) y sus propiedades son los nombres de modelo y campo del plugin — no renombrar.
Ids `text` (los genera better-auth); los arreglos son `text[]`.

| Tabla | Descripción |
|---|---|
| `oauth_client` | Clientes OAuth (registro dinámico de Claude, ChatGPT…): `client_id` único, `redirect_uris`, `scopes`, `disabled`, `public`, metadatos RFC 7591 |
| `oauth_access_token` | Access tokens opacos (guardados como hash SHA-256), `client_id` → `oauth_client.client_id`, `user_id`, `scopes`, `expires_at`, `refresh_id` |
| `oauth_refresh_token` | Refresh tokens (hash) con `revoked` y `auth_time` |
| `oauth_consent` | Consentimiento por usuario y cliente (`scopes`); índice `(user_id, client_id)` |
| `mcp_personal_token` | Tokens personales `atl_pat_…`: solo `token_hash` (SHA-256 hex, único) y `token_prefix` para mostrar; `scopes`, `expires_at` (null = no expira), `last_used_at`, `revoked_at` |

Todas cascadean al borrar el usuario (y los tokens/consentimientos, al borrar el cliente).

---

## Planes de entrenamiento (flag `training_plans`)

Ver `docs/mcp.md`. Un plan es una plantilla de 1 a 16 semanas; programarlo crea
`training_session` normales enlazadas con `plan_assignment_id` / `plan_workout_id`.

### `training_plan`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid FK → team | cascade delete |
| `created_by` | text FK → user | |
| `name` / `description` / `goal` | text | `description` y `goal` nullable |
| `weeks_count` | integer | CHECK 1–16 |
| `status` | enum | `draft` \| `active` \| `archived` |
| `created_at` / `updated_at` | timestamp | |

### `training_plan_week`
Una fila por semana. PK `(plan_id, week_number)`; `name`, `focus` y `notes` opcionales. Cascade al borrar el plan.

### `training_plan_workout`
Hueco de entrenamiento: `(plan_id, week_number)` FK → `training_plan_week` (cascade), `weekday` ISO
(CHECK 1–7, 1 = lunes), `position` dentro del día (único por `plan_id, week_number, weekday, position`),
`routine_id` FK → routine nullable (`SET NULL`: el hueco queda sin rutina) y `notes`.

### `training_plan_assignment`
Aplicación de un plan desde `start_date`: `plan_id` (nullable, `SET NULL`), `team_id`, `assigned_by`,
`status` (`active` \| `cancelled`), `cancelled_at`. Los atletas se derivan de `athlete_session` de sus
sesiones (`training_session.plan_assignment_id`, con índice); no se guardan aparte.

---

## Diagrama de relaciones

```
user ──────────────────────────────────────────────────────────────────┐
  │                                                                   │
  ├── team_member (role: coach|athlete)                               │
  │     └── team ──── routine ─── routine_exercise ──── exercise      │
  │               │                    └── routine_set_target *        │
  │               └── training_session                                │
  │                     ├── session_exercise (snapshot)               │
  │                     │         └── session_set_target * (snapshot)  │
  │                     └── athlete_session                           │
  │                           └── set_record ──── session_exercise    │
  │                                    └──────── session_set_target * (nullable)
  │
  └── (better-auth: session, account, verification)

* pendiente de implementar
```

---

## Decisiones de diseño

- **Rutina no lineal**: el orden de ejercicios es referencial. Durante una sesión el entrenador navega libremente entre atletas, ejercicios y series sin restricción de secuencia.
- **Sets con granularidad independiente**: `target_reps` y `target_percent` son nullable de forma independiente. Un set puede tener cualquier combinación: ambos definidos, uno solo, o ninguno (set abierto / max effort).
- **Separación planeado / ejecutado**: el `%RM` es herramienta de planeación. La ejecución siempre se registra en libras + reps. El link `session_set_target_id` conecta ambos mundos para análisis.
- **Peso en libras**: `weight_lbs` almacena el peso ejecutado en libras. Valor `0` representa ejercicios con peso corporal sin carga adicional (Pull-ups, Dips sin cinturón).
- **Snapshot al iniciar sesión**: `session_exercise` y `session_set_target` copian el estado exacto de la rutina. La sesión es completamente independiente de cambios posteriores en la plantilla.
- **Series extra en sesión**: si el atleta supera los objetivos, el coach puede añadir sets adicionales. Estos `set_record` tienen `session_set_target_id = null`.
- **`routine_id` nullable en `training_session`**: si una rutina se elimina, las sesiones históricas conservan sus datos vía `SET NULL`.
- **Sin lock de horario**: `started_at` se registra pero no bloquea al entrenador.
- **Invitado antes que cuenta**: un `guest_workout` guarda el entrenamiento sin usuario; al reclamarlo se materializa en `training_session` + `athlete_session` + `set_record`, de modo que el historial de una cuenta nueva se lee igual que el de cualquier atleta.
