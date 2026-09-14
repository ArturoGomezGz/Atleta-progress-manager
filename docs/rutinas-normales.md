# Rutinas normales — Diseño

> **Estado:** Diseño cerrado. Listo para implementación.
> **Fuente:** Notion "Fitness app (Miriam)" + decisiones tomadas en sesión de diseño (2026-05-13).

---

## 1. Contexto: dos flujos de entrenamiento

CMW Atleta tiene dos flujos de sesión con responsabilidades distintas:

| Flujo | Actor principal | Input | Tabla central |
|---|---|---|---|
| **Evaluación** | Coach | Peso + reps por atleta, en tiempo real | `training_session` + `set_record` |
| **Rutina normal** | Atleta | Completado por serie (sin peso) | `assigned_session` + `athlete_set_completion` |

Estos flujos son completamente independientes. El flujo de evaluación ya existe y no se modifica.

---

## 2. Jerarquía v1

```
Rutina  →  Sesión asignada  →  Ejecución del atleta
```

> La capa **Plan** (contenedor de rutinas) queda fuera de v1. Se añadirá cuando haya un caso concreto de uso (ej. calentamiento + trabajo principal como una sola asignación).

---

## 3. Schema

### 3.1 Cambios a tablas existentes

**`routine`** — agregar tipo:

| Columna nueva | Tipo | Notas |
|---|---|---|
| `type` | enum | `sequential` \| `circuit`. Default `sequential`. |
| `circuit_rounds` | integer nullable | Solo si `type = circuit`. Número de vueltas. |
| `circuit_duration_seconds` | integer nullable | Solo si `type = circuit`. Alternativa a vueltas (uno o el otro). |

**`routine_exercise`** — enriquecer parámetros de ejecución:

| Columna nueva | Tipo | Notas |
|---|---|---|
| `tempo` | text nullable | Ej. "3-1-2-0". Convención: excéntrico-pausa-concéntrico-pausa. |
| `rest_seconds` | integer nullable | Descanso entre series de este ejercicio. |
| `goal` | enum nullable | `strength` \| `hypertrophy` \| `endurance` \| `power` \| `cardio` \| `recovery` |
| `notes` | text nullable | Indicaciones del entrenador para este ejercicio en esta rutina. |

> Todos los campos son nullable — el coach agrega solo lo que quiera. Un ejercicio puede estar en la rutina sin ningún detalle.

> `target_sets`, `target_reps`, `target_weight` actuales se migran a `routine_set_target` (pendiente de migración según `base-de-datos.md`). Los nuevos campos de arriba son adicionales a eso.

---

### 3.2 Nuevas tablas

#### `assigned_session`
Asignación de una rutina a un atleta individual o grupo con fecha. Creada por el coach.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine | `SET NULL` si la rutina se elimina |
| `team_id` | uuid FK → team | cascade delete |
| `assigned_by` | text FK → user | Coach que asignó |
| `assigned_to_athlete_id` | text FK → user nullable | Asignación individual |
| `assigned_to_group_id` | uuid FK → group nullable | Asignación por grupo |
| `scheduled_date` | date | Fecha planeada de ejecución |
| `status` | enum | `pending` \| `in_progress` \| `completed` \| `skipped` |
| `created_at` | timestamptz | |

Constraint: al menos uno de `assigned_to_athlete_id` o `assigned_to_group_id` debe ser NOT NULL.

> **Sin snapshot.** La sesión apunta directamente a `routine_id`. El atleta siempre ve la versión actual de la rutina al momento de ejecutarla. Si el coach edita la rutina después de asignarla, el atleta ve los cambios.

> **Sin recurrencia en v1.** Cada sesión tiene una fecha única. Asignaciones recurrentes (ej. "todos los lunes") quedan fuera del alcance actual.

---

#### `group`
Agrupación de atletas dentro de un equipo. Permite asignar una sesión a múltiples atletas a la vez.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | Nombre del grupo (ej. "Principiantes", "Competidores") |
| `team_id` | uuid FK → team | cascade delete |
| `created_by` | text FK → user | |
| `created_at` | timestamptz | |

#### `group_member`
Pertenencia de un atleta a un grupo.

| Columna | Tipo | Notas |
|---|---|---|
| `group_id` | uuid FK → group | cascade delete |
| `athlete_id` | text FK → user | |

PK compuesta: `(group_id, athlete_id)`. Un atleta puede pertenecer a múltiples grupos del mismo equipo.

---

#### `athlete_session_execution`
Registro de que un atleta abrió y ejecutó una sesión asignada.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `assigned_session_id` | uuid FK → assigned_session | cascade delete |
| `athlete_id` | text FK → user | |
| `status` | enum | `in_progress` \| `completed` \| `skipped` |
| `started_at` | timestamptz | Cuando el atleta abrió la sesión |
| `completed_at` | timestamptz nullable | Cuando marcó la sesión como terminada |

Unique constraint: `(assigned_session_id, athlete_id)` — un atleta tiene una sola ejecución por sesión asignada.

---

#### `athlete_set_completion`
Marcado de series completadas por el atleta. **Solo registra que se hizo — sin peso ni reps.**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `execution_id` | uuid FK → athlete_session_execution | cascade delete |
| `routine_exercise_id` | uuid FK → routine_exercise | `SET NULL` si el ejercicio se elimina de la rutina |
| `set_number` | integer | Número de serie (1, 2, 3…) |
| `completed_at` | timestamptz | |

> `routine_exercise_id` usa `SET NULL` (no cascade delete) porque si el coach edita la rutina y elimina un ejercicio, el historial de ejecuciones pasadas se conserva con `routine_exercise_id = null`. Es el trade-off aceptado del modelo sin snapshot.

---

### 3.3 Diagrama de relaciones (flujo normal)

```
user (coach)
  └── assigned_session
        ├── routine_id → routine ─── routine_exercise ─── exercise
        ├── assigned_to_athlete_id → user (atleta)
        └── assigned_to_group_id → group
                                      └── group_member → user (atleta)

user (atleta)
  └── athlete_session_execution
        ├── assigned_session_id → assigned_session
        └── athlete_set_completion
              └── routine_exercise_id → routine_exercise (SET NULL si se elimina)
```

---

## 4. Flujo completo

### Coach
1. Crea o reutiliza una rutina existente.
2. Asigna la rutina a un atleta o grupo con fecha (`assigned_session`).
3. El atleta recibe la sesión en su vista.

### Atleta
1. Ve sus sesiones pendientes (`assigned_session` con `status = pending`, `scheduled_date = hoy`).
2. Abre una sesión → se crea `athlete_session_execution` con `status = in_progress`.
3. Navega por los ejercicios y marca cada serie como completada → se crea una fila en `athlete_set_completion` por cada serie marcada.
4. Marca la sesión como terminada → `athlete_session_execution.status = completed`, `completed_at = now()`.

> El atleta no ingresa peso ni reps — solo marca series como hechas.

---

## 5. Endpoints tRPC requeridos

### `groups.*`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `groups.create` | mutation | Crear grupo en el equipo | Coach |
| `groups.list` | query | Grupos del equipo con sus miembros | Miembro del equipo |
| `groups.addMember` | mutation | Agregar atleta al grupo | Coach |
| `groups.removeMember` | mutation | Remover atleta del grupo | Coach |
| `groups.delete` | mutation | Eliminar grupo | Coach |

### `assignedSessions.*`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `assignedSessions.create` | mutation | Asignar rutina a atleta/grupo con fecha | Coach |
| `assignedSessions.list` | query | Sesiones asignadas del equipo (filtrable por atleta, fecha, status) | Coach |
| `assignedSessions.myList` | query | Sesiones asignadas al atleta autenticado | Atleta |
| `assignedSessions.cancel` | mutation | Cancelar una sesión asignada | Coach |

### `athleteSessions.*`

| Procedimiento | Tipo | Descripción | Autorización |
|---|---|---|---|
| `athleteSessions.start` | mutation | Crear `athlete_session_execution` con status `in_progress` | Atleta |
| `athleteSessions.completeSet` | mutation | Marcar una serie como completada | Atleta |
| `athleteSessions.undoSet` | mutation | Desmarcar una serie completada | Atleta |
| `athleteSessions.complete` | mutation | Marcar la sesión como completada | Atleta |
| `athleteSessions.skip` | mutation | Saltarse la sesión | Atleta |
| `athleteSessions.progress` | query | Estado actual de la ejecución (qué series están completadas) | Atleta |

---

## 6. Orden de implementación

### Fase 1 — Backend base (sin UI)
1. Migración: agregar `type`, `circuit_rounds`, `circuit_duration_seconds` a `routine`.
2. Migración: agregar `tempo`, `rest_seconds`, `goal`, `notes` a `routine_exercise`.
3. Migración: crear tablas `group`, `group_member`.
4. Migración: crear tabla `assigned_session`.
5. Migración: crear tablas `athlete_session_execution`, `athlete_set_completion`.
6. Router tRPC `groups.*`.
7. Router tRPC `assignedSessions.*`.
8. Router tRPC `athleteSessions.*`.

### Fase 2 — UI coach
9. Pantalla de asignación de sesión (seleccionar rutina + atleta/grupo + fecha).
10. Vista de sesiones asignadas del equipo (calendario o lista).
11. Gestión de grupos.

### Fase 3 — UI atleta
12. Vista del atleta: sesiones pendientes de hoy.
13. Vista de ejecución: ejercicios con series para marcar.
14. Completado de sesión.

> Las fases de UI dependen de la Fase 1. Las fases 2 y 3 pueden desarrollarse en paralelo una vez que el backend esté listo.
