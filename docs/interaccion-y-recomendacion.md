# Interacción y recomendación de ejercicios

> **Estado:** Plan pre-implementación. Documento de decisión — requiere elegir nivel antes de escribir código.
> **Rama:** `feat/interaccion-ejercicios` (sale de `testing`).
> **Cierra:** la decisión pendiente de `is_platform_recommended` en [`ejercicios-schema.md`](./ejercicios-schema.md) §12.

---

## 1. Objetivo

Construir un mecanismo **retroalimentado** donde la interacción real de los usuarios es el control de calidad del catálogo: los ejercicios y videos que la gente usa, completa y valora suben; los que se ignoran, se cancelan a mitad de sesión o se reportan, bajan. El sistema se corrige solo sin curación manual.

Dos consumidores del mismo score:

| Consumidor | Uso |
|---|---|
| **Búsqueda / explorar** | Orden de resultados y badge "recomendado" |
| **Calidad del catálogo** | Cola de revisión: videos rotos, metadata mala, ejercicios abandonados |

---

## 2. Inventario: qué señal ya se está escribiendo hoy

**Este es el punto central del plan.** El repositorio ya persiste casi toda la señal de comportamiento necesaria. No hay que instrumentar nada nuevo para tener una v1 útil — solo hay que *agregarla*.

| Tabla existente | Señal que contiene | Calidad de la señal |
|---|---|---|
| `exercise_save` | Guardado explícito (ya hay `saveExercise` / `unsaveExercise`) | Intención declarada. Media-alta |
| `routine.content` (jsonb) | Inclusión en plantillas — `items[].exerciseId` | Curación del coach. **Alta** |
| `session_exercise` | Ejercicio programado en una sesión **real** | Uso real. **Alta** |
| `set_record` | Series efectivamente registradas | Ejecución consumada. **Alta** |
| `athlete_session_exercise_cancelled` | El coach canceló ese ejercicio a mitad de sesión | **Señal negativa de oro** — costo cero |
| `athlete_session.rpe` | Esfuerzo percibido de la sesión | Ruidosa (es por sesión, no por ejercicio) |
| `exercise.deletedAt` / `isPublic` | Ciclo de vida | Filtro, no score |

Dos métricas derivadas de esto valen más que cualquier sistema de estrellas:

- **Tasa de consumación** = `session_exercise` con ≥1 `set_record` válido ÷ total de `session_exercise`.
  Un ejercicio que se programa pero nunca se ejecuta está mal descrito, mal ubicado o el video no sirve.
- **Tasa de cancelación** = filas en `athlete_session_exercise_cancelled` ÷ veces programado.
  El coach lo quitó estando frente al atleta. Es el juicio de calidad más honesto que existe en el producto.

> Ninguna de las dos requiere una sola escritura nueva. Ya están ahí, acumulándose.

**Lo que NO existe hoy y ninguna agregación puede inventar:**
- Señal explícita de calidad ("este video está roto", "este ejercicio está mal clasificado").
- Separación entre *ejercicio malo* y *video malo* — hoy son indistinguibles en los datos.
- Señal para ejercicios nunca usados (arranque en frío de los 638 del catálogo).
- Señal de rechazo en búsqueda (apareció, lo vieron, no lo eligieron).

---

## 3. Los cuatro niveles de registro

Cada nivel **incluye** al anterior. La diferencia real entre ellos no es el valor de la señal, es **cuánto tráfico de escritura nuevo se agrega a un Postgres que además sirve sesiones de entrenamiento en vivo**.

### Nivel 0 — Derivado puro (cero escrituras nuevas)

Solo agregación de lo que ya existe (§2). Una tabla `exercise_stats` con una fila por ejercicio, recalculada por un job periódico.

| Pros | Contras |
|---|---|
| **Cero** tráfico de escritura nuevo | No distingue ejercicio malo de video malo |
| Cero superficie de API nueva | No hay señal para ejercicios nunca usados (los 638 arrancan en 0) |
| Costo incremental ≈ $0 | Sin feedback cualitativo — sabes *qué* falla, no *por qué* |
| Sin superficie de privacidad / datos personales nuevos | Señal lenta: necesita sesiones reales acumuladas |
| **Funciona desde el día 1** con datos históricos ya acumulados | El usuario no percibe que está participando |
| Imposible de manipular: requiere sesiones reales con atletas reales | |

### Nivel 1 — + reacción explícita y reporte (1 fila por usuario/ejercicio)

Tabla `exercise_reaction` con upsert idempotente: un usuario, un ejercicio, una fila. **Acotada por diseño** — el máximo absoluto es `usuarios × ejercicios`, y en la práctica es una fracción mínima de eso.

Incluye lo más valioso del nivel: un **reporte con motivo tipado** (`video_roto`, `video_no_corresponde`, `datos_incorrectos`, `duplicado`). Esto es lo que convierte la interacción en control de calidad accionable.

| Pros | Contras |
|---|---|
| Resuelve la separación **ejercicio vs video vs metadata** | Participación baja: los coaches rara vez califican por gusto |
| Almacenamiento acotado y trivial (§4) | Sesgo al extremo positivo si se usan estrellas 1-5 |
| Alimenta una cola de admin: "ejercicios con ≥3 reportes de video" | Sigue sin resolver el arranque en frío |
| Da señal a ejercicios que aún no se han usado en sesión | Requiere UI nueva (botón + menú de reporte) |
| Sin volumen: no compite con la carga transaccional | Un reporte es un evento raro → umbrales bajos, fáciles de abusar |

> **Recomendación de forma:** binario útil / no útil + motivo, **no** estrellas de 1 a 5. Las estrellas colapsan a 4.5 promedio y no dicen nada; el binario con motivo es accionable.

### Nivel 2 — + log de eventos granulares (append-only)

Tabla `exercise_event` de solo-append: `view`, `video_play`, `video_complete`, `add_to_routine`, `search_impression`.

| Pros | Contras |
|---|---|
| **Watch-through del video** = medida directa de calidad del video | **Aquí es donde el costo se dispara** (§4) |
| CTR de búsqueda: apareció N veces, se eligió M → resuelve el sesgo de exposición | Crecimiento ilimitado: obliga a política de retención y rollup |
| Habilita "quien usó X también usó Y" | Presión de autovacuum y bloat de índices sobre la misma instancia que corre las sesiones en vivo |
| Permite análisis de embudo y depurar la búsqueda | Datos personales de comportamiento: retención y propósito deben definirse antes |
| Señal densa y rápida, no espera a que haya sesiones | Nunca puede escribirse en el camino crítico de un request |
| | Drizzle no declara particiones — requiere SQL crudo en la migración |

### Nivel 3 — + comentarios / reseñas

Tabla `exercise_comment` con texto libre.

| Pros | Contras |
|---|---|
| Feedback cualitativo irremplazable: "el video está en portugués", "ojo con rodilla" | **Moderación** — el costo real, y no es de infraestructura sino de tiempo y responsabilidad |
| Comunidad y retención entre coaches | Exposición legal por contenido generado por usuarios |
| El dueño del ejercicio puede corregirlo con contexto concreto | Con pocos usuarios se ve *muerto*, que es peor que no tenerlo |
| Almacenamiento despreciable (son pocos) | Genera expectativa de notificaciones, respuestas, reportes de abuso |
| | Moderación automática = llamada a LLM por comentario (costo por token, ya hay `OPENAI_API_KEY`) |

---

## 4. Costo en Railway

Infraestructura actual: **Postgres gestionado + API Fastify, ambos en el mismo proyecto de Railway** (el web está en Vercel). Esto importa: el log de eventos no cae en una base analítica aparte, cae **en la misma instancia que sirve el registro de series durante una sesión en vivo**.

Tarifas de referencia de Railway (verificar antes de decidir, cambian):

| Recurso | Tarifa aprox. |
|---|---|
| RAM | ~$10 / GB-mes |
| vCPU | ~$20 / vCPU-mes |
| Almacenamiento de volumen | ~$0.15 / GB-mes |
| Egress de red | ~$0.05 / GB |

### Estimación por nivel

Supuestos: 638 ejercicios públicos; una fila de evento ocupa **~150–250 B** contando encabezado de tupla, el `user_id` de better-auth (texto, no uuid — más caro de indexar) y 2 índices.

| Nivel | Filas nuevas / mes (100 coaches activos) | Almacenamiento / año | Costo directo Railway |
|---|---|---|---|
| **0** | 0 | ~64 KB (tabla de stats) | **≈ $0** |
| **1** | ~2 000 | ~5 MB | **≈ $0** (redondeo del redondeo) |
| **2** sin impresiones | ~20 000 | ~60 MB | ~$0.01 / mes |
| **2** con impresiones | ~200 000 | ~500 MB | ~$0.08 / mes |
| **3** | ~500 | despreciable | ≈ $0 en infra |

A 1 000 coaches activos, el nivel 2 con impresiones llega a ~2 M eventos/mes ≈ **5 GB/año ≈ $0.75/mes** de almacenamiento.

### La conclusión incómoda sobre el costo

**El almacenamiento es irrelevante en todos los niveles.** Menos de un dólar al mes en el peor escenario realista. Si la decisión se toma mirando la factura de disco, el nivel 3 completo sale gratis.

El costo real del nivel 2 es otro, y no aparece en la línea de almacenamiento:

1. **Contención con la carga transaccional.** Escrituras de analítica y registro de series compiten por la misma CPU y la misma RAM. Una sesión de entrenamiento en vivo es el peor momento posible para tener latencia.
2. **RAM, que sí es cara.** Una tabla de eventos que crece sin retención empuja el working set fuera de memoria. Ahí se pasa de ~$0.08/mes de disco a **+$10/mes por cada GB de RAM** que haya que agregar. Ese es el salto de costo real.
3. **Autovacuum y bloat.** Una tabla append-only con índices se degrada si no se particiona. `DELETE` masivo de datos viejos es caro; `DROP PARTITION` es instantáneo.
4. **Backups.** El tamaño del respaldo escala con la tabla más grande, que pasaría a ser la de eventos.

**Mitigaciones que hacen el nivel 2 seguro**, si se llega a él:
- Buffer en memoria en Fastify, `flush` cada ~5 s con un solo `INSERT` multi-fila. Nunca escritura síncrona en el request. Perder algunos eventos en un redeploy es aceptable para analítica.
- Particionado mensual por `created_at` + `DROP` de particiones a los 90 días.
- Rollup nocturno a `exercise_stats_daily`; los agregados son permanentes, los eventos crudos no.
- **No registrar `search_impression` en la primera iteración** — es el 90 % del volumen y el 10 % del valor.
- Cero servicios nuevos en Railway. Una cola (Redis, worker aparte) costaría más que todo el resto junto y no se justifica a esta escala.

---

## 5. Factores adicionales (más importantes que el costo)

### 5.1 Retroalimentación positiva: el rico se hace más rico
Si se ordena por popularidad, lo popular se muestra más, se usa más y se vuelve más popular. Un ejercicio nuevo y mejor nunca sale a flote. **Mitigación:** promedio bayesiano en lugar de conteo crudo, más una **cuota de exploración** (~15 % de los slots de "recomendado" reservados para ejercicios con exposición bajo umbral).

### 5.2 Normalizar por exposición, no por antigüedad
`times_used` crudo premia a los ejercicios viejos. Hay que usar tasas y una ventana móvil (p. ej. 180 días) en vez de conteos históricos. Una ventana móvil es mucho más barata de computar que un decaimiento exponencial por fila.

### 5.3 Contar usuarios únicos, no eventos
Un coach que mete "Back Squat" en 50 rutinas no son 50 votos, es **un** voto. Toda métrica de popularidad debe contar **coaches distintos** / **sesiones distintas**. Es a la vez la corrección estadística y la defensa anti-manipulación.

### 5.4 Separar ejercicio / video / metadata
El objetivo declarado incluye la calidad de los videos. Un video roto no debe hundir un ejercicio correcto: se arregla el video. Esto **exige** el motivo tipado del nivel 1 — el nivel 0 solo no puede distinguirlos.

### 5.5 El peso del coach ≠ el peso del atleta
Un coach agregando a una rutina es señal de **curación**. Un atleta completando series es señal de **ejecución**. Son cosas distintas y deben pesar distinto en la fórmula.

### 5.6 Fuga entre inquilinos
Hoy todos los ejercicios públicos son de una sola cuenta de sistema (`coach@atleta.com`), así que el riesgo es bajo. Pero en cuanto los coaches publiquen los suyos, **exponer conteos de uso revela actividad de otros equipos**. Regla: el score global se calcula y se muestra **solo para `is_public = true`**. Las estadísticas de ejercicios de equipo, si se hacen, se calculan dentro del equipo.

### 5.7 Manipulación
Riesgo bajo hoy, real después. Defensas: usuarios únicos (§5.3), mínimo de N usuarios distintos antes de mostrar score, e **ignorar la interacción del propio dueño del ejercicio** — `listPublic` ya tiene ese precedente (`ex.ownerUserId === userId`).

### 5.8 Privacidad
A partir del nivel 2 se está guardando comportamiento individual. Definir retención **antes** de escribir la primera fila, y no exponer nunca señal individual en la UI (nada de "3 personas vieron tu ejercicio hoy"). Solo agregados.

### 5.9 Arranque en frío
Los 638 ejercicios del catálogo arrancan sin señal. Durante ese periodo el orden debe caer a un criterio neutro (alfabético / completitud de metadata), **no** a un score de 0 que congele el catálogo entero.

---

## 6. Modelo de score propuesto

Promedio bayesiano sobre una tasa de éxito, calculado solo sobre ejercicios públicos y una ventana de 180 días:

```
éxitos  = veces programado en sesión, ejecutado con ≥1 set válido y no cancelado
intentos = veces programado en sesión
C = tasa media global del catálogo
m = 20   (umbral de confianza: cuántas observaciones se necesitan para "creerle" al ejercicio)

calidad = (intentos / (intentos + m)) * (éxitos / intentos)
        + (m         / (intentos + m)) * C
```

Sobre esa base, ajustes:

| Componente | Efecto |
|---|---|
| `unique_coaches` (rutinas distintas, coaches distintos) | Empuje logarítmico — popularidad con rendimientos decrecientes |
| `unique_saves` | Empuje menor |
| `cancel_rate` | Penalización proporcional |
| Reacciones negativas (nivel 1) | Penalización proporcional |
| Reportes de `video_roto` (nivel 1) | **No penaliza el score — saca el ejercicio de "recomendado" y lo manda a la cola de revisión.** Es un bug, no una opinión |

`is_platform_recommended` = `calidad ≥ umbral` **AND** `unique_coaches ≥ mínimo` **AND** `reportes_abiertos = 0`. Se recalcula en el mismo job, no a mano.

---

## 7. Recomendación

**Implementar nivel 0 + nivel 1 ahora. Diferir nivel 2. Condicionar nivel 3.**

Razón: el nivel 0 da el 70 % del valor con datos que ya existen y **cero** riesgo operativo, y el nivel 1 agrega lo único que el nivel 0 no puede producir — la separación entre ejercicio malo y video malo — por un costo indistinguible de cero. El nivel 2 multiplica el volumen de escritura sobre la base que corre las sesiones en vivo a cambio de refinamiento, no de capacidad nueva; conviene cuando haya suficientes usuarios para que el CTR sea estadísticamente significativo, y no antes. El nivel 3 no está limitado por infraestructura sino por moderación: abrirlo con pocos usuarios produce una sección vacía y una obligación permanente.

### Fases

**Fase 1 — Nivel 0 (base derivada)**
1. `packages/db/src/schema/exercise-stats.ts` → tabla `exercise_stats` (PK `exercise_id`, conteos, tasas, `score`, `last_computed_at`).
2. `apps/api/src/services/exercise-stats.ts` → `refreshExerciseStats()`: agregados sobre `session_exercise`, `set_record`, `athlete_session_exercise_cancelled`, `exercise_save`, y `routine.content` vía `jsonb_array_elements`.
3. Disparo por `setInterval` dentro del proceso de la API (cada 30–60 min). **No** un servicio cron aparte en Railway: costaría más que la funcionalidad completa.
4. Ordenar `listPublic` por `score` con respaldo alfabético; exponer `is_platform_recommended`.
5. UI: badge "recomendado" + contador de usos en la tarjeta de resultado (ya contemplado en `ejercicios-schema.md` §9).

**Fase 2 — Nivel 1 (señal explícita)**
6. `exercise_reaction` (`user_id`, `exercise_id`, `value`, `reason`, `created_at`) — PK compuesta, upsert idempotente.
7. tRPC: `react` / `unreact` / `reportIssue`.
8. Vista de admin: cola de reportes abiertos agrupada por motivo.
9. Integrar reacciones y reportes en el score (§6).

**Fase 3 — Nivel 2 (condicionada a escala)**
10. Solo si hay ≥N coaches activos. `exercise_event` particionada por mes, buffer en memoria con flush por lotes, sin `search_impression`, retención de 90 días, rollup nocturno.

**Fase 4 — Nivel 3 (condicionada a moderación)**
11. Solo con política de moderación definida y masa crítica suficiente para que no se vea abandonado.

---

## 8. Schema propuesto (fases 1–2)

```
exercise_stats                          -- una fila por ejercicio, recalculada por job
├── exercise_id            uuid PK FK → exercise (cascade)
├── unique_coaches         integer   -- coaches distintos que lo usaron en rutina
├── unique_routines        integer
├── session_uses           integer   -- session_exercise en la ventana
├── completed_uses         integer   -- con ≥1 set_record válido
├── cancelled_uses         integer   -- athlete_session_exercise_cancelled
├── saves                  integer
├── positive_reactions     integer   -- fase 2
├── negative_reactions     integer   -- fase 2
├── open_reports           integer   -- fase 2
├── score                  numeric(6,4)
├── window_days            integer   -- ventana usada (180)
└── last_computed_at       timestamptz

exercise_reaction                       -- fase 2; acotada: 1 fila por (usuario, ejercicio)
├── user_id                text FK → user (cascade)
├── exercise_id            uuid FK → exercise (cascade)
├── value                  enum(positive, negative)
├── reason                 enum(video_roto, video_no_corresponde,
│                               datos_incorrectos, duplicado, otro) nullable
├── resolved_at            timestamptz nullable   -- reporte atendido
└── created_at             timestamptz
PK compuesta: (user_id, exercise_id)
```

Ambas son aditivas: ninguna toca tablas existentes, así que la migración puede aplicarse **antes** del deploy sin romper nada (ver `deploy.md` § migraciones).

---

## 9. Decisiones pendientes

- [ ] **Nivel a implementar** — la recomendación es 0 + 1; confirmar o corregir.
- [ ] **Forma de la reacción** — binario + motivo (recomendado) vs. estrellas 1-5.
- [ ] **¿Los atletas reaccionan o solo los coaches?** Afecta volumen y el peso de §5.5.
- [ ] **Umbrales de `is_platform_recommended`** — valores concretos de `m`, mínimo de coaches únicos y umbral de calidad. Requiere mirar la distribución real una vez que corra la fase 1.
- [ ] **Ventana de 180 días** — validar contra la estacionalidad real del uso.
- [ ] **Visibilidad de las estadísticas** — ¿el conteo de usos es público, solo para el dueño, o solo interno?
- [ ] **Cola de reportes** — ¿quién la atiende? Hoy el catálogo público es de una sola cuenta de sistema.
- [ ] **Frecuencia del job** — 30 min vs 60 min vs bajo demanda con caché.
