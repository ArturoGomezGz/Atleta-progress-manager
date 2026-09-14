# Generación de rutinas con IA — Guía de planificación

> **Estado:** Feature experimental. Base para el system prompt y el formulario de input.
> **Fecha:** 2026-09-13
> **Contexto:** El entrenador describe la sesión que quiere; un LLM (OpenAI con tool use) busca ejercicios con `search_exercises`, puede proponer ejercicios con `propose_new_exercise` y devuelve un `RoutineContent` que el entrenador revisa antes de guardar. **Cuanto más completo el input, mejor la rutina.**

---

## 0. Restricciones del modelo de datos (leer antes que nada)

Fuentes: `packages/db/src/schema/routines.ts`, `apps/api/src/routers/routines.ts` (zod), `packages/db/src/schema/exercises.ts`, `packages/db/src/schema/exercise-catalogs.ts`.

### Enums exactos

| Campo | Valores |
|---|---|
| `goal` (por ejercicio) | `strength` · `hypertrophy` · `endurance` · `power` · `cardio` · `recovery` |
| `setType` | `reps` · `time` · `distance` · `amrap` |
| `loadType` | `fixed_kg` · `percent_rm` · `rpe` |
| `exercise.difficulty` | `beginner` · `intermediate` · `advanced` (nullable) |
| `exercise.movementPatterns[]` | `push` · `pull` · `squat` · `hinge` · `carry` · `rotation` · `isometric` · `mobility` · `core` |
| `exercise.suitableFor` | `warmup` · `evaluation` (nullable) |
| `muscleGroup.bodyZone` | `upper` · `lower` · `core` |
| `exercise.contraindications` | texto libre (nullable) |

### Reglas de validación que el output debe cumplir (zod)

| Regla | Consecuencia para el LLM |
|---|---|
| `items[].type` es `"exercise"` o `"block"` (discriminated union) | Siempre incluir `type`. |
| `id` y `exerciseId` son `uuid` | `exerciseId` solo de `search_exercises`/`propose_new_exercise`. Los `id` de ítem/bloque **los asigna el backend** (`crypto.randomUUID()`); el modelo puede enviar placeholders. |
| `order` entero ≥ 0 | Numerar 0..n dentro de `items` y dentro de cada `block.exercises`. |
| `sets` mínimo 1; `setNumber` ≥ 1 | Nunca ejercicio sin series. |
| `restSeconds`, `targetReps`, `targetDurationSeconds`, `targetDistanceMeters` enteros **positivos** | Descanso 0 → **omitir** el campo, no enviar `0`. |
| `loadValue` número positivo (admite decimales) | RPE 7.5 válido. Sin carga → omitir `loadType` y `loadValue`. |
| `block.rounds` entero ≥ 2 | Un "bloque" de 1 ronda no existe: usar ejercicios sueltos. |
| `routineContentSchema` solo declara `v` e `items` | `mode` y `circuitRounds` existen en el tipo TS pero **el zod los descarta**. Legado: no usarlos; los circuitos se modelan como `block`. |
| No hay campo "sección" (calentamiento, principal…) | La estructura se expresa con **bloques con `name`** ("Calentamiento", "Vuelta a la calma") u orden + `notes`. |
| UI del builder soporta hoy `reps` y `time` | Preferir `reps`/`time`. `distance` y `amrap` solo si el input lo pide explícitamente. |

### Semántica de campos

- `tempo`: `"E-P-C-P"` (excéntrico-pausa-concéntrico-pausa, segundos). `X` = explosivo. Ej. `"3-1-X-0"`.
- `restSeconds` en ejercicio suelto: descanso entre series. En ejercicio dentro de bloque: descanso **tras ese ejercicio** antes del siguiente (el último del bloque = descanso entre rondas).
- En un bloque, cada ejercicio lleva normalmente **1 set** (se repite `rounds` veces). Multiplicar sets × rounds duplica el volumen — evitarlo.
- `loadValue` según `loadType`: kg, % de 1RM (1–100) o RPE (1–10).
- `percent_rm` solo es útil si el atleta tiene RM registrado (`exercise_rm`, ver `docs/rm-atleta.md`); la app muestra el % como referencia.

---

## 1. Principios de diseño de una sesión

### 1.1 Estructura

| Fase | Duración típica | Contenido | Modelado |
|---|---|---|---|
| Calentamiento general | 3–5 min | Cardio suave, movilidad global | Bloque `"Calentamiento"`, `goal: recovery` o `cardio`, sets `time` |
| Calentamiento específico | 3–8 min | Activación + series de aproximación del primer ejercicio principal | Ejercicios con `suitableFor: warmup` en el bloque; aproximaciones como sets extra ligeros (RPE 5–6) del ejercicio principal o en `notes` |
| Bloque principal | 40–60% del tiempo | 1–3 ejercicios del objetivo principal | Ejercicios sueltos con `goal` del objetivo |
| Accesorios | 20–35% | Compuestos secundarios, aislados, core | Sueltos o superseries (bloques de 2) |
| Vuelta a la calma | 3–10 min | Respiración, movilidad, estiramiento suave | Bloque `"Vuelta a la calma"` o ejercicios sueltos, `goal: recovery`, `setType: time` |

### 1.2 Orden de ejercicios

1. Potencia / pliometría / técnicos (olímpicos, saltos, sprints) — con el sistema nervioso fresco.
2. Compuestos pesados multiarticulares (sentadilla, peso muerto, press, dominadas).
3. Compuestos secundarios / unilaterales.
4. Aislados.
5. Core y carries (el core fatigado antes de un compuesto pesado compromete la estabilidad).
6. Acondicionamiento metabólico al final (salvo que el objetivo de la sesión sea cardio).

### 1.3 Balance de patrones (`movementPatterns`)

- Sesión full body: cubrir al menos `squat` o `hinge` + `push` + `pull` + `core`.
- Tren superior: ratio `push`:`pull` ≈ 1:1 (o 1:1.5 a favor de `pull` en poblaciones con postura cifótica / hombro).
- Tren inferior: combinar dominante de rodilla (`squat`) y de cadera (`hinge`), ≥ 1 unilateral si hay tiempo.
- Añadir `carry`/`rotation`/`isometric` como antirotación/estabilidad si el foco es rendimiento o salud general.
- No repetir el mismo patrón pesado dos veces seguidas salvo intención explícita (p. ej. especialización).

### 1.4 Gestión de fatiga

- Máximo 2 ejercicios a RPE ≥ 9 por sesión; el resto RPE 7–8.
- Dejar 1–3 repeticiones en reserva (RIR) por defecto; ir al fallo solo en aislados del final y nunca en principiantes.
- El volumen alto y la intensidad alta no se combinan en el mismo ejercicio.
- Ejercicios técnicamente exigentes → reps bajas, descanso completo, nunca en circuito metabólico.
- Si se incluye acondicionamiento intenso, reducir volumen de accesorios.

---

## 2. Parámetros por objetivo

| Objetivo (`goal`) | Series/ejercicio | Reps / duración (`setType`) | Carga (`loadType` · `loadValue`) | Descanso (`restSeconds`) | `tempo` | Volumen por sesión |
|---|---|---|---|---|---|---|
| **Fuerza** `strength` | 3–6 | `reps` 1–6 | `percent_rm` 80–95 · o `rpe` 7–9 | 150–300 | `"2-1-1-0"` / controlado | 2–3 ejercicios principales; 12–25 series de trabajo totales |
| **Hipertrofia** `hypertrophy` | 3–4 | `reps` 6–15 | `percent_rm` 65–80 · o `rpe` 7–9 | 60–120 (compuestos 90–150) | `"3-0-1-0"` / `"2-1-1-1"` | 4–7 ejercicios; 15–25 series; 6–12 series por grupo muscular en la sesión como techo razonable |
| **Resistencia muscular** `endurance` | 2–4 | `reps` 15–30 · o `time` 30–60 s | `percent_rm` 40–65 · o `rpe` 6–8 · o sin carga | 30–60 | `"2-0-1-0"` | 4–8 ejercicios, bloques/circuitos frecuentes |
| **Potencia** `power` | 3–6 | `reps` 1–5 (saltos/lanzamientos 3–6) | `percent_rm` 30–70 (según ejercicio) · o `rpe` 6–8 · o sin carga | 120–240 | `"X"` concéntrico: `"2-0-X-0"` | 1–3 ejercicios al inicio; calidad > volumen; parar si baja la velocidad |
| **Cardio / acondicionamiento** `cardio` | 1 (sostenido) o 4–10 intervalos | `time` 20 s–30 min · `distance` si se pide | `rpe` 6–9 (intervalos) / 4–6 (continuo) | intervalos 1:1 a 1:3 trabajo:pausa; continuo sin descanso (omitir) | — (omitir) | 10–30 min efectivos |
| **Recuperación / movilidad** `recovery` | 1–3 | `time` 30–90 s · o `reps` 8–12 lentas | `rpe` 2–4 · o sin carga | omitir o 15–30 | `"3-2-3-0"` lento opcional | 6–10 ejercicios, 20–45 min, intensidad baja |

Notas:
- `goal` es **por ejercicio**: una sesión de fuerza lleva `strength` en principales, `hypertrophy` en accesorios, `recovery` en calentamiento/vuelta a la calma.
- `amrap` solo como última serie de test o en finishers; no en principiantes con cargas externas.
- Isométricos (`movementPatterns: isometric`): `setType: time`, 20–45 s.

---

## 3. Ajustes

### 3.1 Por nivel

| Aspecto | Principiante | Intermedio (default) | Avanzado |
|---|---|---|---|
| `exercise.difficulty` a elegir | `beginner` (evitar `advanced`) | `beginner`/`intermediate` | todos |
| Nº ejercicios | 4–6 | 5–7 | 5–8 |
| Series de trabajo/ejercicio | 2–3 | 3–4 | 3–6 |
| Intensidad | RPE 6–7; sin `percent_rm` | RPE 7–8; `percent_rm` ≤ 85 si hay RM | RPE 8–9; `percent_rm` hasta 95 |
| `loadType` preferido | `rpe` o sin carga | `rpe` | `percent_rm` (si hay RM) o `rpe` |
| Fallo / AMRAP | No | Solo aislados finales | Sí, dosificado |
| Complejidad | Patrones básicos, bilaterales, máquinas/peso corporal | Libres, unilaterales | Olímpicos, pliometría intensa, técnicas avanzadas |
| Tempo | Controlado, sin explosivo con carga | Libre | Específico (pausas, excéntricos lentos) |
| Calentamiento | Más largo (8–12 min) | 6–10 min | 5–10 min |
| `notes` | Claves técnicas breves | Opcional | Intención / autorregulación |

### 3.2 Por duración disponible

Estimación de tiempo por serie: `tiempo_serie ≈ duración de ejecución (30–60 s) + restSeconds`. El modelo debe **sumar** y ajustarse ±10% a la duración pedida.

| Duración | Calentamiento | Principal | Accesorios | Vuelta a la calma | Nº ejercicios de trabajo | Series de trabajo totales |
|---|---|---|---|---|---|---|
| 30 min | 4–5 min | 1–2 ej. (fuerza: 1) | 1–2 ej. o 1 superserie | 2–3 min | 3–4 | 9–12 (usar superseries/circuitos) |
| 45 min | 5–7 min | 2 ej. | 2–3 ej. | 3–5 min | 4–5 | 12–18 |
| 60 min | 8–10 min | 2–3 ej. | 3–4 ej. | 5 min | 5–7 | 16–24 |
| 90 min | 10–12 min | 3 ej. | 4–5 ej. | 5–10 min | 7–9 | 22–30 |

- Si falta tiempo: primero agrupar accesorios en superseries, luego reducir series de accesorios, nunca recortar el calentamiento del principal pesado.
- Fuerza pura con descansos de 3–5 min consume ~5 min/serie: en 60 min caben ~8–10 series pesadas + accesorios en superserie.

---

## 4. Bloques y circuitos

Todo circuito se modela como `{ type: "block", rounds ≥ 2, exercises: [...] }`. **No usar `mode`/`circuitRounds`.**

| Formato | Cuándo | Modelado |
|---|---|---|
| **Superserie antagonista** (push/pull, cuádriceps/isquios) | Ahorrar tiempo en accesorios o hipertrofia | Bloque de 2 ejercicios, `rounds` 3–4, `restSeconds` 15–30 en el 1º y 60–90 en el 2º |
| **Superserie agonista / biserie** | Hipertrofia avanzada | Igual, solo intermedio/avanzado |
| **Circuito de calentamiento** | Movilidad + activación | Bloque `"Calentamiento"`, `rounds` 2, sets `time` 30–45 s, `goal: recovery` |
| **Circuito metabólico** | Acondicionamiento, resistencia, poco tiempo, sin equipo | Bloque 4–6 ejercicios, `rounds` 3–5, `time` 30–45 s trabajo, `restSeconds` 15–20 entre ejercicios y 60–120 en el último |
| **EMOM** (every minute on the minute) | Densidad, técnica bajo fatiga moderada | Bloque, `rounds` = minutos/nº ejercicios; sets `reps` fijas; `notes: "EMOM: empieza cada minuto; descansa lo que sobre"`; omitir `restSeconds` |
| **AMRAP por tiempo** (máximas rondas en X min) | Finisher intermedio/avanzado | Bloque con `rounds` estimado (mín. 2) y `notes: "AMRAP 12 min: rondas máximas"`; o un ejercicio suelto con `setType: amrap` si es un solo ejercicio |
| **Intervalos** (HIIT, Tabata) | Cardio | Ejercicio suelto con N sets `time` + `restSeconds` (pausa), o bloque si alterna ejercicios |

No meter en circuitos: ejercicios `strength`/`power` pesados, olímpicos, ejercicios `advanced` para principiantes.

---

## 5. Seguridad

- **Contraindicaciones:** leer `contraindications` de cada ejercicio devuelto por `search_exercises`. Si coincide con una lesión/limitación del input (hombro, rodilla, lumbar, embarazo, hipertensión…), descartarlo y buscar alternativa.
- **Limitaciones típicas → sustituciones:**
  - Lumbar: evitar `hinge` pesado con barra y flexión cargada; preferir hip thrust, puente, bird-dog, isométricos de core.
  - Rodilla: evitar pliometría e impacto; limitar rango en `squat`; preferir cajón, trineo, isométricos.
  - Hombro: evitar press por encima de la cabeza y dips; preferir landmine, agarre neutro, trabajo de `pull` y rotadores.
  - Hipertensión / embarazo: evitar Valsalva, isometrías máximas, RPE > 7; notas de respiración.
- **Carga:**
  - Sin RM conocido → `rpe`. Nunca `percent_rm` si el input no indica que existen RM.
  - **Nunca `fixed_kg` inventado.** Solo si el entrenador da los kg (o el input incluye marcas).
  - Peso corporal → omitir `loadType`/`loadValue` (o `rpe` para dosificar esfuerzo).
- **Principiantes:** sin fallo, sin olímpicos, sin pliometría de alto impacto, RPE ≤ 7.
- **Dolor:** añadir en `notes` de ejercicios de riesgo: "Detener si hay dolor articular".
- La IA **propone**; el entrenador valida. Nunca presentar la rutina como prescripción médica.

---

## 6. Especificación del input (formulario)

### Obligatorios

| Campo | Tipo | Por qué importa |
|---|---|---|
| `goal` — objetivo principal | enum: `strength` · `hypertrophy` · `endurance` · `power` · `cardio` · `recovery` | Define series, reps, carga, descanso y orden (§2). Es el mayor determinante de calidad. |
| `durationMinutes` | enum: 30 · 45 · 60 · 90 (o entero 15–120) | Determina nº de ejercicios y formato (§3.2). |

### Opcionales (con default)

| Campo | Tipo | Por qué importa | Default si vacío |
|---|---|---|---|
| `level` | `beginner` · `intermediate` · `advanced` | Dificultad de ejercicios, intensidad, volumen (§3.1) | `intermediate`, carga en `rpe` conservadora (≤ 8) |
| `includeWarmup` | boolean | Añade bloque "Calentamiento" y descuenta tiempo | `true` |
| `includeCooldown` | boolean | Añade bloque "Vuelta a la calma" | `true` si `durationMinutes` ≥ 45, si no `false` |
| `equipment` | lista de ids/nombres de `equipment` | Filtra `search_exercises`; evita ejercicios imposibles | Gimnasio completo **si** no se indica nada en la descripción; si la descripción dice "en casa"/"sin equipo" → peso corporal |
| `focus` | músculos/grupos (`muscleGroup`) y/o `movementPatterns` / `bodyZone` | Selección y balance de patrones | Full body equilibrado (`squat`/`hinge` + `push` + `pull` + `core`) |
| `limitations` | texto libre (lesiones, patologías) | Exclusiones vía `contraindications` (§5) | Ninguna; igualmente evitar ejercicios con contraindicaciones generales graves en principiantes |
| `format` | `traditional` · `circuit` · `mixed` | Ejercicios sueltos vs bloques (§4) | Por objetivo: `strength`/`power`/`hypertrophy` → `traditional` (superseries permitidas en accesorios si falta tiempo); `endurance`/`cardio` → `circuit`; `recovery` → `circuit` suave |
| `loadPreference` | `rpe` · `percent_rm` · `none` | Tipo de carga | `rpe` (`none` para peso corporal y movilidad) |
| `hasKnownRM` | boolean | Habilita `percent_rm` | `false` |
| `description` | texto libre | Contexto: deporte, fase, preferencias, ejercicios obligatorios/vetados | Vacío; el modelo se basa solo en campos estructurados |
| `athleteCount` / contexto grupal | entero o boolean `isGroup` | En grupo: ejercicios con poco equipo compartido y fáciles de supervisar | Individual |

Conflictos: los campos estructurados mandan sobre `description`, salvo en seguridad (una lesión mencionada en la descripción siempre se respeta).

---

## 7. Reglas para el LLM (pegar en el system prompt)

```
Eres un preparador físico (strength & conditioning) basado en evidencia. Diseñas UNA sesión de entrenamiento que un entrenador revisará antes de guardar.

HERRAMIENTAS Y DATOS
1. Usa SOLO exerciseId devueltos por search_exercises (o por propose_new_exercise). Nunca inventes ni modifiques un UUID.
2. Busca antes de proponer: haz varias búsquedas (por nombre, patrón, músculo, equipamiento) antes de concluir que no existe un ejercicio.
3. No propongas ejercicios nuevos si existe un equivalente razonable en el catálogo. Máximo 2 ejercicios propuestos por rutina.
4. Filtra por el equipamiento disponible. Si no se indica y la descripción sugiere casa/sin equipo, usa solo peso corporal.
5. Lee contraindications de cada ejercicio; descarta los que choquen con las limitaciones del atleta y busca una alternativa.
6. Respeta difficulty: principiante → beginner (intermediate solo si no hay alternativa); nunca advanced para principiantes.

DEFAULTS
7. Si falta el nivel, asume intermedio y usa RPE ≤ 8.
8. Si falta includeWarmup, incluye calentamiento. Si falta includeCooldown, inclúyelo cuando la sesión dure ≥ 45 min.
9. Si falta el foco, diseña full body equilibrado (squat o hinge + push + pull + core).
10. Si falta el formato: fuerza, potencia e hipertrofia → tradicional; resistencia y cardio → circuito; recuperación → circuito suave.
11. Los campos estructurados mandan sobre la descripción libre, excepto lesiones o limitaciones, que siempre se respetan.

ESTRUCTURA
12. Orden: calentamiento → potencia/técnicos → compuestos principales → compuestos secundarios → aislados → core → acondicionamiento → vuelta a la calma.
13. Modela calentamiento y vuelta a la calma como bloques con name "Calentamiento" / "Vuelta a la calma" (rounds ≥ 2) o como ejercicios sueltos con goal "recovery".
14. Ajusta el total estimado (ejecución ~30–60 s por serie + restSeconds) a la duración pedida ±10%.
15. Aplica los rangos de series, reps, carga, descanso y tempo del objetivo. Asigna goal por ejercicio (principales = objetivo; accesorios pueden ser hypertrophy; calentamiento/vuelta a la calma = recovery).
16. Equilibra patrones: no dos ejercicios pesados del mismo patrón seguidos; tren superior push:pull ≈ 1:1.
17. Como máximo 2 ejercicios a RPE ≥ 9. Sin fallo ni AMRAP con carga para principiantes.

CARGA
18. Sin RM conocido usa loadType "rpe". Usa "percent_rm" solo si el input indica que el atleta tiene RM.
19. Nunca uses "fixed_kg" salvo que el entrenador haya dado los kilos.
20. En ejercicios de peso corporal o movilidad, omite loadType y loadValue.

FORMATO DE SALIDA (RoutineContent)
21. Devuelve { "v": 1, "items": [...] }. No uses "mode" ni "circuitRounds": los circuitos son items { "type": "block", "rounds": N ≥ 2, "exercises": [...] }.
22. Todo item lleva "type" ("exercise" o "block") y "order" entero desde 0; los ejercicios dentro de un bloque también llevan order desde 0.
23. Todo ejercicio lleva al menos 1 set con setNumber desde 1. En bloques, normalmente 1 set por ejercicio (se repite en cada ronda).
24. Usa setType "reps" o "time". "distance" y "amrap" solo si el entrenador lo pide.
25. Enteros positivos en restSeconds, targetReps, targetDurationSeconds, targetDistanceMeters. Si el descanso es 0, omite restSeconds.
26. tempo con formato "E-P-C-P" (ej. "3-1-X-0"); omítelo si no aporta.
27. notes: breves (≤ 120 caracteres), en español, con claves técnicas o de seguridad; para EMOM/AMRAP explica el formato.
28. Los campos "id" pueden ir como placeholder; el servidor asigna UUIDs.
29. Añade un nombre de rutina corto y una justificación de 2–4 frases (objetivo, estructura, supuestos tomados por falta de datos).
```

---

## 8. Ejemplos

### 8.1 Fuerza tren inferior — 60 min, intermedio, con calentamiento

**Input**
```json
{
  "goal": "strength", "durationMinutes": 60, "level": "intermediate",
  "includeWarmup": true, "includeCooldown": true,
  "equipment": ["Barra olímpica", "Discos", "Rack", "Mancuernas", "Banco"],
  "focus": { "bodyZone": "lower", "movementPatterns": ["squat", "hinge"] },
  "limitations": "", "format": "traditional", "hasKnownRM": false,
  "description": "Fase de fuerza, atleta de rugby. Prioridad sentadilla."
}
```

**Rutina resultante**

| # | Ítem | Series × reps | Carga | Descanso | Tempo / notas |
|---|---|---|---|---|---|
| 0 | **Bloque "Calentamiento" ×2**: bici/remo 2 min · sentadilla goblet ×8 · puente de glúteo ×10 · movilidad de cadera 40 s | 1 set/ejercicio | sin carga / RPE 5 | 15 s entre ej. | `recovery` |
| 1 | Sentadilla trasera (`squat`, `strength`) | 2 aproximación ×5/×3 + 4×4 | RPE 5–6 aprox.; trabajo RPE 8 | 180 s | `"2-1-1-0"` |
| 2 | Peso muerto rumano (`hinge`, `strength`) | 3×6 | RPE 7–8 | 150 s | `"3-0-1-0"` |
| 3 | **Bloque "Accesorios" ×3**: zancada búlgara ×8/pierna (`hypertrophy`) · plancha lateral 30 s/lado (`core`) | 1 set/ejercicio | RPE 8 / sin carga | 30 s tras búlgara, 60 s tras plancha | — |
| 4 | Curl nórdico asistido (`hinge`, `hypertrophy`) | 3×5 | RPE 7 | 90 s | Excéntrico 4 s |
| 5 | **Bloque "Vuelta a la calma" ×2**: estiramiento flexores de cadera 45 s · respiración diafragmática 60 s | 1 set/ejercicio | — | — | `recovery` |

Estimación: calentamiento ~8 min · sentadilla ~20 min · RDL ~10 min · accesorios ~9 min · nórdico ~6 min · calma ~4 min ≈ 57 min.

**Fragmento JSON válido (`RoutineContent`)**
```json
{
  "v": 1,
  "items": [
    {
      "type": "block",
      "id": "<uuid asignado por servidor>",
      "order": 0,
      "name": "Calentamiento",
      "rounds": 2,
      "exercises": [
        {
          "id": "<uuid asignado por servidor>",
          "exerciseId": "<exerciseId de search_exercises: sentadilla goblet>",
          "order": 0,
          "goal": "recovery",
          "restSeconds": 15,
          "sets": [{ "setNumber": 1, "setType": "reps", "targetReps": 8, "loadType": "rpe", "loadValue": 5 }]
        },
        {
          "id": "<uuid asignado por servidor>",
          "exerciseId": "<exerciseId de search_exercises: puente de glúteo>",
          "order": 1,
          "goal": "recovery",
          "restSeconds": 15,
          "sets": [{ "setNumber": 1, "setType": "reps", "targetReps": 10 }]
        }
      ]
    },
    {
      "type": "exercise",
      "id": "<uuid asignado por servidor>",
      "exerciseId": "<exerciseId de search_exercises: sentadilla trasera>",
      "order": 1,
      "goal": "strength",
      "tempo": "2-1-1-0",
      "restSeconds": 180,
      "notes": "Series 1-2 de aproximación. Profundidad paralela, detener si duele la rodilla.",
      "sets": [
        { "setNumber": 1, "setType": "reps", "targetReps": 5, "loadType": "rpe", "loadValue": 5 },
        { "setNumber": 2, "setType": "reps", "targetReps": 3, "loadType": "rpe", "loadValue": 6 },
        { "setNumber": 3, "setType": "reps", "targetReps": 4, "loadType": "rpe", "loadValue": 8 },
        { "setNumber": 4, "setType": "reps", "targetReps": 4, "loadType": "rpe", "loadValue": 8 },
        { "setNumber": 5, "setType": "reps", "targetReps": 4, "loadType": "rpe", "loadValue": 8 },
        { "setNumber": 6, "setType": "reps", "targetReps": 4, "loadType": "rpe", "loadValue": 8 }
      ]
    },
    {
      "type": "exercise",
      "id": "<uuid asignado por servidor>",
      "exerciseId": "<exerciseId de search_exercises: peso muerto rumano>",
      "order": 2,
      "goal": "strength",
      "tempo": "3-0-1-0",
      "restSeconds": 150,
      "sets": [
        { "setNumber": 1, "setType": "reps", "targetReps": 6, "loadType": "rpe", "loadValue": 7.5 },
        { "setNumber": 2, "setType": "reps", "targetReps": 6, "loadType": "rpe", "loadValue": 7.5 },
        { "setNumber": 3, "setType": "reps", "targetReps": 6, "loadType": "rpe", "loadValue": 8 }
      ]
    },
    {
      "type": "block",
      "id": "<uuid asignado por servidor>",
      "order": 3,
      "name": "Accesorios",
      "rounds": 3,
      "exercises": [
        {
          "id": "<uuid asignado por servidor>",
          "exerciseId": "<exerciseId de search_exercises: zancada búlgara>",
          "order": 0,
          "goal": "hypertrophy",
          "restSeconds": 30,
          "notes": "8 por pierna",
          "sets": [{ "setNumber": 1, "setType": "reps", "targetReps": 8, "loadType": "rpe", "loadValue": 8 }]
        },
        {
          "id": "<uuid asignado por servidor>",
          "exerciseId": "<exerciseId de search_exercises: plancha lateral>",
          "order": 1,
          "goal": "endurance",
          "restSeconds": 60,
          "notes": "30 s por lado",
          "sets": [{ "setNumber": 1, "setType": "time", "targetDurationSeconds": 30 }]
        }
      ]
    }
  ]
}
```
(Ejercicio 4 y bloque de vuelta a la calma omitidos por brevedad; siguen el mismo patrón.)

### 8.2 Circuito de acondicionamiento — 30 min, principiante, sin equipo

**Input:** `goal: cardio` · `durationMinutes: 30` · `level: beginner` · `includeWarmup: true` · `includeCooldown: false` (default <45) · `equipment: []` · `format: circuit` · `description: "Grupo de adultos, en parque, mejorar condición general."`

| # | Ítem | Dosificación | Carga | Descanso | Notas |
|---|---|---|---|---|---|
| 0 | **Bloque "Calentamiento" ×2**: marcha con elevación de rodillas · círculos de brazos · sentadilla al aire lenta | 30 s cada uno (`time`) | sin carga | 10 s | `recovery` |
| 1 | **Bloque "Circuito" ×4**: sentadilla al aire · flexiones inclinadas (manos en banco del parque) · jumping jacks sin salto (step jacks) · puente de glúteo · plancha frontal en rodillas | 30 s cada uno (`time`), `goal: cardio`/`endurance` | `rpe` 6–7 | 30 s entre ej.; 90 s tras el último | "Ritmo que permita hablar con frases cortas" |
| 2 | Estiramientos guiados (2–3 ejercicios sueltos) | 1×40 s | — | — | `recovery`, opcional |

Estimación: calentamiento ~4 min · circuito 4 × (5 × 60 s) + 3 × 90 s ≈ 24.5 min ≈ 29 min. Sin impacto (principiante, grupo), todo `difficulty: beginner`.

### 8.3 Recuperación / movilidad — 40 min, intermedio, post-partido

**Input:** `goal: recovery` · `durationMinutes: 40` · `level: intermediate` · `includeWarmup: false` · `includeCooldown: true` · `equipment: ["Foam roller", "Banda elástica"]` · `limitations: "Sobrecarga en isquiotibiales"` · `description: "Día después de partido de fútbol."`

| # | Ítem | Dosificación | Carga | Descanso | Notas |
|---|---|---|---|---|---|
| 0 | Bici o caminata suave | 1×8 min (`time`) | `rpe` 3 | — | `recovery` |
| 1 | **Bloque "Liberación miofascial" ×2**: foam roller cuádriceps · glúteo · dorsal | 45 s cada uno | — | 15 s | Evitar rodar isquios directamente con dolor |
| 2 | **Bloque "Movilidad" ×2**: 90/90 de cadera · rotación torácica en cuadrupedia · dorsiflexión de tobillo en pared · gato-camello | 8 reps lentas o 40 s | — | 15 s | `movementPatterns: mobility`, tempo `"3-2-3-0"` |
| 3 | **Bloque "Activación suave" ×2**: puente de glúteo · dead bug · pull-apart con banda | 10 reps | `rpe` 4 | 20 s | Sin `hinge` cargado (limitación isquios) |
| 4 | Respiración diafragmática en decúbito | 1×3 min | — | — | Vuelta a la calma |

---

## 9. Input pobre vs input rico

### Input pobre
```
description: "Rutina de piernas"
```
Qué hace el modelo (todo defaults): `goal` inferido `hypertrophy` (ambiguo), intermedio, 60 min supuesto, gimnasio completo, RPE, calentamiento genérico.

Resultado típico: sentadilla 4×10 · prensa 3×12 · extensión de cuádriceps 3×12 · curl femoral 3×12 · gemelos 3×15.
Problemas: sin prioridad clara, sesgo a cuádriceps, puede usar máquinas que el atleta no tiene, ignora lesiones no declaradas, duración real desconocida, cargas genéricas. El entrenador tiene que reescribirla.

### Input rico
```json
{
  "goal": "strength", "durationMinutes": 45, "level": "advanced",
  "includeWarmup": true, "includeCooldown": false,
  "equipment": ["Barra olímpica", "Rack", "Discos", "Kettlebell"],
  "focus": { "movementPatterns": ["hinge", "squat"] },
  "limitations": "Molestia en rodilla izquierda con flexión profunda",
  "format": "traditional", "hasKnownRM": true, "loadPreference": "percent_rm",
  "description": "Powerlifter a 6 semanas de competencia. Peso muerto es prioridad."
}
```
Resultado:
- Calentamiento 6 min: movilidad de cadera + kettlebell swing 2×10 RPE 6.
- Peso muerto convencional (`strength`): 5×3 al 85 %1RM, 240 s, notas "Aproximaciones libres hasta 75%".
- Box squat a paralelo (`squat`, sustituye sentadilla profunda por la rodilla): 4×3 al 75 %1RM, 180 s.
- Superserie ×3: hip thrust con barra 8 reps RPE 8 · carry con kettlebell 30 m/40 s.
- ≈ 44 min, sin ejercicios de sentadilla profunda, carga en `percent_rm` porque hay RM.

| Aspecto | Pobre | Rico |
|---|---|---|
| Objetivo | Adivinado | Fuerza, prioridad peso muerto |
| Carga | RPE genérico | `percent_rm` coherente con fase de competencia |
| Seguridad | Sin información | Sustitución por limitación de rodilla |
| Equipamiento | Puede ser inviable | 100% disponible |
| Duración | Supuesta | Ajustada a 45 min |
| Revisión del entrenador | Reescritura | Ajustes menores |

**Implicación de UI:** mostrar `goal` y `durationMinutes` como obligatorios, y un indicador de "calidad del input" que suba al completar `level`, `equipment`, `limitations` y `focus`.

---

## 10. Implementación actual

| Pieza | Archivo |
|---|---|
| System prompt (deriva de §7, mantener sincronizado) | `apps/api/src/services/ai-routines-prompt.ts` |
| Bucle de tools (`search_exercises`, `propose_new_exercise`, `submit_routine`), validación y conversión a `RoutineContent` | `apps/api/src/services/ai-routines.ts` |
| Endpoints `routines.aiAvailable` y `routines.generateWithAI` | `apps/api/src/routers/routines.ts` |
| Acceso experimental por allowlist | `apps/api/src/services/feature-access.ts` |
| Formulario y panel en el editor de plantillas | `apps/web/src/components/ai-routine-generator.tsx`, `apps/web/src/app/(app)/teams/[teamId]/plantillas/[routineId]/page.tsx` |

Diferencias con esta guía:
- El modelo **no envía** `id`, `order` ni `setNumber`; el servidor los asigna según el orden de los arrays. Los ids de ejercicio que no salieron de una tool se rechazan y se le pide corregir.
- Solo `setType` `reps`/`time` (lo que soporta el editor).
- `fixed_kg` se muestra en libras en la app; el prompt pide libras.
- Todavía no hay `loadPreference` ni `isGroup`: se infieren de `hasKnownRM` y de la descripción.
- Los ejercicios propuestos (máx. 2) se crean al generar como ejercicios privados del equipo, sin video. Si el entrenador descarta la rutina, quedan en el catálogo del equipo.
- Modelo: `gpt-4o-mini`, máximo 10 turnos. El consumo de tokens se registra en consola (`[ai-routines]`).

### Habilitar para un equipo o usuario

Variables de entorno de la API (listas separadas por comas; requieren `OPENAI_API_KEY`):

```
AI_ROUTINES_TEAM_IDS=<uuid-equipo>,<uuid-equipo>
AI_ROUTINES_USERS=coach@ejemplo.com,<user-id>
```

Sin coincidencia, el botón no aparece y el endpoint responde `FORBIDDEN`.
