# Rutinas de entrenamiento — Diseño del builder

> **Estado:** Decisiones tomadas. Listo para implementar en fases.
> **Fecha:** 2026-05-13
> **Contexto:** La Fase 3 de rutinas normales está terminada (backend + UI atleta). Este doc captura el diseño del constructor de rutinas (UI coach) y las decisiones de arquitectura para soportar ejercicios individuales y circuitos dentro de la misma rutina.

---

## 1. Modelo conceptual

Una rutina es una **secuencia ordenada de ítems**. Cada ítem es una de dos cosas:

- **Ejercicio individual** — se ejecuta una vez, con sus series.
- **Bloque-circuito** — agrupa varios ejercicios que se repiten N rondas seguidas. Todos los ejercicios del bloque comparten el mismo número de rondas.

```
Rutina
├── Ejercicio A          (3 series)
├── Bloque circuito ×4
│   ├── Ejercicio B      (1 serie × 4 rondas)
│   └── Ejercicio C      (1 serie × 4 rondas)
└── Ejercicio D          (4 series)
```

Esto reemplaza el modelo anterior donde toda la rutina era `sequential` O `circuit`.

---

## 2. Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| ¿Bloques o estructura plana? | **Bloques** — la rutina es una secuencia de ejercicios individuales o bloques-circuito |
| ¿Todos los ejercicios del circuito comparten rondas? | **Sí** — el número de rondas es del bloque, no del ejercicio |
| ¿Reordenamiento de ejercicios? | **Drag & drop** |
| ¿Cómo se agrega un ejercicio? | **Selector de lista** (mantener el actual) |
| ¿Campos de ejercicio a exponer? | **Todos**: tempo, descanso, objetivo, notas |
| ¿Default al agregar ejercicio? | **1 serie** |
| ¿Guardado? | **Botón explícito** (no autosave) |
| ¿Qué tipos de serie soportar? | `reps` y `time`. `distance` y `amrap` fuera del alcance inmediato |
| ¿Tipos de carga? | `fixed_kg`, `percent_rm`, `rpe`, sin carga |
| ¿Cálculo automático de % RM? | No en esta fase — se muestra el % como referencia |
| ¿Arquitectura de persistencia? | **Schema híbrido** — metadatos relacionales + `content jsonb` |

---

## 3. Arquitectura de persistencia — schema híbrido

### Decisión

En lugar de tablas normalizadas (`routine_exercise`, `routine_set_target`, `routine_block`), la estructura de la rutina se almacena como **JSONB** en una columna `content` de la tabla `routine`. Los metadatos que necesitan indexarse o filtrarse (id, nombre, equipo, categoría) se mantienen como columnas relacionales.

### Por qué es viable aquí

- La rutina siempre se lee y escribe **entera** — no hay queries parciales sobre series individuales.
- La estructura anidada (bloques → ejercicios → series) se representa naturalmente en JSON sin joins.
- Los `exerciseId` dentro del JSON no quedan huérfanos porque el catálogo usa **soft delete** (`deletedAt` en `exercise`). Un ejercicio eliminado sigue existiendo en DB; si aparece en una rutina se puede mostrar como "Ejercicio eliminado" en lugar de romper.
- Agregar nuevos tipos de serie (`amrap`, `distance`) o campos de ejercicio no requiere migración de columnas — solo evolucionar el tipo TypeScript.

### Comparativa vs tablas normalizadas

| | Tablas normalizadas | Schema híbrido |
|---|---|---|
| Tablas | 3 (`routine` + `routine_exercise` + `routine_set_target`) | 1 |
| Enums PG | 5 | 1 (`routine_category`) |
| Queries para leer una rutina | 1 + N (N+1 por sets) | 2 siempre |
| Mutaciones para editar | 5 endpoints | 2 (`updateContent`, `rename`) |
| FK a `exercise` garantizada por PG | Sí | No — garantizada por soft delete |
| Queries cruzadas ("rutinas con ejercicio X") | JOIN simple | `jsonb_path_query` (incómodo pero posible) |
| Evolución del schema sin migración | No | Sí |

### Schema Drizzle

```typescript
// packages/db/src/schema/routines.ts

export const routineCategoryEnum = pgEnum("routine_category", ["evaluation", "training"])
// Los demás enums (set_type, load_type, routine_type, exercise_goal) desaparecen de PG
// — viven como tipos TypeScript

export const routine = pgTable("routine", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  teamId:    uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => user.id),
  category:  routineCategoryEnum("category").notNull().default("training"),
  content:   jsonb("content").$type<RoutineContent>().notNull().default({ v: 1, items: [] }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// routine_exercise y routine_set_target se eliminan tras la migración de datos
```

### Tipos TypeScript del contenido

```typescript
type SetType     = "reps" | "time" | "distance" | "amrap"
type LoadType    = "fixed_kg" | "percent_rm" | "rpe"
type ExerciseGoal = "strength" | "hypertrophy" | "endurance" | "power" | "cardio" | "recovery"

type RoutineSet = {
  setNumber: number
  setType: SetType
  targetReps?: number
  targetDurationSeconds?: number
  targetDistanceMeters?: number
  loadType?: LoadType
  loadValue?: number           // kg, % o valor RPE según loadType
}

type RoutineExerciseContent = {
  exerciseId: string           // UUID — nombre se resuelve en la capa API
  order: number
  tempo?: string               // "3-1-2-0" (excéntrico-pausa-concéntrico-pausa)
  restSeconds?: number
  goal?: ExerciseGoal
  notes?: string
  sets: RoutineSet[]
}

type RoutineItemExercise = { type: "exercise"; order: number } & RoutineExerciseContent

type RoutineItemBlock = {
  type: "block"
  order: number
  name?: string
  rounds: number               // mínimo 2
  exercises: RoutineExerciseContent[]
}

type RoutineContent = {
  v: 1                         // versión del schema — permite migraciones futuras sin romper
  items: Array<RoutineItemExercise | RoutineItemBlock>
}
```

### Patrón de lectura en la API

```typescript
// get: 2 queries planas, sin N+1
const [r] = await db.select().from(routine).where(eq(routine.id, input.id)).limit(1)

const allExerciseIds = r.content.items.flatMap((item) =>
  item.type === "exercise"
    ? [item.exerciseId]
    : item.exercises.map((e) => e.exerciseId)
)

const exercises = await db
  .select({ id: exercise.id, name: exercise.name })
  .from(exercise)
  .where(inArray(exercise.id, allExerciseIds))
  // No filtramos por deletedAt — si está eliminado devolvemos nombre fallback

const nameById = Object.fromEntries(exercises.map((e) => [e.id, e.name ?? "Ejercicio eliminado"]))
return { ...r, exerciseNames: nameById }
```

### Patrón de escritura en la API

Todas las mutaciones de contenido usan un único endpoint:

```typescript
// updateContent: un solo UPDATE para cualquier cambio estructural
await db
  .update(routine)
  .set({ content: input.content, updatedAt: new Date() })
  .where(eq(routine.id, input.id))
```

Agregar ejercicio, reordenar, editar series, crear bloque, cambiar rondas — todo es mutar el objeto `content` en el cliente y llamar a `updateContent`.

---

## 4. El builder de rutinas (UI coach)

Ruta: `/teams/[teamId]/plantillas/[routineId]`

### 4.1 Vista

La lista muestra ítems en orden. Cada ítem puede ser:

- **Tarjeta de ejercicio individual** — nombre, series, campos de detalle (tempo, descanso, goal, notas).
- **Tarjeta de bloque-circuito** — badge "×R rondas", agrupa N ejercicios. Expandible para ver/editar cada uno.

El orden de los ítems se ajusta con drag & drop. Dentro de un bloque también hay drag & drop para reordenar sus ejercicios.

### 4.2 Acciones disponibles

- Agregar ejercicio individual
- Agregar bloque-circuito (define rondas al crear, luego se agregan ejercicios al bloque)
- Reordenar ítems y ejercicios dentro de bloques (drag & drop)
- Eliminar ejercicio o bloque
- Editar series: tipo (reps/tiempo), cantidad, carga
- Editar campos de ejercicio: tempo, descanso, objetivo, notas

### 4.3 Campos de ejercicio

| Campo | Input | Notas |
|---|---|---|
| Tempo | text `"3-1-2-0"` | Excéntrico-pausa-concéntrico-pausa. Libre o vacío. |
| Descanso entre series | número (segundos) | Ej. 90 |
| Objetivo | select | `strength / hypertrophy / endurance / power / cardio / recovery` |
| Notas | textarea | Instrucciones libres del coach |

---

## 5. Fases de implementación

### Fase A — Migración a schema híbrido
1. Migración SQL: añadir columna `content jsonb` a `routine`; poblarla desde `routine_exercise` + `routine_set_target`
2. Actualizar schema Drizzle: eliminar `routineExercise`, `routineSetTarget` y enums PG que ya no se usan
3. Reescribir el router `routines.ts`: reemplazar los 5 endpoints actuales por `get` + `updateContent` + `rename` + `delete` + `list`
4. Actualizar el builder UI para usar `updateContent`

### Fase B — Builder completo
1. Default 1 serie al agregar ejercicio
2. Campos de ejercicio (tempo, descanso, goal, notas) en el editor
3. Drag & drop para reordenar ítems
4. Soporte de bloques-circuito en la UI (tarjeta de bloque, flujo "agregar bloque")

### Fase C — Ejecución del atleta
1. Temporizador countdown cuando `set_type = time`
2. Presentar bloques como circuitos en la vista de ejecución
3. Mostrar peso calculado desde `exercise_rm` cuando `load_type = percent_rm`

---

## 6. Puntos aún abiertos

| Pregunta | Estado |
|---|---|
| ¿El atleta registra reps hechas en AMRAP, o solo "completado"? | Pendiente — fuera del alcance inmediato |
| ¿El nombre del bloque es obligatorio o automático ("Bloque 1")? | Pendiente — decidir en Fase B |
| ¿Se puede mover un ejercicio entre nivel raíz y bloque? | Pendiente — decidir en Fase B |
