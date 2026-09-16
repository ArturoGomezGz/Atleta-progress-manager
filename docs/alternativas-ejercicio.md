# Alternativas de ejercicio

> **Estado: en desarrollo.** Todas las decisiones de diseño están tomadas;
> este documento describe lo que se está construyendo.

El entrenador puede asignarle a un ejercicio de la rutina **una alternativa más
sencilla**. Si durante el entrenamiento el atleta no puede con el ejercicio
planeado, la cambia desde la misma pantalla y sigue entrenando.

Ejemplo: *Lagartijas* con alternativa *Lagartijas con rodillas*. El atleta hace
dos series, se le acaba la fuerza, toca «¿Muy difícil?» y termina la rutina con
la versión de rodillas en vez de abandonar el ejercicio.

---

## Alcance de la primera iteración

| Sí | No (queda para después) |
|---|---|
| **Una** alternativa por ejercicio | Varias alternativas / lista de opciones |
| Alternativa **más sencilla** (regresión) | Progresiones — versiones más difíciles |
| La alternativa hereda las series del ejercicio principal | Series propias para la alternativa |
| Rutinas de entrenamiento | Rutinas de evaluación (miden un ejercicio concreto) |
| Atleta con cuenta e invitado por enlace | Sugerencia automática por IA |

La restricción de «una sola y más sencilla» es lo que permite que el modelo de
datos sea un campo opcional y no una tabla nueva. Abrirlo a varias alternativas
después es aditivo (`alternative` → `alternatives[]`), no una migración de
datos.

---

## Por qué la alternativa hereda las series

El `session_set_target` se genera al crear la sesión, antes de que nadie sepa si
el atleta va a cambiar de ejercicio. Si la alternativa trajera sus propias
series habría que generar dos juegos de objetivos por ejercicio y decidir cuál
cuenta para el progreso de la sesión — y el número de series de la rutina
dejaría de ser un número fijo.

Heredando las series, el cambio de ejercicio no toca el plan: los mismos
objetivos, el mismo conteo, el mismo descanso. Solo cambia **qué movimiento
ejecuta el atleta** para cumplirlos. Con una regresión (lagartijas → lagartijas
con rodillas) esto casi siempre es lo correcto; el caso donde no lo es (la
alternativa necesita otro número de repeticiones) es justo el que sacamos del
alcance de esta iteración.

---

## Modelo de datos

### 1. Contenido de la rutina — `RoutineExerciseContent`

`packages/db/src/schema/routines.ts`

```ts
export type RoutineExerciseAlternative = {
  exerciseId: string
}

export type RoutineExerciseContent = {
  id: string
  exerciseId: string
  order: number
  tempo?: string
  restSeconds?: number
  goal?: ExerciseGoal
  notes?: string
  sets: RoutineSet[]
  /** Versión más sencilla a la que el atleta puede cambiar durante la rutina. */
  alternative?: RoutineExerciseAlternative
}
```

Al ser un campo opcional dentro del `jsonb` de `routine.content`, **no hay
migración** para esta parte: las rutinas existentes simplemente no lo traen.
Vale igual para un ejercicio suelto y para uno dentro de un circuito, porque
ambos son `RoutineExerciseContent`.

La primera versión traía además una nota de texto propia de la alternativa
("apóyate en la pared si pierdes el equilibrio"). Se quitó tras probar la
plantilla: ocupaba espacio en el editor sin agregar nada que la nota general
del ejercicio (`RoutineExerciseContent.notes`) no cubriera ya.

El snapshot ya está resuelto: `trainingSession.content` y `guestWorkout.content`
guardan el `RoutineContent` completo al arrancar, así que la alternativa viaja
con la sesión aunque el entrenador edite la plantilla después.

### 2. Serie registrada — `set_record`

`packages/db/src/schema/sessions.ts` — **única migración de la feature**.

```ts
/** Ejercicio realmente ejecutado cuando el atleta cambió a la alternativa.
 *  NULL = hizo el ejercicio planeado. */
performedExerciseId: uuid("performed_exercise_id").references(() => exercise.id),
```

Es nullable y sin default, así que la migración es un `ALTER TABLE ADD COLUMN`
sin reescritura y las filas históricas quedan correctas por definición.

`guest_set_record` **no necesita cambio**: ya guarda `exercise_id` directo
(porque la sesión real todavía no existe), así que ahí basta con grabar el id de
la alternativa.

#### Por qué en `set_record` y no en `session_exercise`

`session_exercise` es compartido por todos los atletas de la sesión; el cambio
es decisión de un atleta. Y guardarlo por serie sale gratis: el atleta puede
hacer dos series completas y cambiar en la tercera, que es exactamente como pasa
en la vida real. La interfaz puede presentarlo como «una vez que cambias, sigues
con la alternativa» (estado de la pantalla) aunque la verdad almacenada sea por
serie.

### 3. Atribución del progreso

**Decidido:** si algún día una serie de lagartijas con rodillas alimentara un
récord, sería el récord de lagartijas con rodillas, no el de lagartijas.
Inflar el PR del ejercicio duro con series del fácil rompería la métrica
central del producto (% del PR), y descartarlas del todo le escondería al
atleta un progreso que sí existe.

**Hallazgo al implementar — corrige lo escrito arriba:** el cálculo de PR
(`athlete_exercise_rm`, rama "Evaluación: calcular PRs" de `sessions.complete`)
**solo corre para rutinas de categoría `evaluation`.** Las rutinas de
`training` —donde vive esta feature— nunca generan entradas de PR: ni antes de
esta feature ni con ella. El bloque `ExerciseCard` que ofrece la alternativa ya
está oculto en evaluación (`{!isEvaluation && …}`), así que un `set_record` con
`performed_exercise_id` no nulo nunca puede llegar a esa rama de cálculo.

**Consecuencia para esta iteración:** no hay ninguna consulta de RM que
modificar. El campo `performed_exercise_id` queda escrito y disponible para
cuando el entrenamiento sí alimente el progreso — hoy ese dato solo se lee de
vuelta en el detalle de la sesión (ver «Interfaz — qué ve el entrenador
después»), no en ningún cálculo de PR.

---

## Recorrido del dato

```
Plantilla (coach)
  routine.content.items[].alternative = { exerciseId }
        │
        │  sessions.create  → snapshot
        ▼
training_session.content              (igual que tempo/notas/circuito)
        │
        │  flattenContent()  → FlatExercise.alternative
        ▼
sessions.myProgress  → WorkoutExercise.alternative { exerciseId, name, video… }
        │
        │  el atleta cambia en la pantalla de la serie
        ▼
sessions.recordSet({ performedExerciseId })  → set_record.performed_exercise_id
        │
        ▼
sesiones/[sessionId] (coach)  → etiqueta "Alternativa" en la serie
```

Para el invitado el recorrido es el mismo hasta `share.recordSet`, que hoy
fuerza `exerciseId: planned.exerciseId` (`apps/api/src/routers/share.ts:534`) y
pasará a aceptar la alternativa del mismo `planned`. Al reclamar
(`share.claim`), las series cuyo `exercise_id` no coincida con el planeado se
copian a `set_record` con `performed_exercise_id`.

---

## Interfaz — entrenador

`apps/web/src/app/(app)/teams/[teamId]/plantillas/[routineId]/page.tsx`,
componente `ExerciseCard`.

Dentro del bloque **«Detalles para el atleta»** (el mismo que ya agrupa tempo,
objetivo e indicaciones, y que ya está oculto en rutinas de evaluación) se suma:

```
Alternativa más sencilla                      [ Elegir ejercicio… ]

  ┌──────────────────────────────────────────────┐
  │ [▶] Lagartijas con rodillas             [ × ]│
  └──────────────────────────────────────────────┘
```

Reutiliza `ExercisePicker` — el mismo selector de pantalla completa con búsqueda
y filtros que ya usa «Agregar ejercicio». El resumen colapsado de la tarjeta
gana un sufijo: `3 × 10 reps · descanso 60s · con alternativa`.

Detalle a cuidar: el picker no debe permitir elegir el mismo ejercicio como su
propia alternativa.

---

## Interfaz — atleta

El usuario planteó dos caminos: un mensaje discreto, o deslizar la pantalla.
La primera versión implementó un botón discreto que abría una hoja de
confirmación ("¿Muy difícil? Cambia a X" → modal con video y nota → "Cambiar a
este" / "Seguir con el original"). Al probarlo, la corrección fue: no debe
haber confirmación. El atleta necesita poder **ver ambos ejercicios y decidir
cuál puede hacer**, no comprometerse a uno tras un solo tap.

**Decidido: un interruptor de dos posiciones (`AlternativeSwitch`), no un modal
de confirmación ni swipe.** Es un control con las dos opciones visibles a la
vez — el ejercicio planeado y su alternativa, uno al lado del otro — donde
tocar cualquiera de los dos lados cambia al instante qué video y nombre
muestra el resto de la pantalla. El atleta puede ir y venir las veces que
quiera antes de hacer la serie; no hay paso de "confirmar" porque no hace
falta: alternar ya es ver el resultado. Lo que queda grabado es cualquiera de
los dos lados esté activo en el momento de tocar "Terminé esta serie".

### Durante la serie — `SetExecution`

Debajo del nombre del ejercicio, junto al botón de indicaciones que ya existe:

```
Lagartijas                                    (i)

┌──────────────────────────────────────────────────┐
│  Lagartijas   │   Lagartijas con rodillas          │
└──────────────────────────────────────────────────┘
     (activo)
```

Tocar el lado no activo cambia al instante el nombre, el video y el título de
toda la pantalla a esa versión — series, tempo, descanso e indicaciones no se
mueven, se heredan del ejercicio planeado sin importar cuál lado esté activo.
Cambiar de lado nunca descarta las series ya hechas.

### Durante el descanso — `RestTimer`

El momento en que el atleta sabe que no va a poder con la siguiente serie es
justo el descanso posterior a la que le costó. El mismo interruptor aparece
ahí, en la línea que ya anuncia el ejercicio que viene, en tamaño reducido.

### Antes de empezar y en la vista de progreso

`ExerciseOverviewCard` lleva una línea `Alternativa: Lagartijas con rodillas`,
para que el atleta sepa desde la vista previa que la opción existe.

---

## Interfaz — qué ve el entrenador después

Que el atleta usara la alternativa es información de entrenamiento valiosa, y
hoy no hay dónde mostrarla. **Entra en esta iteración:** en el detalle de la
sesión (`sesiones/[sessionId]/session-view.tsx`), las series hechas con la
alternativa llevan una etiqueta junto al nombre del ejercicio. El dato ya está
en `set_record`, así que es solo pintarlo.

---

## Plan de trabajo

Cada paso deja el repo funcionando; los pasos 1–2 no cambian nada visible.

| # | Paso | Archivos |
|---|---|---|
| 1 | Tipo `RoutineExerciseAlternative` + campo `alternative`; `flattenContent` lo propaga | `packages/db/src/schema/routines.ts`, `apps/api/src/services/routine-content.ts` |
| 2 | Columna `performed_exercise_id` + migración generada con drizzle-kit | `packages/db/src/schema/sessions.ts`, `packages/db/src/migrations/` |
| 3 | El entrenador puede asignar la alternativa en la plantilla | `plantillas/[routineId]/page.tsx` |
| 4 | `myProgress` resuelve el catálogo de la alternativa (nombre, video) y lo expone en `WorkoutExercise` | `apps/api/src/routers/sessions.ts` |
| 5 | `recordSet` acepta y guarda `performedExerciseId` | `apps/api/src/routers/sessions.ts` |
| 6 | El atleta cambia de ejercicio en el runner (hoja + estado + vistas previas) | `apps/web/src/components/workout-runner.tsx` |
| 7 | ~~Atribución del RM~~ — no aplica: `sessions.complete` solo calcula PR en evaluación, y ahí no hay alternativas | — |
| 8 | Mismo recorrido para el invitado | `apps/api/src/routers/share.ts` |
| 9 | El entrenador ve qué series se hicieron con la alternativa | `sesiones/[sessionId]/session-view.tsx` |

El paso 2 sigue el flujo de `docs/migraciones.md`: se modifica el schema y se
genera con `pnpm --filter @atleta/db generate`. Nunca SQL a mano.

---

## Decisiones

| Decisión | Resuelto |
|---|---|
| **Progreso de la alternativa** | Récord propio, en principio — pero hoy no hay PR de rutinas de entrenamiento que atribuir (ver hallazgo arriba); queda como criterio para cuando exista |
| **Visibilidad para el entrenador** | Entra en esta iteración, como etiqueta en el detalle de la sesión |
| **¿Puede volver al ejercicio original a media rutina?** | Sí — por eso el dato se guarda por serie y no por ejercicio |
| **Cómo cambia el atleta** | Interruptor de dos posiciones (`AlternativeSwitch`), no deslizar ni un modal de confirmación — ve ambos y alterna libremente |
