# RM por atleta — Diseño y pendientes

## Prompt de contexto

Este documento describe la funcionalidad de RM (repetición máxima / 1RM) por atleta en Atleta. Léelo completo antes de implementar. El sistema actual **no tiene esta tabla ni lógica** — todo está pendiente de construir.

El proyecto es un monorepo pnpm: Next.js 15 (web) + Fastify/tRPC (api) + Drizzle ORM + PostgreSQL. El esquema vive en `packages/db/src/schema/`. Los routers tRPC están en `apps/api/src/routers/`. La vista de sesión activa está en `apps/web/src/app/(app)/teams/[teamId]/sesiones/[sessionId]/session-view.tsx`.

---

## Qué es el RM en este contexto

El RM (1 repetición máxima) es el peso máximo que un atleta puede levantar en una sola repetición de un ejercicio. Se usa como referencia para planificar cargas de entrenamiento: una sesión puede indicar "Serie 1: 5 reps al 80% RM", y el sistema calcula el peso real a partir del RM del atleta.

Un atleta puede no tener RM registrado para un ejercicio si nunca ha entrenado ese movimiento o no hay datos suficientes.

---

## Flujo completo (diseñado, pendiente de implementar)

### 1. Almacenamiento
Nueva tabla `athlete_exercise_rm`:
- `athleteId` — FK a `user`
- `exerciseId` — FK a `exercise`
- `rmLbs` — numeric(6,2), peso en lbs
- `source` — enum `auto | manual`
- `updatedAt` — timestamp

Unique constraint sobre `(athleteId, exerciseId)` — un registro por atleta/ejercicio, se actualiza en lugar de acumular historial.

> **Pendiente de definir:** ¿guardar historial de RMs (tabla separada de snapshots) para mostrar evolución en la vista Progreso? Por ahora el diseño es solo el valor actual.

### 2. Cálculo automático al completar una sesión
Cuando el entrenador llama a `sessions.complete`, después de cambiar el estado se dispara el cálculo:

- Tomar todos los `set_record` **válidos** (`status = 'valid'`) de la sesión
- Filtrar: `weightLbs > 0` y `reps` entre 1 y 10 (fuera de ese rango la fórmula de Epley pierde precisión)
- Por cada par `(athleteId, exerciseId)`, calcular el RM estimado con **fórmula de Epley**:

  ```
  1RM = weightLbs × (1 + reps / 30)
  ```

- Tomar el máximo estimado del conjunto de series de esa sesión
- **Solo hacer upsert si el nuevo valor supera el RM almacenado** — registra PRs automáticamente, nunca sobrescribe hacia abajo
- `source = 'auto'`

Series con `weightLbs = 0` (ejercicios de calistenia como pull-ups sin lastre) se saltan — no aplica la fórmula.

> **Pendiente de definir:** ¿qué pasa con ejercicios de calistenia donde el atleta usa cinturón con discos? En ese caso `weightLbs > 0` y sí aplica. El caso de peso corporal puro (0 lbs) queda sin RM automático, el entrenador lo pone manual.

> **Pendiente de definir:** ¿recalcular también al invalidar/validar series después de completar la sesión? Por ahora no.

### 3. Uso en la sesión activa — prellenado de peso
En la vista de sesión activa (`session-view.tsx`), cuando un `TargetSetRow` tiene `targetPercent != null` y el atleta tiene RM para ese ejercicio:

```
defaultWeight = (rmLbs × targetPercent / 100).toFixed(1)
```

Este valor prellena el input de peso en `RecordSetForm`. El entrenador puede modificarlo antes de guardar.

Si el atleta no tiene RM registrado para ese ejercicio, el input queda vacío como ahora.

**Query necesaria:** `sessions.athleteRms({ sessionId, athleteId })` — devuelve un mapa `exerciseId → rmLbs` con los RMs actuales del atleta para los ejercicios de la sesión.

### 4. Gestión manual desde Progreso
El entrenador puede ver y editar el RM de cada atleta por ejercicio desde la vista **Progreso** (`/teams/[teamId]/progreso`). Esta vista aún es un placeholder.

> **Pendiente de definir:** diseño y alcance de la vista Progreso. Mínimo necesario: tabla por atleta con sus RMs actuales y opción de editar. Extra deseable: historial de evolución si se guarda.

---

## Decisiones tomadas

1. **Historial**: se guarda historial completo (tabla append-only, sin unique constraint). RM vigente = registro más reciente por `(athleteId, exerciseId)`.
2. **Recálculo**: solo al completar la sesión (`sessions.complete`). No se recalcula al editar/invalidar series después.
3. **Vista Progreso**: lista atleta por atleta. Cada ejercicio muestra RM vigente + badge auto/manual + edición inline + tabla de porcentajes (90/80/75/70) + historial completo.

## Implementado

| Archivo | Cambio |
|---|---|
| `packages/db/src/schema/sessions.ts` | Tabla `athlete_exercise_rm` + enum `rm_source` |
| `packages/db/src/migrations/0001_athlete_exercise_rm.sql` | Migración |
| `apps/api/src/routers/sessions.ts` | `complete` calcula RMs con Epley, nuevo endpoint `athleteRms` |
| `apps/api/src/routers/rms.ts` | Router nuevo: `listByAthlete`, `setManual`, `athletes` |
| `apps/api/src/routers/index.ts` | Registra `rmsRouter` |
| `apps/web/.../sesiones/[sessionId]/session-view.tsx` | Fetch `athleteRms`, `defaultWeight` calculado en `TargetSetRow` |
| `apps/web/.../progreso/page.tsx` | UI completa: lista por atleta, edición manual, tabla de %, historial |
