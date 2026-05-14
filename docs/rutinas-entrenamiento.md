# Rutinas de entrenamiento — Diseño exploratorio

> **Estado:** Exploración. Pendiente de decisiones antes de implementar.
> **Fecha:** 2026-05-13
> **Contexto:** La Fase 3 de rutinas normales está terminada (backend + UI atleta). Este doc captura el siguiente nivel de complejidad: el *constructor* de rutinas de entrenamiento y las variantes de ejercicio que necesita soportar.

---

## 1. El problema

Hoy las "plantillas" son contenedores simples: nombre + lista de ejercicios con series/reps/% de RM. Esto cubre el caso básico, pero hay escenarios comunes en entrenamiento que no encajan:

| Caso | Estado actual |
|------|--------------|
| Sentadilla 4×8 al 75% del RM | Funciona |
| Plancha 3×60 segundos | No — no hay campo de tiempo |
| Circuito de 4 ejercicios × 3 rondas | Parcial — `routine.type = circuit` existe en DB pero no hay UI |
| Superserie (A1 + A2 alternados) | No existe |
| AMRAP 10 min | No existe |
| Cardio: correr 3×400m | No existe |

---

## 2. Tipos de ejercicio en una rutina

### 2.1 Por repeticiones (ya existe)
El caso base. Cada serie tiene un número de reps objetivo y opcionalmente una carga.

**Especificación de carga:**
- **Peso fijo** — "60 kg" (el coach pone el número directamente)
- **% del RM** — "75% del RM de sentadilla" (requiere que el sistema conozca el RM del atleta; lo tenemos en `exercise_rm`)
- **RPE** — "RPE 8" (percepción del esfuerzo, subjetivo; el atleta calibra solo)
- **Sin carga** — solo reps (peso corporal, bandas, etc.)

> **Decisión pendiente:** ¿Calculamos el peso en kg automáticamente cuando hay % RM, o solo lo mostramos como referencia? El cálculo requiere conocer el RM *del atleta* al momento de ejecutar (puede variar).

### 2.2 Por tiempo
Serie = duración en segundos. Ej.: plancha 60s, descanso activo 30s.

**Schema necesario:** agregar `target_duration_seconds` a `routine_set_target` (nullable). Alternativa: campo `type` en `routine_set_target` (`reps` | `time` | `distance`).

### 2.3 Por distancia
Serie = metros u otra unidad. Ej.: sprint 40m × 6 series.

**Schema necesario:** `target_distance_meters` en `routine_set_target`.

### 2.4 AMRAP (As Many Reps As Possible)
El atleta hace tantas reps como pueda en un tiempo fijo o hasta el fallo. No hay target de reps — hay target de tiempo o "hasta el fallo".

**Decisión pendiente:** ¿El atleta registra cuántas reps hizo, o solo marca "completado"? Si registra reps, hay que añadir input en la UI de ejecución (cambia la promesa "sin peso ni reps" del modelo actual).

---

## 3. Estructura de la rutina

### 3.1 Secuencial simple (ya existe como `type = sequential`)
Ejercicios en orden. El atleta completa todas las series de cada ejercicio antes de pasar al siguiente.

```
Ejercicio 1: 4 series
  → Serie 1 → Serie 2 → Serie 3 → Serie 4
Ejercicio 2: 3 series
  ...
```

### 3.2 Circuito (DB existe, UI pendiente)
El atleta pasa por todos los ejercicios antes de repetir. Una "ronda" = una pasada por todos.

```
Ronda 1: Ej.A(1) → Ej.B(1) → Ej.C(1)
Ronda 2: Ej.A(2) → Ej.B(2) → Ej.C(2)
...
```

Schema actual: `routine.circuit_rounds` (número de rondas) y `routine.circuit_duration_seconds` (alternativa por tiempo).

**Decisión pendiente:** ¿Pueden coexistir ejercicios secuenciales y circuitos dentro de la misma rutina? Ej.: calentamiento secuencial + bloque de fuerza como circuito. Esto requiere agrupar ejercicios en "bloques" con tipo propio.

### 3.3 Superserie / paired set
Dos (o más) ejercicios se alternan entre sí en cada serie.

```
A1: Curl de bíceps — A2: Extensión de tríceps
Serie 1: A1 → A2
Serie 2: A1 → A2
...
```

Esto es un circuito de 2 elementos. Se podría modelar como un circuito pequeño dentro de la rutina.

**Decisión pendiente:** ¿Modelar superseries como circuitos de 2 ejercicios, o como un concepto propio? Si la respuesta es "circuitos de 2", el builder de UI debe hacerlo fácil.

### 3.4 EMOM / Tabata / protocolos especiales
EMOM (Every Minute On the Minute) y Tabata tienen estructura de tiempo rígida. Son variantes de circuito por tiempo. Fuera del alcance inmediato, pero el modelo de "bloque con tipo" los cubriría.

---

## 4. El constructor de rutinas (UI coach)

Hoy la pantalla `/plantillas/[routineId]` muestra la lista de ejercicios de la rutina. Necesita evolucionar para soportar los tipos de arriba.

### 4.1 Lo que debe poder hacer el coach

- Agregar ejercicio (buscar del catálogo)
- Reordenar ejercicios (drag-and-drop o flechas)
- Por cada ejercicio, configurar:
  - Número de series
  - Objetivo por serie: reps | tiempo | distancia | AMRAP
  - Carga: peso fijo | % RM | RPE | sin carga
  - Tempo (excéntrico-pausa-concéntrico-pausa)
  - Descanso entre series
  - Notas libres
- Configurar tipo de rutina: secuencial | circuito
  - Si circuito: número de rondas o duración total
- Agrupar ejercicios en "bloques" (para superseries o circuitos parciales)

### 4.2 Preguntas de UX abiertas

1. **¿Bloques o plano?** La lista plana es más simple de implementar. Los bloques son más expresivos pero más difíciles de construir y entender.

2. **¿Cómo define el coach una superserie?** ¿Seleccionando dos ejercicios y agrupándolos, o hay un flujo explícito "agregar superserie"?

3. **¿El tipo (reps/tiempo/distancia) es por ejercicio o por serie?** Probablemente por ejercicio — si el ejercicio es "plancha", todas las series son por tiempo.

4. **¿El cálculo de % RM es opcional o siempre visible?** Si visible, ¿mostramos el peso calculado para cada atleta asignado o solo el porcentaje?

5. **¿Qué ve el atleta cuando la serie es por tiempo?** Necesita un temporizador en la UI de ejecución, no solo un botón de "completado".

---

## 5. Cambios de schema necesarios

### Tabla `routine_set_target` — ampliar tipo de serie

| Columna nueva | Tipo | Notas |
|---|---|---|
| `set_type` | enum | `reps` \| `time` \| `distance` \| `amrap`. Default `reps`. |
| `target_duration_seconds` | integer nullable | Si `set_type = time`. |
| `target_distance_meters` | integer nullable | Si `set_type = distance`. |
| `load_type` | enum nullable | `fixed_kg` \| `percent_rm` \| `rpe`. Null = sin carga especificada. |
| `load_value` | numeric nullable | Kg, % o RPE según `load_type`. |

### Tabla `routine_block` (nueva, para circuitos/superseries)

> Solo si decidimos soportar bloques dentro de una rutina.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `routine_id` | uuid FK → routine | cascade |
| `order` | integer | Posición del bloque en la rutina |
| `type` | enum | `sequential` \| `circuit` |
| `circuit_rounds` | integer nullable | |
| `circuit_duration_seconds` | integer nullable | |
| `name` | text nullable | Ej. "Calentamiento", "Bloque A" |

Y `routine_exercise` ganaría `block_id` opcional (null = pertenece al nivel raíz de la rutina).

---

## 6. Orden de resolución de preguntas antes de implementar

1. **¿Bloques o estructura plana?** → define si se crea `routine_block` o no.
2. **¿Qué tipos de serie soportamos en v2?** → define las columnas de `routine_set_target`.
3. **¿El atleta registra output (reps hechas, peso usado) o solo "completado"?** → define si cambia la UI de ejecución del atleta.
4. **¿Cómo se calcula el % RM en la UI del atleta?** → define la query en `athleteSessions.progress`.
5. **¿Temporizador en la UI del atleta para series por tiempo?** → define el componente de ejecución.

---

## 7. Propuesta de v2 mínima (punto de entrada razonable)

Implementar solo lo necesario para el caso de uso más frecuente tras el básico:

1. **Series por tiempo** — agregar `set_type` y `target_duration_seconds` a `routine_set_target`.
2. **Temporizador en ejecución del atleta** — cuando `set_type = time`, mostrar countdown en lugar del botón de marcar.
3. **Carga: peso fijo y % RM** — agregar `load_type` y `load_value` a `routine_set_target`; mostrar peso sugerido en la UI del atleta usando su RM registrado.
4. **Circuito en UI** — usar `routine.type = circuit` que ya existe en DB para cambiar el orden de presentación en la ejecución.

Esto cubre plancha × tiempo, sentadilla con % RM y circuitos básicos sin tocar la arquitectura de bloques.
