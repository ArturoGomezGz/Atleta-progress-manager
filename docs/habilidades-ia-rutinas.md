# Habilidades de IA para rutinas (AI Routine Editor)

Registro único y revisable de las **habilidades** (skills) que el editor de rutinas con IA sabe ejecutar. El código vive en `apps/api/src/services/ai-routine-editor/` (registro en `skills.ts`); este documento es la fuente de verdad para gestionarlas y hay una prueba (`apps/api/test/services/ai-routine-editor/registry-doc.test.ts`) que falla si un id, el estado o el tipo de ejecución de una habilidad difieren entre el código y estas tablas.

> **Última revisión:** 2026-10-06.
> **Contexto:** el flujo de ajustes ("tweaks") está descrito en [ia-generacion-rutinas.md §11](ia-generacion-rutinas.md). Estado de la función en [funcionalidades.md](funcionalidades.md). Flag: `ai_routine_tweaks` ([feature-flags.md](feature-flags.md)).

## 1. Propósito y principios

El editor no es un chat: un **tweak** es una sola tarea concreta sobre la rutina abierta ("cambia X", "hazla más difícil"). Para que eso sea predecible, el modelo no tiene libertad total sobre doce herramientas; cada pedido se convierte en una **intención** y solo se ejecuta lo que esa intención permite.

1. **Una habilidad = una operación bien acotada.** Entrada validada (zod), salida compacta, sin efectos ocultos.
2. **Determinista donde se pueda.** Subir dificultad o ajustar descansos son reglas con límites, no una decisión del modelo. El LLM se reserva para lo que exige criterio (elegir una alternativa).
3. **Guardián de alcance.** Tras ejecutar, el código verifica que cada cambio caiga dentro de lo que la intención permite y descarta el resto antes de armar la propuesta (`scope-guard.ts`). No se confía en que el prompt se obedezca.
4. **Nada se guarda sin confirmación.** Las habilidades de alcance *borrador* solo cambian el contenido que el cliente envía; el entrenador acepta o rechaza.
5. **Independiente del proveedor.** Las definiciones no usan tipos de OpenAI; `adapters/openai.ts` las convierte en tools. Otro adaptador (MCP, REST) podría usar el mismo registro.
6. **Poco contexto, poco costo.** Cada intención expone solo sus herramientas con un prompt corto, y los resultados de las herramientas son un resumen del cambio, nunca la rutina completa.

Vocabulario de las tablas:

| Campo | Valores |
|---|---|
| Ejecución | **Determinista** (código, sin LLM) o **LLM** (la dirige el modelo con las atómicas de `composedOf`) |
| Alcance | **Lectura** (no toca nada), **Borrador** (cambia solo el contenido enviado por el cliente), **Guardado** (escribe en base de datos) |
| Riesgo | Bajo / Medio / Alto: daño posible si la habilidad se equivoca o se abusa |
| Estado | **Disponible** (para todos), **Limitada** (detrás de un flag), **Planeada** (solo diseñada; sin código ejecutable) |
| MCP | **Sí** (apta tal cual), **No** (requiere un LLM interno: un cliente MCP debe usar las atómicas), **Pendiente** (por decidir) |

## 2. Ciclo de un tweak

1. **Entrada** (`routines.tweakWithAI`): `teamId`, el estado actual de la rutina con sus ids, `message` y, opcionalmente, `clarification` (respuesta a una pregunta de este mismo tweak) o `intentHint` (acción rápida de la UI). No hay historial ni contexto: el servidor no guarda estado.
2. **Intención.** Con `intentHint` se salta el clasificador. Si no, una primera llamada barata al modelo (`router.ts`) devuelve la intención, los ítems objetivo, los términos a evitar (`avoid`) y, si falta un dato imprescindible, **una** pregunta de aclaración.
3. **Aclaración (máx. una).** Salida `{status: "needs_info", question, options?}`. El cliente responde y reenvía el mensaje original + `{question, answer}`; en esa segunda pasada el modelo ya no puede volver a preguntar.
4. **Ejecución.** Determinista (`adjust_difficulty`, `adjust_rest`) o dirigida por LLM con **solo** las herramientas de la intención. Los términos `avoid` ("no tengo paralelas", "sin barra") excluyen del catálogo, sin acentos ni mayúsculas, todo ejercicio cuyo nombre o equipamiento los contenga; solo valen para ese tweak.
5. **Guardián de alcance.** Descarta y registra (`warn`) los cambios fuera de la intención; el mensaje final describe solo lo que quedó aplicado.
6. **Salida** `{status: "done", message, proposedContent, changes}`. El entrenador acepta (se aplica al borrador) o rechaza. **El tweak termina ahí:** otro cambio es un tweak nuevo.

Intenciones y su alcance permitido:

| Intención | Ejecuta | Cambios permitidos |
|---|---|---|
| `replace_with_alternative` | LLM: `find_alternatives` (servidor, antes del modelo), `search_exercises`, `replace_exercise` | Reemplazo (o ajuste de series/campos; sin notas si no se pidieron) solo sobre los ítems objetivo. Sin candidatos: sin cambios y mensaje claro |
| `add_exercise` | LLM: `search_exercises`, `add_exercise` | Solo altas |
| `edit_basic` | LLM: `update_sets`, `update_item_fields`, `update_block`, `move_item`, `remove_item` | Solo sobre los ítems objetivo |
| `adjust_difficulty` | Determinista | `update_sets`/`update_item_fields`/`update_block` dentro de la palanca elegida; nunca altas, bajas ni reemplazos |
| `adjust_rest` | Determinista | Solo campos de descanso |

## 3. Cómo agregar, modificar o retirar una habilidad

**Agregar**
1. Define la habilidad con `defineSkill` en `skills-basic.ts` (atómicas) o `skills-compound.ts` (compuestas): id en `snake_case`, `inputSchema` (zod), `parameters` (JSON Schema para el modelo), `run` y metadatos (categoría, ejecución, alcance, riesgo, MCP, flag, fecha). Si estaba planeada, quítala de `skills-planned.ts`.
2. Si debe poder elegirse como intención: agrégala en `intents.ts` (herramientas expuestas, si exige objetivo) y su regla en `scope-guard.ts`, y descríbela en el prompt del enrutador (`prompts.ts`).
3. Escribe pruebas: la habilidad, su regla de alcance y un caso del flujo con LLM simulado.
4. Agrega o actualiza su fila aquí (mismos id, ejecución y estado que el código) y actualiza la fecha de revisión.
5. Si cambia lo que ve el usuario, actualiza [funcionalidades.md](funcionalidades.md).

**Modificar:** cambia código y fila a la vez (entradas, salidas, riesgo, notas), sube la fecha de revisión y revisa la regla de `scope-guard.ts`: una habilidad que puede hacer más no debe quedar cubierta por una regla vieja.

**Retirar:** quítala del registro y de las intenciones, bórrala de las tablas (o déjala como Planeada si se reanudará) y anótalo en el registro de decisiones (§6).

**Pasar de planeada a disponible:** mueve la definición al archivo correspondiente, cambia `status` a `limited` (o `available` al quitar el flag) y actualiza la tabla en el mismo commit.


## 4. Catálogo de habilidades

### Consulta

| Id | Nombre | Descripción | Ejecución | Alcance | Entradas | Salidas | Riesgo | Estado | Flag | MCP | Revisión | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `routine_summary` | Resumen de la rutina | Describe la rutina: duración estimada, zonas, patrones y carga total. | Determinista | Lectura | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `review_against_constraints` | Revisar contra lesiones o equipo | Señala ejercicios que choquen con limitaciones o equipamiento dados, sin editar. | LLM | Lectura | — | — | Bajo | Planeada | — | No | 2026-10-06 | Necesita las restricciones persistentes, fuera de alcance por ahora. |
| `answer_question` | Responder preguntas sobre la rutina | Contesta "¿por qué este ejercicio?" sin cambiar nada. | LLM | Lectura | — | — | Bajo | Planeada | — | No | 2026-10-06 | El tweak es una sola tarea; hoy un pedido que solo pregunta se responde como "fuera de alcance". |

### Catálogo

| Id | Nombre | Descripción | Ejecución | Alcance | Entradas | Salidas | Riesgo | Estado | Flag | MCP | Revisión | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `search_exercises` | Buscar ejercicios | Busca ejercicios en el catálogo disponible para el equipo (la mayoría de los nombres están en inglés: prefiere filtrar por movementPattern o bodyZone, y si usas query que sea una o dos palabras en inglés). Devuelve hasta 12 resultados; excluye lo que el mensaje pidió evitar. | Determinista | Lectura | `query?`, `movementPattern?`, `bodyZone?`, `difficulty?`, `warmupOnly?` | ≤ 12 ejercicios `{id, name, patterns, equipment, contraindications}` sin los excluidos por `avoid` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | Aplica `avoid` (nombre o equipamiento, sin acentos ni mayúsculas) antes de registrar ids válidos. |
| `find_alternatives` | Buscar alternativas | Devuelve hasta 8 ejercicios equivalentes a uno de la rutina (mismo patrón de movimiento y músculo primario, dificultad no mayor, equipo permitido), ordenados del mejor al peor, sin reemplazar nada. | Determinista | Lectura | `itemId` | ≤ 8 candidatos `{id, name, pattern, muscles, equipment, difficulty}` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | Consulta el catálogo por metadatos, no por nombre (el catálogo está en inglés). Excluye lo ya presente en la rutina y lo evitado (`avoid`, con equivalentes español→inglés y «sin equipo»); un hold isométrico o un salto solo sustituye a uno de su misma naturaleza; prioriza la misma familia de ejercicio (remo con remo); con «más fácil» exige menor dificultad; descarta ejercicios que cargan una molestia dicha en el mensaje (rodilla, lumbar, hombro, muñeca, codo, tobillo); registra los ids devueltos como válidos. Lo ejecuta el servidor antes del modelo en `replace_with_alternative`. |

### Retiradas

| Habilidad | Retirada | Motivo |
|---|---|---|
| `propose_new_exercise` | 2026-10-06 | Ninguna IA escribe en el catálogo de ejercicios. Los ejercicios creados quedaban vacíos (sin músculos, equipo ni dificultad), eludían `avoid` (H-02), no se podían validar y ensuciaban el catálogo del equipo aunque se rechazara la propuesta. Si no hay alternativa, el tweak lo dice y no cambia nada; el generador (`routines.generateWithAI`) usa solo ejercicios del catálogo. |

### Edición básica

| Id | Nombre | Descripción | Ejecución | Alcance | Entradas | Salidas | Riesgo | Estado | Flag | MCP | Revisión | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `replace_exercise` | Reemplazar ejercicio | Cambia el ejercicio de un ítem por otro (id obtenido con search_exercises). Conserva series, descanso, tempo y objetivo salvo que envíes sets. | Determinista | Borrador | `itemId`, `newExerciseId`, `keepSets?`, `sets?`, `notes?` | Resumen del cambio; `RoutineChange` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | El ítem conserva su id; conserva sus notas (el guardián descarta `notes` que el entrenador no pidió). Exige un exerciseId devuelto por el catálogo en el mismo tweak. |
| `add_exercise` | Agregar ejercicio | Agrega un ejercicio (id obtenido con search_exercises) al nivel superior o dentro de un bloque. | Determinista | Borrador | `exerciseId`, `sets`, `blockId?`, `position?`, `goal?`, `restSeconds?`, `tempo?`, `notes?` | Resumen del cambio; `RoutineChange` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | Máximo 20 ítems por rutina y 10 ejercicios por bloque. Rechaza un ejercicio que ya está en la rutina salvo que el mensaje pida repetirlo. |
| `remove_item` | Quitar ejercicio o bloque | Elimina un ejercicio o un bloque completo. No se puede vaciar un bloque quitando su único ejercicio: elimina el bloque. | Determinista | Borrador | `itemId` | Resumen del cambio; `RoutineChange` | Medio | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 |  |
| `move_item` | Mover ejercicio o bloque | Mueve un ejercicio o bloque a otra posición (0 = primero), opcionalmente a otro bloque. Los bloques solo van en el nivel superior. | Determinista | Borrador | `itemId`, `toPosition`, `toBlockId?` | Resumen del cambio; `RoutineChange` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 |  |
| `update_sets` | Cambiar series | Reemplaza TODAS las series de un ejercicio (repeticiones, tiempo, carga). | Determinista | Borrador | `itemId`, `sets` | Resumen del cambio; `RoutineChange` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | `fixed_kg` solo si el mensaje trae pesos; `percent_rm` solo con RM registrados (hoy siempre bloqueado: no hay `context`). |
| `update_item_fields` | Cambiar campos del ejercicio | Cambia tempo, descanso, objetivo o notas de un ejercicio. null borra el campo; omitirlo lo deja igual. | Determinista | Borrador | `itemId`, `tempo?`, `restSeconds?`, `goal?`, `notes?` | Resumen del cambio; `RoutineChange` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 |  |
| `update_block` | Cambiar bloque | Cambia rondas, nombre o descanso entre rondas de un bloque. null borra el campo; omitirlo lo deja igual. | Determinista | Borrador | `itemId`, `rounds?`, `name?`, `restBetweenRoundsSeconds?` | Resumen del cambio; `RoutineChange` | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 |  |
| `duplicate_item` | Duplicar ejercicio o bloque | Copia un ítem con ids nuevos justo debajo. | Determinista | Borrador | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `group_into_block` | Agrupar en bloque | Junta ejercicios sueltos en un circuito o superserie. | Determinista | Borrador | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `split_block` | Separar bloque | Saca los ejercicios de un bloque al nivel superior. | Determinista | Borrador | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |

### Intenciones compuestas

| Id | Nombre | Descripción | Ejecución | Alcance | Entradas | Salidas | Riesgo | Estado | Flag | MCP | Revisión | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `adjust_difficulty` | Subir o bajar la dificultad | Hace la rutina (o los ítems indicados) un poco más difícil o más fácil moviendo UNA sola palanca en pasos pequeños: intensidad (RPE ±1, % RM ±5), volumen (±1 serie o ronda) o descanso (±15 s). | Determinista | Borrador | `direction` (up/down), `knob?`, `targetItemIds?` | Cambios por ítem y mensaje ("Subí la intensidad en 3 ítems.") | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | Sin palanca explícita elige la primera con margen: intensidad, volumen, descanso. Nunca agrega, quita ni reemplaza ejercicios ni inventa pesos (`fixed_kg` no se toca). Límites: RPE 5–9 (máx. 2 ejercicios en RPE ≥ 9), % RM 40–95, series 2–6, rondas 2–8, descanso 15–600 s. |
| `adjust_rest` | Ajustar descansos | Sube o baja en 15 s los descansos existentes, o los fija en un valor exacto (p. ej. "baja el descanso del press a 90 s"), en toda la rutina o en los ítems indicados. | Determinista | Borrador | `direction?` o `seconds?`, `targetItemIds?` | Cambios por ítem y mensaje | Bajo | Limitada | `ai_routine_tweaks` | Sí | 2026-10-06 | Con `seconds` fija el descanso de los ejercicios indicados (y de bloques ya con descanso entre rondas); con dirección solo mueve descansos que ya existen. Rango 15–600 s. |
| `replace_with_alternative` | Reemplazar por una alternativa | Sustituye un ejercicio por otro del mismo patrón de movimiento y rol ("sustitúyelo por algo más", "no tengo paralelas"): recibe candidatos de `find_alternatives` (el modelo elige uno; si no elige se aplica el mejor) respetando las exclusiones del mensaje y reemplaza conservando series, descanso y tempo. | LLM | Borrador | `itemId`, `avoid?` | Un reemplazo (y opcionalmente series/campos) sobre el ítem | Medio | Limitada | `ai_routine_tweaks` | No | 2026-10-06 | Elegir la alternativa requiere criterio, así que la dirige un LLM del agente del editor (no va dentro de un MCP: un cliente MCP usa las atómicas). Solo puede producir un reemplazo (o ajuste de series/campos) sobre los ítems objetivo. |
| `fit_to_duration` | Ajustar a una duración | Recorta o amplía descansos y series para acercarse a N minutos. | Determinista | Borrador | — | — | Bajo | Planeada | — | Pendiente | 2026-10-06 | El estimador de duración vive hoy solo en la web (`lib/ai-routine-diff.ts`, ≈40 s por serie). Falta moverlo a un módulo compartido antes de usarlo en la API. |
| `scale_volume` | Escalar volumen | Multiplica series o rondas por un factor acotado. | Determinista | Borrador | — | — | Bajo | Planeada | — | Pendiente | 2026-10-06 | Hoy cubierto en parte por `adjust_difficulty` con palanca de volumen (±1). |
| `apply_equipment_constraint` | Aplicar restricción de equipo | Reemplaza todo ejercicio que use un equipo no disponible. | LLM | Borrador | — | — | Medio | Planeada | — | No | 2026-10-06 | Hoy se logra por el reemplazo individual con exclusiones (`avoid`). |
| `apply_limitation` | Aplicar limitación o lesión | Sustituye ejercicios con contraindicaciones para una lesión dada. | LLM | Borrador | — | — | Alto | Planeada | — | No | 2026-10-06 | Requiere decidir cómo se declaran y persisten las limitaciones; no es consejo médico. |
| `convert_rpe_to_percent_rm` | Convertir RPE a % RM | Cambia cargas RPE a % RM cuando hay RM registrados. | Determinista | Borrador | — | — | Bajo | Planeada | — | Sí | 2026-10-06 | Depende de RM por atleta ([rm-atleta.md](rm-atleta.md)). |
| `create_variant` | Crear variante | Misma estructura y volumen con variantes de los ejercicios principales. | LLM | Borrador | — | — | Medio | Planeada | — | No | 2026-10-06 |  |

### Cuenta

| Id | Nombre | Descripción | Ejecución | Alcance | Entradas | Salidas | Riesgo | Estado | Flag | MCP | Revisión | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `create_routine` | Crear rutina | Crea una rutina vacía en un equipo. | Determinista | Guardado | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `duplicate_routine` | Duplicar rutina | Copia una rutina con ids nuevos. | Determinista | Guardado | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `rename_routine` | Renombrar rutina | Cambia el nombre de una rutina. | Determinista | Guardado | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `list_routines` | Listar rutinas | Lista las rutinas de un equipo. | Determinista | Lectura | — | — | Bajo | Planeada | — | Sí | 2026-10-06 |  |
| `generate_routine` | Generar rutina desde cero | Genera una rutina completa con IA a partir de objetivo y duración. | LLM | Guardado | — | — | Medio | Planeada | — | No | 2026-10-06 | Ya existe como generador (`routines.generateWithAI`, flag `ai_generator`), pero fuera del registro. |
| `list_athletes` | Listar atletas | Lista los atletas de un equipo. | Determinista | Lectura | — | — | Bajo | Planeada | — | Sí | 2026-10-06 | Datos personales: exige permisos por equipo. |
| `read_athlete_progress` | Leer progreso de un atleta | Lee RM, marcas y avance de un atleta. | Determinista | Lectura | — | — | Medio | Planeada | — | Sí | 2026-10-06 | Depende del flag `progress`. |

## 5. Hacia un MCP

El agente del editor es **un cliente más** del registro; no el dueño. Para exponerlo por MCP (u otro adaptador) conviene respetar:

- **No anidar un bucle LLM dentro de una herramienta MCP.** El cliente (que ya es un modelo) compone las atómicas; por eso las habilidades `LLM` (p. ej. `replace_with_alternative`) figuran con MCP "No": su equivalente MCP es buscar + reemplazar. Las deterministas (`adjust_difficulty`, `adjust_rest`) sí sirven tal cual.
- **Autenticación por usuario**, nunca una clave global: cada llamada actúa como un coach concreto con `assertCoach(teamId)`, igual que `routines.tweakWithAI`.
- **Permisos por habilidad con los feature flags** existentes (campo `flag`): una habilidad solo se lista si el usuario tiene el flag; la API debe seguir rechazando con `FORBIDDEN` aunque el cliente la conozca.
- **Alcance explícito.** Las de lectura y borrador no necesitan confirmación; las de **guardado** (cuenta) requieren confirmación del usuario en el cliente o un modo de solo propuesta.
- **Concurrencia optimista** para rutinas persistidas: hoy el borrador viaja entero y lo guarda `routines.updateContent`; un MCP que escriba debe enviar la versión (`updatedAt`) que leyó y fallar si cambió.
- **Salidas compactas y estables**, con ids; nunca volcar la rutina completa en cada respuesta.
- Un adaptador MCP debe implementar el `SkillRuntime` de `types.ts` (borrador, catálogo, `apply`) con su propia persistencia; las habilidades no cambian.

## 6. Preguntas abiertas y registro de decisiones

**Decisiones**

| Fecha | Decisión |
|---|---|
| 2026-10-06 | Un tweak es una tarea sin conversación; el servidor es sin estado (se eliminó `history`). A lo sumo una aclaración. |
| 2026-10-06 | Enrutador + herramientas por intención + guardián de alcance, para evitar que el modelo "aproveche" y repita cambios (bug de producción: reemplazo + `update_sets` x5 sobre otros ítems). |
| 2026-10-06 | Se retira `propose_new_exercise` (también del generador): la IA nunca crea ejercicios. `find_alternatives` entrega candidatos por patrón/músculo/dificultad/equipo; sin candidatos el tweak responde que no encontró nada. |
| 2026-10-06 | Un pedido compuesto avisa lo que no se hizo (`leftover` del enrutador). Tras una aclaración vaga ("el que quieras") no se elige un ejercicio al azar: se responde que no se pudo resolver (CLR-004). |
| 2026-10-06 | Las exclusiones del mensaje ("no tengo paralelas") se aplican como `avoid` en el catálogo; no son memoria. |
| 2026-10-06 | Fuera de alcance por ahora: restricciones globales o persistentes (lesiones, equipo), memoria de conversación y `context`. Sin `percent_rm` (no hay RM en el tweak) y `fixed_kg` solo si el mensaje trae pesos. |
| 2026-10-06 | Los resultados de las herramientas son compactos (resumen del cambio) para bajar los ~26 k tokens de entrada por petición. |

**Preguntas abiertas**

- ¿Dónde viven las restricciones persistentes (lesiones, equipo disponible) cuando se quieran? Condiciona `apply_equipment_constraint` y `apply_limitation`.
- `fit_to_duration`: ¿mover el estimador de duración de la web (`lib/ai-routine-diff.ts`) a un módulo compartido con la API, y con qué precisión (hoy ≈ 40 s por serie)?
- ¿`adjust_difficulty` debe diferenciar rutinas de evaluación o ejercicios de calentamiento/recuperación? Hoy los trata igual.
- ¿El enrutador debe usar un modelo distinto al de ejecución? Hoy es el mismo (`gpt-4o-mini`).
- Pedidos compuestos ("hazla más difícil y cambia el press"): hoy se elige una intención y el resto se pide en otro tweak.
- Medir en testing con el modelo real: tasa de aclaraciones, cambios descartados por el guardián y tokens por petición.
