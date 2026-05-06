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
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `routine_exercise`
Ejercicios que componen una rutina (plantilla).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine | cascade delete |
| `exercise_id` | uuid FK → exercise | |
| `target_sets` | integer | Series objetivo |
| `target_reps` | integer | Repeticiones objetivo |
| `target_weight` | numeric(6,2) nullable | Peso objetivo en kg (opcional) |
| `order` | integer | Posición en la rutina |

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
| `status` | enum | `active` \| `completed` \| `cancelled` |

### `session_exercise`
**Snapshot** de los ejercicios de la rutina al momento de iniciar la sesión. Modificable libremente durante la sesión sin afectar la plantilla original.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → training_session | cascade delete |
| `exercise_id` | uuid FK → exercise | |
| `target_sets` | integer | Copiado de la rutina al inicio |
| `target_reps` | integer | Copiado de la rutina al inicio |
| `target_weight` | numeric(6,2) nullable | Copiado de la rutina al inicio |
| `order` | integer | |

### `athlete_session`
Atleta participando en una sesión. El entrenador puede cancelarle la sesión individualmente.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → training_session | cascade delete |
| `athlete_id` | text FK → user | |
| `status` | enum | `active` \| `cancelled` |

### `set_record`
Serie individual registrada por el entrenador durante la sesión.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `athlete_session_id` | uuid FK → athlete_session | cascade delete |
| `session_exercise_id` | uuid FK → session_exercise | cascade delete |
| `set_number` | integer | Número de serie (1, 2, 3…) |
| `reps` | integer | Repeticiones realizadas |
| `weight` | numeric(6,2) nullable | Peso en kg (opcional) |
| `status` | enum | `valid` \| `invalid` |
| `recorded_by` | text FK → user | Coach que registró |
| `recorded_at` | timestamptz | |

---

## Diagrama de relaciones

```
user ──────────────────────────────────────────┐
  │                                            │
  ├── team_member (role: coach|athlete)        │
  │     └── team ──── routine ─── routine_exercise ─── exercise (catálogo global)
  │               │
  │               └── training_session
  │                     ├── session_exercise (snapshot de routine_exercise)
  │                     └── athlete_session
  │                           └── set_record ──── session_exercise
  │
  └── (better-auth: session, account, verification)
```

---

## Decisiones de diseño

- **Snapshot al iniciar sesión**: `session_exercise` copia los datos de `routine_exercise` en el momento de iniciar. Esto permite modificar la sesión libremente sin alterar la plantilla, y preserva el estado exacto de la sesión aunque la rutina cambie después.
- **`routine_id` nullable en `training_session`**: Si una rutina se elimina, las sesiones históricas conservan sus datos vía `SET NULL`.
- **`target_weight` opcional en toda la cadena**: El peso objetivo en rutinas y sesiones es siempre nullable para soportar ejercicios con peso corporal o donde el entrenador prefiere no predefinir el peso.
- **Sin lock de horario**: `started_at` se registra pero no bloquea al entrenador; puede iniciar una sesión en cualquier momento.
