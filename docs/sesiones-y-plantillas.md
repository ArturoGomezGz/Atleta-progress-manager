# Sesiones y plantillas (rutinas normales)

> Fuente de verdad: Notion → "Fitness app (Miriam)" y "Módulo Progress — Decisiones de diseño"

---

## Jerarquía del sistema de entrenamiento

La jerarquía objetivo a largo plazo es:

```
Rutina  →  Plan  →  Sesión
 │          │         │
pieza     diseño   ejecución
de lego   (agrupa    asignada
          rutinas)   (plan + atleta + fecha)
```

**Decisión MVP:** se omite la entidad `Plan` en esta iteración. Las sesiones se asignan directamente desde una `Rutina`. `Plan` se añade en la siguiente iteración sin romper el modelo actual (se introduce como una capa opcional encima).

---

## Dos tipos de sesión

### Sesión normal *(nueva)*
- El atleta ejecuta y **solo marca como completada**. No registra peso ni reps.
- Objetivo: mínima fricción en el día a día.
- `athlete_session.status` pasa de `active` → `completed`.

### Sesión de evaluación *(ya existe)*
- Contiene ejercicios marcados como `apt_for_evaluation`.
- El atleta registra **peso + reps por serie** en cada ejercicio de evaluación.
- Alimenta gráficas de progreso y KPIs.

La distinción entre ambas la marca `training_session.session_type`.

---

## Decisiones tomadas (desviaciones del modelo Notion)

### 1. MVP sin entidad `Plan`
**Notion propone:** Rutina → Plan → Sesión.
**Decisión:** para el MVP, la sesión referencia directamente una `Rutina`. `Plan` se incorpora en una iteración posterior como contenedor opcional.

**Por qué:** el modelo de Notion es correcto a largo plazo, pero añadir `Plan` ahora implica UI de creación/gestión de planes antes de que un solo atleta haya recibido una sesión normal. La validación es más rápida con la jerarquía simplificada, y la migración posterior es limpia (añadir `plan_id` nullable a `training_session`).

### 2. Descansos entre ejercicios — diferidos
**Notion propone:** bloques de descanso entre ejercicios (pasivo, activo definido, activo indefinido).
**Decisión:** diferido. No se modela en esta iteración. El entrenador gestiona los tiempos verbalmente o en la descripción de la rutina.

**Por qué:** añade complejidad al schema y a la UI de creación de rutinas sin un caso de uso urgente. Se puede incorporar como `rest_after_seconds` en `routine_exercise` cuando sea necesario.

### 3. Grupos de atletas — diferidos
**Notion propone:** grupos dentro del equipo para asignación masiva.
**Decisión:** diferido. La asignación se hace atleta por atleta en esta iteración.

**Por qué:** los equipos actuales son pequeños. La asignación individual es suficiente para validar el flujo. Los grupos se añaden cuando el caso de uso de equipos grandes esté confirmado.

### 4. Recurrencia de sesiones — instancias individuales
**Notion propone:** sesiones con fecha recurrente (ej. "todos los lunes").
**Decisión:** no se modela recurrencia en BD. Cada sesión es una instancia individual con su `scheduled_date`. La recurrencia se gestiona desde la UI generando instancias.

**Por qué:** modelar recurrencia en BD añade complejidad (RRULEs, expansión de instancias, edición de "esta y siguientes"). Generar instancias individuales es más simple, más predecible y suficiente para los equipos actuales.

### 5. `athlete_session.status` — añadir `completed`
**Estado actual:** `active | cancelled`.
**Decisión:** añadir `completed`. Para sesiones normales, el atleta marca su `athlete_session` como completada. Para sesiones de evaluación, `completed` se infiere cuando el entrenador cierra la sesión.

---

## Cambios de schema necesarios (MVP)

### `routine` — añadir
| Columna | Tipo | Notas |
|---|---|---|
| `description` | text nullable | Texto libre |
| `type` | enum `routine_type` | `sequential \| circuit`. Default `sequential` |
| `rounds` | integer nullable | Solo circuito: número de vueltas |
| `duration_seconds` | integer nullable | Solo circuito: tiempo total |

### `routine_exercise` — añadir
Todos opcionales — el entrenador agrega solo lo que quiera.

| Columna | Tipo | Notas |
|---|---|---|
| `target_sets` | integer nullable | Número de series objetivo |
| `objective` | enum nullable | `strength \| hypertrophy \| endurance \| power \| cardio \| recovery` |
| `tempo` | text nullable | Formato libre, ej. "3-1-2-0" |
| `rest_between_sets_seconds` | integer nullable | Descanso entre series de este ejercicio |

> `target_reps` y `target_percent` se siguen manejando en `routine_set_target` (granularidad por serie). `target_sets` en `routine_exercise` es el total de series cuando todas son iguales / no requieren desglose.

### `training_session` — añadir
| Columna | Tipo | Notas |
|---|---|---|
| `session_type` | enum `session_type` | `normal \| evaluation`. Default `evaluation` para compatibilidad con sesiones existentes |
| `scheduled_date` | date nullable | Fecha asignada al atleta. `null` = sesión en vivo sin fecha previa |

> `routine_id` se mantiene (no se migra a `plan_id`). Cuando se añada `Plan`, se agrega `plan_id` nullable y se depreca `routine_id` gradualmente.

### `athlete_session` — modificar enum
| Valor | Estado |
|---|---|
| `active` | Sin cambio |
| `cancelled` | Sin cambio |
| `completed` | ✅ Añadir |

### Nueva tabla `session_feedback`
Feedback opcional del atleta al terminar cualquier tipo de sesión.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `athlete_session_id` | uuid FK → athlete_session | cascade delete, unique |
| `effort` | integer nullable | Esfuerzo percibido, escala 1–5 |
| `mood` | integer nullable | Sensación general, escala 1–5 |
| `notes` | text nullable | Notas libres del atleta al entrenador |
| `recorded_at` | timestamptz | |

> `unique` en `athlete_session_id` — un solo feedback por sesión por atleta.

---

## Flujo completo de una sesión normal (MVP)

```
Entrenador crea Rutina (tipo: secuencial o circuito)
  └── añade ejercicios con parámetros opcionales

Entrenador crea training_session
  ├── session_type: normal
  ├── routine_id: → la rutina creada
  └── scheduled_date: fecha asignada

Sistema crea athlete_session por cada atleta asignado
  └── status: active

Atleta ve la sesión en su calendario/lista
  └── abre la rutina, ejecuta los ejercicios

Atleta marca sesión como completada
  └── athlete_session.status → completed

Atleta (opcional) deja feedback
  └── inserta session_feedback
```

---

## Pendiente para siguiente iteración

- Entidad `Plan` (contenedor de rutinas) + `plan_routine`
- Grupos de atletas (`team_group`, `team_group_member`)
- Descansos entre ejercicios en `routine_exercise`
- Asignación a grupos (sesión → grupo en vez de sesión → atleta individual)
