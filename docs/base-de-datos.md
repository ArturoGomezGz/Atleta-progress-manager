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
| `description` | text nullable | Descripción libre |
| `type` | enum `routine_type` | `sequential \| circuit`. Default `sequential` |
| `rounds` | integer nullable | Solo circuito: número de vueltas |
| `duration_seconds` | integer nullable | Solo circuito: duración total |
| `team_id` | uuid FK → team | cascade delete |
| `created_by` | text FK → user | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `routine_exercise`
Ejercicios que componen una rutina. Todos los campos de configuración son opcionales — el entrenador agrega solo lo que necesite.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine | cascade delete |
| `exercise_id` | uuid FK → exercise | |
| `order` | integer | Orden de referencia |
| `target_sets` | integer nullable | Número de series objetivo (cuando todas las series son iguales) |
| `objective` | enum nullable | `strength \| hypertrophy \| endurance \| power \| cardio \| recovery` |
| `tempo` | text nullable | Formato libre, ej. "3-1-2-0" |
| `rest_between_sets_seconds` | integer nullable | Descanso entre series de este ejercicio |

> Cuando se necesita desglose por serie (reps y %RM distintos por serie), se usa `routine_set_target`. `target_sets` en `routine_exercise` cubre el caso simple donde todas las series son iguales o no requieren desglose.

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
Instancia de una sesión asignada a un equipo. Puede ser una sesión en vivo (iniciada por el entrenador) o una sesión planeada con fecha.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine nullable | Referencia a la rutina; `SET NULL` si se borra. En el futuro se añadirá `plan_id` |
| `session_type` | enum `session_type` | `normal \| evaluation`. Default `evaluation` para compatibilidad con sesiones existentes |
| `scheduled_date` | date nullable | Fecha asignada. `null` = sesión en vivo iniciada en el momento |
| `team_id` | uuid FK → team | cascade delete |
| `started_by` | text FK → user | Entrenador que creó/inició la sesión |
| `started_at` | timestamptz | Momento de creación |
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
Atleta participando en una sesión.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → training_session | cascade delete |
| `athlete_id` | text FK → user | |
| `status` | enum | `active` \| `completed` \| `cancelled` |

> Para sesiones **normales**, el atleta marca su propia `athlete_session` como `completed`. Para sesiones de **evaluación**, `completed` lo gestiona el entrenador al cerrar la sesión.

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

### `session_feedback`
Feedback opcional del atleta al completar cualquier sesión (normal o de evaluación).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `athlete_session_id` | uuid FK → athlete_session | cascade delete, unique |
| `effort` | integer nullable | Esfuerzo percibido 1–5 |
| `mood` | integer nullable | Sensación general 1–5 |
| `notes` | text nullable | Notas libres del atleta al entrenador |
| `recorded_at` | timestamptz | |

---

## Diagrama de relaciones

```
user ──────────────────────────────────────────────────────────────────┐
  │                                                                   │
  ├── team_member (role: coach|athlete)                               │
  │     └── team ──── routine ─── routine_exercise ──── exercise      │
  │               │         │          └── routine_set_target *        │
  │               │         └── (futuro: plan → plan_routine)          │
  │               └── training_session (type: normal|evaluation)      │
  │                     ├── session_exercise (snapshot)               │
  │                     │         └── session_set_target * (snapshot)  │
  │                     └── athlete_session (status: active|completed|cancelled)
  │                           ├── session_feedback (opcional)         │
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
- **MVP sin entidad Plan**: las sesiones referencian `routine_id` directamente. Cuando se implemente `Plan`, se añadirá `plan_id` nullable sin romper el modelo actual. Ver `docs/sesiones-y-plantillas.md`.
- **Dos tipos de sesión**: `session_type: normal | evaluation`. Normal = el atleta solo marca como completada. Evaluación = registro completo de series (comportamiento actual). Default `evaluation` para compatibilidad.
- **Recurrencia por instancias**: no se modela recurrencia en BD. Cada sesión es una instancia independiente con `scheduled_date`. La UI genera las instancias.
- **`target_sets` en `routine_exercise`**: cubre el caso simple (todas las series iguales). El desglose por serie usa `routine_set_target`. Ambos pueden coexistir — `target_sets` es solo orientativo cuando hay desglose.
