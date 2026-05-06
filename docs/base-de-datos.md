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
| `status` | enum | `active` \| `completed` \| `cancelled` |

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
