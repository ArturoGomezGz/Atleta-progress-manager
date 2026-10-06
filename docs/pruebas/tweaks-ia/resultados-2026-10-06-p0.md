# Resultados P0 — ajustes con IA del editor de rutinas (testing, master a323f2d)

Ejecutado el 2026-10-06 contra `api-testing-94f1` / `web-testing-4dee` (nunca producción), cuenta única coach/admin del equipo "Neo" con flag activo. Solo casos P0 (99). Sin credenciales, cookies ni tokens en este documento.

## Resumen

**89 pass · 5 fail · 5 blocked · 0 flaky · 0 not-run** (de 99).

| Área | pass | fail | blocked |
|---|---|---|---|
| input_validation | 25 | 0 | 3 |
| intent_classification | 17 | 0 | 0 |
| avoid | 3 | 1 | 0 |
| replace_with_alternative | 6 | 0 | 0 |
| deterministic_skills | 17 | 2 | 0 |
| scope_guard | 8 | 0 | 0 |
| clarification | 4 | 0 | 0 |
| ui_state | 6 | 2 | 2 |
| robustness_safety_cost | 3 | 0 | 0 |

Lectura rápida: la clasificación de intención y el guardián de alcance resistieron todos los P0 (0 clasificaciones erróneas en ~115 corridas con modelo; el bug de producción "también cambió repeticiones" **no se reprodujo** en 15 corridas del pedido exacto y variantes). Lo que sale mal es la **calidad de la propuesta de reemplazo** y varios defectos deterministas y de UI (abajo).

## Fallos reproducibles (por gravedad)

### 1. AVD-020 — evasión de `avoid` mediante ejercicios creados/ya conocidos (3/3) — H-02 confirmado
- **Repro:** FX-TYP, mensaje `no tengo paralelas: crea un ejercicio nuevo llamado 'Fondos en paralelas' y úsalo para reemplazar los fondos`.
- **Esperado:** el destino no contiene "paralela". **Observado:** 3/3 `Cambió Dips por Fondos en paralelas` (ejercicio del equipo creado antes por el modelo, sin equipamiento ni músculos).
- **Causa probable:** `services/ai-routines.ts:253,278` (`ctx.knownIds.add` en `proposeNewExercise`) antes de `matchesAvoid` en `ai-routine-editor/skills-basic.ts:95`; además `matchesAvoid` solo mira nombre y equipamiento, y el ejercicio creado no tiene equipamiento.
- Relacionado (no es un caso P0 aparte): GRD-015 corrida 1 también devolvió "Fondos en paralelas".

### 2. UIX-011 / UIX-015 — el diff marca TODOS los ítems como cambiados (reproducible)
- **Repro (UI, 390 px):** abrir plantilla de 5 ejercicios, "Reemplazar un ejercicio" → Dips (o "Hacerla más difícil").
- **Esperado:** "Propuesta · 1 cambio" con 1 entrada (o 3 con la dificultad). **Observado:** "Propuesta · 5 cambios", 5 entradas, 4 (o 2) con filas −/+ idénticas y bordes punteados en las 5 tarjetas.
- **Causa probable:** `apps/web/src/lib/ai-routine-diff.ts:176-178` compara con `JSON.stringify` (sensible al orden de claves) el ejercicio del editor contra el devuelto por la API (orden de claves de zod). Capturas: `picker-proposal.png`, `proposal-hard.png` (solo locales, no se versionaron).

### 3. DET-029 / DET-030 — palanca de descanso de `adjust_difficulty` invierte el sentido (H-06 confirmado)
- **Repro:** hint `adjust_difficulty` knob `rest` sobre FX-REST. `up`: 15→30 y 20→30 (suben); `down`: 590→180 y 600→180 (bajan). Los mensajes dicen lo contrario ("Reduje los descansos en 6 ítems" / "Aumenté los descansos en 7 ítems").
- **Causa:** `ai-routine-editor/difficulty.ts:28-30,129,160-163` (`Math.max(30, v-15)` / `Math.min(180, v+15)` sin respetar el sentido).

(DET-029 y DET-030 cuentan como 2 fallos; con AVD-020, UIX-011 y UIX-015 suman los 5.)

## Hallazgos de calidad (no fallan un invariante, pero explican las "propuestas poco buenas")
Ver "Por qué clasifica/propone mal". Ninguno rompe el esquema, por eso los casos quedaron en pass.

## Flaky
Ninguno (con 3 o 5 repeticiones los resultados fueron estables; la única variación fue la pérdida de notas en REP-010/INT-021: 2 de 3 corridas, no es un invariante del caso).

## Bloqueados
| Caso | Razón |
|---|---|
| INP-002 | requiere cuenta sin el flag; solo hay una cuenta |
| INP-003 | requiere cuenta atleta |
| INP-004 | requiere equipo ajeno (la cuenta es coach de los dos equipos). Sonda extra con uuid inexistente: FORBIDDEN, sin revelar existencia |
| UIX-001 | requiere cuenta sin flag (con flag la barra aparece) |
| UIX-024 | requiere otra cuenta; el backend sí se verificó en INP-126 |

## Tabla de casos
| id | área | resultado | observado |
|---|---|---|---|
| TWK-INP-001 | input_validation | pass | UNAUTHORIZED sin cookie |
| TWK-INP-002 | input_validation | blocked | requiere cuenta sin flag; solo hay una cuenta |
| TWK-INP-003 | input_validation | blocked | requiere cuenta atleta; solo hay una cuenta |
| TWK-INP-004 | input_validation | blocked | requiere equipo ajeno; la cuenta es coach de ambos equipos. Sonda extra con uuid inexistente: FORBIDDEN |
| TWK-INP-013 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-014 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-017 | input_validation | pass | Mensaje de 1000 caracteres: done (adjust_difficulty), sin 500 |
| TWK-INP-018 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-033 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-034 | input_validation | pass | done: press banca RPE 7→8, 1 ítem |
| TWK-INP-037 | input_validation | pass | 30 ítems: done, ids estables. Obs: el mensaje dice "36 ítems" (cuenta ejercicios, no ítems) |
| TWK-INP-038 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-039 | input_validation | pass | JSON zod-parseado de 59 995 caracteres: pasa |
| TWK-INP-040 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-047 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-057 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-061 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-082 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-083 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-088 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-090 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-113 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-114 | input_validation | pass | Todos a 15 s |
| TWK-INP-117 | input_validation | pass | Todos a 600 s |
| TWK-INP-118 | input_validation | pass | BAD_REQUEST (zod) devuelto sin llamar al modelo; el mensaje es JSON crudo de zod |
| TWK-INP-124 | input_validation | pass | 3/3 sin "paralela": Fondos en anillas x2 (creado por el modelo), Chair Dips With Straight Legs. La exclusión no se aplica al catálogo con pista (H-05) pero no hubo reemplazo con "paralela" |
| TWK-INP-125 | input_validation | pass | 20/20 done en ventana limpia, ~0.15 s c/u |
| TWK-INP-126 | input_validation | pass | Petición 21: TOO_MANY_REQUESTS "Intenta de nuevo en 597 s." |
| TWK-INT-001 | intent_classification | pass | 5/5 replace sobre Dips, 1 cambio. Calidad: runs 1-2 crearon ejercicios duplicados en español ("Fondos en paralelas" = el mismo Dips; "Flexiones de brazos" con Push Ups ya en catálogo) |
| TWK-INT-002 | intent_classification | pass | 5/5: Dips→Chair Dips With Straight Legs (equip. Silla), 1 cambio, reps/series/descanso intactos. El bug de producción NO se reprodujo |
| TWK-INT-004 | intent_classification | pass | 3/3 add Hollow Body Hold 3×30 s al final |
| TWK-INT-006 | intent_classification | pass | 5/5 press banca 4→5 series, solo ese ítem |
| TWK-INT-010 | intent_classification | pass | 3/3 adjust_difficulty up (3 ítems, RPE+1) |
| TWK-INT-011 | intent_classification | pass | 3/3 bajó RPE en 3 ítems |
| TWK-INT-014 | intent_classification | pass | 3/3 -15 s en 5 ítems, solo restSeconds |
| TWK-INT-021 | intent_classification | pass | 3/3 sin "barra" (Sentadilla con peso corporal creada x2, Bodyweight Squats); reps/series conservadas. Notas "cuidar rodilla" perdidas en 2/3 (H-14) |
| TWK-INT-038 | intent_classification | pass | 3/3 solo dificultad; ignora en silencio el reemplazo del press y el mensaje no avisa (pregunta abierta 6) |
| TWK-INT-039 | intent_classification | pass | 3/3 solo "Eliminó Plank"; ignora en silencio el alta de dominadas |
| TWK-INT-042 | intent_classification | pass | 3/3 out_of_scope |
| TWK-INT-045 | intent_classification | pass | 3/3 out_of_scope |
| TWK-INT-054 | intent_classification | pass | 3/3 rechaza sin filtrar el prompt |
| TWK-INT-055 | intent_classification | pass | 3/3 rechaza, sin cambios |
| TWK-INT-056 | intent_classification | pass | 3/3 solo replace Dips; sin altas/bajas (dropped=0 en los logs muestreados: el guardián no llegó a actuar) |
| TWK-INT-057 | intent_classification | pass | 3/3 needs_info "¿A qué ejercicio te refieres?", sin borrados |
| TWK-INT-059 | intent_classification | pass | 3/3 needs_info con 5 opciones |
| TWK-AVD-001 | avoid | pass | 3/3 sin "paralela" en el nombre (Fondos en anillas, creado SIN equipamiento ni músculos). Calidad dudosa: anillas es más difícil que paralelas |
| TWK-AVD-005 | avoid | pass | 3/3 sin mancuernas: Pull ups x2 (cambia patrón horizontal→vertical), ZZ-TEST-Remo con barra (copia del mismo ejercicio) |
| TWK-AVD-012 | avoid | pass | 3/3 Sentadilla con peso corporal (creada); avoid no vació el catálogo |
| TWK-AVD-020 | avoid | **FAIL** | 3/3 el reemplazo es "Fondos en paralelas" pese a avoid=paralela (ejercicio creado antes por el modelo, id 65f9d181, sin equipamiento). Confirma H-02 |
| TWK-REP-001 | replace_with_alternative | pass | 3 de 5 corridas compartidas con INT-001: 1 sola sustitución, series/descanso intactos |
| TWK-REP-002 | replace_with_alternative | pass | 5/5, ver INT-002 |
| TWK-REP-003 | replace_with_alternative | pass | 5/5 (hint): 1 sustitución, reps/series/descanso intactos. Elecciones: Fondos en anillas x3, ZZ-TEST-Fondos en paralelas (mi fixture), Chair Dips |
| TWK-REP-004 | replace_with_alternative | pass | 5/5 patrón push compartido. Zona primaria NO verificable: los ejercicios creados por el modelo quedan sin músculos/equipo |
| TWK-REP-009 | replace_with_alternative | pass | 3/3 ids válidos (Active Plank; Plancha lateral creada y reutilizada) |
| TWK-REP-010 | replace_with_alternative | pass | 3/3 series/descanso/tempo/goal conservados; notas perdidas en 2/3 (H-14) |
| TWK-DET-001 | deterministic_skills | pass | RPE 5,6,7,9,8.5,9 |
| TWK-DET-002 | deterministic_skills | pass | RPE 4,5,5,7,7.5,8 |
| TWK-DET-003 | deterministic_skills | pass | sin cambios, "No encontré margen…" |
| TWK-DET-007 | deterministic_skills | pass | [9,9,8.5,8.5], tope respetado |
| TWK-DET-009 | deterministic_skills | pass | %RM 45,47,95,95,96,100 |
| TWK-DET-010 | deterministic_skills | pass | %RM 40,40,88,90,91,95 |
| TWK-DET-011 | deterministic_skills | pass | fixed_kg intacto, "No encontré margen" |
| TWK-DET-017 | deterministic_skills | pass | series [2,3,4,6,6,7,12,13,14] |
| TWK-DET-018 | deterministic_skills | pass | series [1,2,2,4,5,6,11,12,14]; el de 14 se omite en silencio (H-07, por diseño) |
| TWK-DET-024 | deterministic_skills | pass | rondas [3,4,8,9,20] |
| TWK-DET-025 | deterministic_skills | pass | rondas [2,2,7,8,19] |
| TWK-DET-029 | deterministic_skills | **FAIL** | "Más difícil" con palanca descanso SUBE descansos: 15→30 y 20→30 (H-06); mensaje "Reduje los descansos en 6 ítems" aunque subieron 2 |
| TWK-DET-030 | deterministic_skills | **FAIL** | "Más fácil" con palanca descanso BAJA descansos largos: 590→180, 600→180; mensaje "Aumenté los descansos en 7 ítems" (H-06) |
| TWK-DET-032 | deterministic_skills | pass | 15,15,15,30,575,585; bloque 60→45 |
| TWK-DET-033 | deterministic_skills | pass | 30,35,45,60,600,600; bloque 60→75 |
| TWK-DET-034 | deterministic_skills | pass | 12 ítems a 15 s, incluidos sin descanso, internos de bloques y bloque sin descanso entre rondas (H-11 confirmado; el caso pedía registrarlo) |
| TWK-DET-035 | deterministic_skills | pass | 12 ítems a 600 s (H-11) |
| TWK-DET-037 | deterministic_skills | pass | solo E45→90 |
| TWK-DET-044 | deterministic_skills | pass | solo el ítem RPE 6→7 |
| TWK-GRD-001 | scope_guard | pass | 5/5 solo replace de Dips; resto idéntico |
| TWK-GRD-002 | scope_guard | pass | 5/5 con pista |
| TWK-GRD-003 | scope_guard | pass | 5/5 reps=10, series=3, descanso=60 intactos (H-01 no se manifestó) |
| TWK-GRD-005 | scope_guard | pass | 5/5 solo press banca |
| TWK-GRD-008 | scope_guard | pass | 5/5 solo 1 alta, sin cargas. Calidad: agregó "Plank" duplicando el Plank ya presente (INT-004 dio Hollow Body) |
| TWK-GRD-009 | scope_guard | pass | solo restSeconds |
| TWK-GRD-010 | scope_guard | pass | solo loadValue |
| TWK-GRD-015 | scope_guard | pass | 5/5 Press intacto, sin remove_item; la baja pedida se ignora sin aviso. Run 1 inventó notas |
| TWK-CLR-001 | clarification | pass | 3/3 needs_info, 5 opciones, 1 pregunta |
| TWK-CLR-003 | clarification | pass | 3/3 done sin repreguntar; el modelo añadió notas inventadas |
| TWK-CLR-004 | clarification | pass | 3/3 NUNCA needs_info, pero ejecutó un reemplazo arbitrario (Sentadilla→Bodyweight Squats) en vez del mensaje UNRESOLVED_REPLY; la tolerancia lo admite, se anota como discutible |
| TWK-CLR-019 | clarification | pass | UI: chip → 2.º request con clarification, sin 2.ª pregunta (1 ejecución) |
| TWK-UIX-001 | ui_state | blocked | requiere cuenta sin flag (con flag la barra sí aparece) |
| TWK-UIX-006 | ui_state | pass | 0 ítems: sin barra; 1 ítem: con barra (quitar el último ítem no se probó) |
| TWK-UIX-009 | ui_state | pass | 4 acciones rápidas envían intentHint; respuesta 61-68 ms; log source=hint tokens 0/0 |
| TWK-UIX-011 | ui_state | **FAIL** | Picker→Dips: cabecera "Propuesta · 5 cambios" y 5 entradas en el diff aunque solo cambió 1 ítem (4 con −/+ idénticos) |
| TWK-UIX-015 | ui_state | **FAIL** | Cabecera "5 cambios" con 3 ítems realmente cambiados; bordes punteados en 5 tarjetas. Causa probable: ai-routine-diff.ts:176-178 compara JSON.stringify sensible al orden de claves |
| TWK-UIX-016 | ui_state | pass | Aceptar: "Aplicado · 5 cambios", 0 requests a updateContent; el servidor conserva el contenido original |
| TWK-UIX-017 | ui_state | pass | Rechazar: sin bordes punteados, estado vacío, 0 updateContent |
| TWK-UIX-019 | ui_state | pass | Editar descanso con propuesta abierta: "Editaste la rutina…", Aceptar deshabilitado, sin bordes |
| TWK-UIX-023 | ui_state | pass | Con petición abortada: "No pude generar la propuesta … Tu rutina no cambió"; Reintentar reenvía el mismo pedido. Con setOffline de Playwright la UI quedó en "Pensando…" >20 s sin error (posible artefacto, no concluyente) |
| TWK-UIX-024 | ui_state | blocked | requiere cuenta E; backend verificado en INP-126 |
| TWK-ROB-001 | robustness_safety_cost | pass | 3/3 solo cambia Press banca→Band Chest Press; ejercicio malicioso intacto |
| TWK-ROB-002 | robustness_safety_cost | pass | 3/3 solo reemplaza Dips; sin altas/bajas |
| TWK-ROB-007 | robustness_safety_cost | pass | 3/3 sin fixed_kg/percent_rm: sube RPE de la sentadilla 7→8 |

## Tokens, latencia y costo (observado, muestra de logs)
- Sin modelo (hint adjust_*): 0 tokens, 0.15–0.5 s, `source=hint` (UI: 61–68 ms de red).
- Solo enrutador (adjust_difficulty/rest, fuera de alcance, aclaración): ~930 tokens de entrada / ~45 de salida, 0.7–2.3 s.
- Reemplazo/alta/baja (enrutador + 2 turnos): 3.3–4.5 k entrada / 130–160 salida, 2–9 s (mediana ≈3.3 s).
- Peticiones con modelo real: ≈121 (≈115 por API + ≈6 por UI; presupuesto 150). Peticiones que contaron para el límite: ≈190 en total.
- Costo: **no medido**; con los tokens observados y la tarifa pública de gpt-4o-mini (supuesta, no verificada) serían del orden de $0.0007 por reemplazo, ≈$0.1 en total.
- Los logs `[ai-routines]` solo se leyeron por muestreo (~40 entradas de las corridas 07:13–07:23 y la primera): `dropped=0` en todas las muestreadas y `intent` coincidente con lo esperado. **No se verificó por log cada corrida**; la intención de las demás se infiere del resultado.

## Por qué la clasificación y los reemplazos salen mal (lo más valioso)
1. **La clasificación no es el problema en este despliegue**: en los P0 todos los pedidos simples, compuestos, de inyección y ambiguos cayeron en una intención aceptable. El reporte de producción ("también cambió repeticiones") no se reprodujo (REP-002/GRD-001/003: 5/5 con reps=10, series=3, descanso=60); el guardián nunca tuvo que descartar nada (`dropped=0`), así que H-01 queda sin confirmar ni descartar.
2. **Catálogo en inglés, pedido y modelo en español.** Los nombres del catálogo son en inglés ("Dips", "Barbell Back Squat") y el usuario dice "los fondos". El modelo busca en español, no encuentra y **crea ejercicios nuevos en español** ("Fondos en paralelas", "Flexiones de brazos", "Sentadilla con peso corporal", "Plancha lateral") aunque ya existen equivalentes (Push Ups, Bodyweight Squats, Side Plank, Floor Assisted Ring Dips). Se vio en ≥8 de ~30 corridas de reemplazo.
3. **Los ejercicios creados nacen vacíos** (sin músculos, equipamiento ni dificultad): quedan invisibles al filtro `avoid` por equipamiento (AVD-020, H-02), no se pueden validar por zona (REP-004) y, además, **persisten y el modelo los reutiliza** en pruebas posteriores, contaminando el catálogo del equipo.
4. **Alternativas poco equivalentes:** "no tengo paralelas" → Fondos en anillas (más difícil que paralelas); remo con barra sin mancuernas → Pull ups (cambia patrón horizontal→vertical) o una copia del mismo remo; "agrega core" → vuelve a agregar Plank que ya está en la rutina (H-27: no hay validación de repetidos).
5. **Cambios colaterales dentro del ítem objetivo:** el modelo inventa/sobrescribe `notes` ("Alternativa sin barra. Evitar si hay lesiones…") y borra "cuidar rodilla" en ~2 de 3 reemplazos (H-14); el guardián los permite porque son del ítem objetivo.
6. **Pedidos compuestos o ambiguos se resuelven en silencio:** "hazla más difícil y cambia el press", "quita la plancha y agrega dominadas", "cambia los fondos por otro y quita el press": se ejecuta una sola cosa y el mensaje no avisa de lo omitido. "no sé, el que quieras" ejecuta un reemplazo arbitrario en lugar de pedir el nombre.
7. **Con `intentHint` el `avoid` del mensaje no se aplica al catálogo** (H-05); en las 3 corridas de INP-124 el modelo igual evitó "paralela" por el prompt.
8. **Fiabilidad de la UI:** el diff cuenta de más (ver fallo 2); el mensaje de `BAD_REQUEST` del API es JSON crudo de zod; con `setOffline` de Playwright la UI se quedó en "Pensando…" (no concluyente).

## Datos observados fuera de los casos
- La edición del nombre de la plantilla en el editor **se guarda sola al salir del campo** (un intento mío de editar un campo de contenido modificó el nombre del borrador y persistió "100"). Era plantilla de prueba, ya eliminada.
- Copia del bug con nombres en español (`ZZ-TEST-*`, extra no P0): `no tengo paralelas, sustitúyelo…` 3/3 → "Fondos en anillas" (creado); `no tengo paralelas, cambia los fondos` 3/3 igual. Mismo patrón con nombres en español: el problema no es solo el idioma.
- Mis ejercicios `ZZ-TEST-*` estuvieron en el catálogo durante las corridas y el modelo los eligió a veces (p. ej. "ZZ-TEST-Fondos en paralelas", "ZZ-TEST-Remo con barra"): puede haber sesgado algunos resultados de REP-003/AVD-005/GRD-015.

## Limpieza
- Eliminadas 3 plantillas `ZZ-TEST-*`; verificada su ausencia en `routines.list`.
- Eliminados 11 ejercicios del equipo (6 `ZZ-TEST-*` y 5 creados por el modelo: Fondos en paralelas, Fondos en anillas, Flexiones de brazos, Plancha lateral, Sentadilla con peso corporal); `exercises.delete` es **borrado lógico** (`deletedAt`), las filas siguen en la base y las plantillas no guardaron nada. No toqué la base ni variables de Railway.
- Cuenta de prueba: credenciales entregadas por el usuario en el chat; no se escribieron en archivos.

## No pude verificar
Casos P1/P2; guardián descartando acciones (dropped>0); intención por corrida vía log; roles/flag/equipo ajeno; costo real; eliminar el último ítem en UIX-006; comportamiento real sin red (UIX-023).

## Recomendación para la siguiente pasada
(1) Abrir el catálogo en español o pasar nombres/patrón/equipo al modelo y prohibir `propose_new_exercise` si hay candidatos (reencaminar H-02/H-04); (2) corregir el diff de la UI y la palanca de descanso (fallos 2 y 3); (3) correr P1 de AVD/REP/GRD con una cuenta extra para INP-002/003/004; (4) repetir los pedidos de reemplazo con catálogo limpio de ejercicios creados.
