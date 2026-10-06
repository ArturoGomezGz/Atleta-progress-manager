# Hallazgos previos (lectura del código, sin ejecutar)

Ambigüedades y sospechas de bug encontradas al diseñar `casos.md` sobre `master` a323f2d. Son **hipótesis a confirmar** con las pruebas; ninguna se verificó contra un entorno. Rutas relativas a `apps/`.

| Id | Sospecha | Dónde | Por qué | Casos |
|---|---|---|---|---|
| H-01 | El guardián no frena un cambio de repeticiones del **propio** ítem objetivo durante un reemplazo | `api/src/services/ai-routine-editor/scope-guard.ts:43-44`; prueba que lo permite: `api/test/services/ai-routine-editor/scope-guard.test.ts` ("permite ajustar series del ítem objetivo") | `replace_with_alternative` admite `update_sets` y `update_item_fields` sobre el objetivo. Si el modelo repite el comportamiento del bug ("también cambió repeticiones"), solo el prompt lo evita. | GRD-003, REP-002 |
| H-02 | Evasión de `avoid` mediante `propose_new_exercise` | `api/src/services/ai-routines.ts:253,278` (`ctx.knownIds.add`) frente a `api/src/services/ai-routine-editor/skills-basic.ts:95` | `proposeNewExercise` registra el id como válido antes de que la habilidad compruebe `matchesAvoid`; `ctx.knownIds` es el mismo `Set` que `knownExerciseIds`. Un ejercicio existente excluido, o uno nuevo con el término en el nombre, puede quedar como destino. Además el ejercicio nuevo se crea (persiste) igualmente. | AVD-020, AVD-021 |
| H-03 | Candidatos de búsqueda sin orden y limitados antes de filtrar | `ai-routines.ts:201-219` (`.limit(80)` sin `orderBy`; `avoid`, zona y equipo se aplican después; `slice(0,12)`) | Las alternativas dependen del orden arbitrario de 80 filas; con catálogos grandes pueden faltar las buenas o quedar vacío tras `avoid`. Posible causa de "propuestas poco buenas". | ROB-028, REP |
| H-04 | El modelo de ejecución no recibe patrón, zona ni dificultad del ejercicio original | `ai-routine-editor/routine-view.ts` (`exerciseView`), `agent.ts` (`buildExecutionPrompt`), `router.ts` (índice solo id y nombre) | El prompt pide "mismo patrón y rol" pero solo ve el nombre: lo infiere por texto. Afecta calidad y la acción "Evitar impacto en rodilla". | REP-004, REP-007 |
| H-05 | Con `intentHint` se ignora el `avoid` del mensaje | `router.ts:83-94` (`avoid: []`) | La pista salta el enrutador: "no tengo paralelas" no filtra el catálogo. El picker de la UI tampoco permite expresarlo. | INP, AVD-022 |
| H-06 | La palanca de descanso de `adjust_difficulty` puede invertir el sentido | `ai-routine-editor/difficulty.ts:28-30,129,160-163` | Con `min=30` al endurecer, `Math.max(30, v-15)` **sube** descansos <30 (15, 20 → 30); al facilitar con `max=180`, `Math.min(180, v+15)` **baja** descansos >180 (590, 600 → 180). | DET (palanca descanso) |
| H-07 | Topes de entrada distintos a los de edición: omisiones silenciosas | `routine-content-schema.ts:21` (descanso sin máximo), `ai-routine-edits.ts:52,80` (máx. 600), `:36` (reps ≤200, 12 series), `MAX_BLOCK_ROUNDS=20`; `skills-compound.ts:16-25` (`applyAll` ignora `RoutineEditError`) | Un descanso de 601–700 sube "hacia" 600 (baja); series 13/14, reps >200 o rondas >20 hacen que la edición falle y se omita sin aviso (mensaje "No encontré margen"). | INP, DET |
| H-08 | Un `targetItemIds` totalmente inválido se convierte en "toda la rutina" | `router.ts:63-66`, `difficulty.ts:35-40` | Se filtran los ids inexistentes y un conjunto vacío significa alcance global en `adjust_*`. | INP |
| H-09 | Valores del enrutador fuera de esquema dan error 500 en lugar de degradar | `router.ts:23-33,125-126`, `tweak.ts:65-68` | `seconds` fuera de 15–600 (p. ej. "descanso de 10 s"), un `avoid` de >60 caracteres, pregunta/respuesta largas hacen fallar todo el enrutador con "La IA no logró procesar…". | INT, AVD, ROB |
| H-10 | Los objetivos se truncan a 10 en silencio | `router.ts:20,65` | "Cambia todos" en rutinas de >10 ejercicios cambia solo 10 sin avisar. | REP |
| H-11 | `adjust_rest` con segundos fija descansos donde no existían, y en bloques sin descanso entre rondas | `difficulty.ts:136-138,146-150` (`opts.absolute ?? …`) frente a `docs/habilidades-ia-rutinas.md` ("bloques ya con descanso") | Con `absolute`, `next` nunca es null: se agrega descanso a todos los ejercicios del alcance (también internos de circuitos) y a bloques que no tenían. | DET |
| H-12 | La palanca de volumen ignora ejercicios dentro de bloques | `difficulty.ts:106-121` | Solo recorre el nivel superior; un objetivo interno no produce cambio ("No encontré margen"). | DET |
| H-13 | Límites distintos: entrada 30 ítems vs altas máx. 20; bloque 10 ejercicios; 12 series | `ai-routine-editor/input.ts:11`, `ai-routine-edits.ts:12-15` | Rutinas de 21–30 ítems son válidas pero `add_exercise` falla; sin mensaje claro para el usuario. | INP, INT |
| H-14 | `keepSets` hereda cargas del ejercicio anterior y se pierden las notas | `ai-routine-edits.ts:250-262` | `fixed_kg` y `percent_rm` del ejercicio viejo pasan al nuevo; las notas (p. ej. "cuidar rodilla") se borran sin aviso en el diff. Series de tiempo se conservan aunque el nuevo sea de repeticiones. | REP |
| H-15 | Con 0 cambios, el mensaje es el del modelo | `tweak.ts:33-46` | La doc dice que el mensaje describe solo lo aplicado; con `changes=[]` y sin descartes se muestra `agentMessage`, que puede afirmar un cambio inexistente. | GRD |
| H-16 | `add_exercise` no limita el número de altas | `scope-guard.ts:46-47`, `agent.ts:79-106` | Varias llamadas paralelas en un turno aplican todas; el guardián solo exige el tipo. | GRD-007 |
| H-17 | `edit_basic` permite cualquier operación sobre el objetivo, incluso vaciar la rutina | `scope-guard.ts:49-50`, `routine-content-schema.ts` (items sin mínimo) | "Borra todo" puede proponer 0 ítems; "cambia reps" podría quitar o mover el ítem y el guardián lo admite. | INT, GRD |
| H-18 | Pesos en libras sin conversión y sin plausibilidad | `tweak.ts:28-30`, `ai-routine-edits.ts:36` (máx. 1000) | La regex acepta `lb`/`libras` pero `fixed_kg` guarda el número tal cual; 999 kg se acepta. | ROB |
| H-19 | Mensajes de error de la UI engañosos | `web/src/components/ai-routine-editor.tsx:71-77` | `BAD_REQUEST` siempre dice "circuitos vacíos" (también con >30 ítems o tamaño excedido); `UNAUTHORIZED` es genérico; el texto de tasa no muestra segundos. | UIX |
| H-20 | Efectos al cerrar o cancelar | `ai-routine-editor.tsx:105`, `:156-158` | La vista previa (bordes punteados) depende de la propuesta, no de `open`; cancelar no aborta la petición (cupo y ejercicios creados no se revierten). | UIX |
| H-21 | Cupo: en memoria, por proceso, descuenta fallos y la 2.ª vuelta | `api/src/routers/routines.ts:19-21,191-195` | Un reinicio lo borra; una aclaración cuesta 2; los 500 del modelo también cuentan. | INP |
| H-22 | Ids/nombres duplicados sin validar | `routine-content-schema.ts`, `router.ts:73-76` | No hay unicidad de ids; opciones de aclaración con nombres repetidos no identifican el ítem. | INP, CLR |
| H-23 | Campos legado `mode`/`circuitRounds` se pierden | `ai-routine-edits.ts:452-453` y esquema de entrada | Zod los elimina antes; el contenido propuesto ya no los trae. | INP |
| H-24 | Nombres de ejercicios sin filtro de visibilidad | `deps-real.ts:30-35` | `getExerciseNames` resuelve cualquier id: un coach podría ver nombres de ejercicios privados de otro equipo si conoce el uuid. Riesgo bajo. | ROB |
| H-25 | `avoid` por subcadena: sobre-exclusión y huecos | `ai-routine-editor/avoid.ts` | `<3` letras se descartan ("kb"); "barra" excluye "Barras paralelas"/"Barra de dominadas"; "peso" excluye "Peso corporal"/"Peso muerto"; "press" se recorta a "pres"; "saltos" no excluye burpees; tope 8 vs prompt 5. | AVD |
| H-26 | `ilike` sin escapar y sensible a acentos | `ai-routines.ts:208,250` | `%`/`_` del modelo actúan como comodines; "flexion" no encuentra "Flexión". | ROB |
| H-27 | No hay validación de reemplazos repetidos | `ai-routine-edits.ts` | Solo se evita que sea igual al original; el prompt pide no repetir ejercicios de la rutina. | REP |
| H-28 | 6 turnos insuficientes para multi-objetivo | `agent.ts:18,39-44` | `isComplete` exige tocar todos los objetivos; con >3–4 el agente se queda corto y devuelve resultados parciales. | REP, ROB |
| H-29 | La acción "Evitar impacto en rodilla" no tiene objetivos deducibles | `ai-routine-editor.tsx` (QUICK), `router.ts:73-76` | Sin pista, el enrutador solo ve nombres; si no hay objetivos se pregunta "¿A qué ejercicio…?" (resultado pobre para un chip genérico). | UIX |
| H-31 | Doble envío posible | `ai-routine-editor.tsx:131` | El guard `phase.name === "loading"` usa el estado del cierre; dos eventos en el mismo tick podrían enviar 2 peticiones (el servidor procesa ambas). | UIX |
| H-35 | El diff no muestra cambios de tempo/notas/objetivo | `web/src/lib/ai-routine-diff.ts` (`describe`) | La fila queda con "−" y "+" idénticos; solo el `summary` explica. | UIX |

## Preguntas abiertas (no resolubles desde el código)

1. ¿El mensaje del usuario debe usarse para `avoid` también cuando hay `intentHint`? (H-05)
2. ¿`avoid` debe leerse también de `clarification.answer`? El prompt dice "EN ESTE MENSAJE".
3. ¿Debe un reemplazo conservar `fixed_kg`/`percent_rm` del ejercicio anterior? (H-14)
4. ¿`adjust_rest` con segundos debe crear descansos donde no había? (H-11)
5. ¿Deben las rutinas con 21–30 ítems poder recibir altas? (H-13)
6. ¿Debe un pedido compuesto avisar de lo que no se hizo? Hoy no hay aviso.
7. ¿Qué umbral de tokens/latencia es aceptable? Los de `casos.md` son supuestos del diseñador.
8. ¿Cómo se fuerza una falla del modelo en testing (mock/flag)? Sin eso, los casos ROB de fallas inyectadas quedan bloqueados.

## Correcciones (rama `claude/ai-routine-editor-fixes`)

Verificadas solo con pruebas unitarias y de flujo con LLM simulado; falta re-probar con el modelo real en testing.

| Hallazgo / caso | Corrección | Commit |
|---|---|---|
| UIX-011, UIX-015 | El diff compara con igualdad profunda insensible al orden de claves (`sameValue`) | f721bc2 |
| H-06, DET-029, DET-030 | Los descansos nunca se mueven en sentido contrario al pedido; el mensaje cuenta solo lo que cambió | 8fc3b11 |
| H-05, AVD-022, INP-124 | Con `intentHint` el `avoid` se extrae del mensaje (`extractAvoidFromMessage`) | c73739e |
| H-02, AVD-020 | Resuelto de raíz al retirar `propose_new_exercise` (la IA ya no crea ejercicios); además el id solo se registra tras pasar `avoid` | c73739e, ebd24d7 |
| H-03, H-04, REP-001..004, REP-010 | `find_alternatives`: candidatos por patrón, músculo primario, dificultad y equipo, ordenados; el modelo ve patrón/músculos/dificultad del original; fallback al mejor candidato; sin candidatos, mensaje claro y sin cambios | ebd24d7 |
| H-14, REP-010, INT-021 | El reemplazo conserva las notas del original; el guardián descarta notas no pedidas | ebd24d7 |
| H-27, GRD-008 | `add_exercise` rechaza ejercicios ya presentes salvo que se pida repetir | ebd24d7 |
| Pregunta abierta 6, INT-038, INT-039, GRD-015 | El enrutador devuelve `leftover` y el mensaje final dice "No hice: …. Pídelo en otro ajuste." | ebd24d7 |
| CLR-004 | Decisión: tras una aclaración vaga ("no sé, el que quieras") se responde que no se pudo resolver el ejercicio (UNRESOLVED_REPLY), sin reemplazo arbitrario y sin segunda pregunta (el caso prohíbe `needs_info`) | ebd24d7 |
| H-19, INP-013/014/018/033… | `BAD_REQUEST` del tweak con mensajes cortos en español; el detalle de zod va al log | 372d88b |
