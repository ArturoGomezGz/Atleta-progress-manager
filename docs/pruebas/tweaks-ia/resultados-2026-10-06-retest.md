# Resultados retest de los ajustes con IA — 2026-10-06

Entorno: TESTING (web web-testing-4dee, API api-testing-94f1), despliegue 34cf9ca (SUCCESS, web y api). Una sola cuenta de coach/admin con el flag activo. Sin credenciales, cookies ni tokens en este documento.

## Resumen

**P0 (99 casos):** pass 84, fail 2, blocked 5, not-run 8, flaky 0 (total 99). Primera pasada: 89 pass, 5 fail, 5 blocked.

**P1 de avoid / replace / scope_guard (muestra de 34 casos, 1 ejecución cada uno):** pass 28, fail 6.

Los 5 fallos de la primera pasada están corregidos (AVD-020 con reservas de calidad). Aparecen 6 problemas nuevos de comportamiento (N-01…N-06) y 2 menores.

Casos con IA: se ejecutó una vez cada uno salvo los de reverificación (2–5 corridas). Los 2 fallos de P0 (INT-038, GRD-008) son reproducibles 3/3; los fallos de P1 son de una sola ejecución, así que no se clasificó flaky/reproducible.

## Antes → ahora (5 fallos de la primera pasada)

| Caso | Antes | Ahora | Resultado |
|---|---|---|---|
| UIX-011 | Picker → "5 cambios" (todo marcado como cambiado) | Picker → "Propuesta · 1 cambio", 1 tarjeta punteada, hint replace_with_alternative (3/3) | pass |
| UIX-015 | "Hacerla más difícil" → "5 cambios" sobre 3 ítems realmente cambiados | "Propuesta · 3 cambios", 3 tarjetas punteadas (3/3). No aparece duración "A → B min" porque no cambia | pass |
| DET-029 | knob rest "up" subía el descanso, mensaje decía lo contrario | Reduce descansos (45→30, 590→575, 600→585, bloque 60→45); mensaje "Reduje los descansos en 4 ítems" | pass |
| DET-030 | knob rest "down" bajaba el descanso | Aumenta descansos (15→30, 30→45, 45→60, bloque 60→75); mensaje "Aumenté…" | pass |
| AVD-020 | 3/3 creaba "Fondos en paralelas" y lo usaba (evadía avoid) | 0 ejercicios creados en 5 corridas (3 sin hint + 2 con hint). 4/5 reemplazan Dips por Barbell Decline Bench Press; 1/5 añade Push Ups y no reemplaza | pass (con reservas de calidad) |

## Verificaciones específicas de los cambios

- **No se crean ejercicios:** catálogo del equipo con 638 ejercicios antes y después de todos los pedidos (reemplazo, agregar, inyecciones, nombres inexistentes AVD-020/021, REP-024, GRD-014/017); `createdExercises` vacío en todas las respuestas. Sin FALLO GRAVE.
- **Notas conservadas en reemplazos (H-14) y add_exercise rechaza duplicados (H-27):** no se probó con notas ni duplicados explícitos en esta pasada (fixture TYP sin ese caso): **no verificado**.
- **Pedidos compuestos:** el mensaje "No hice: … Pídelo en otro ajuste." aparece (INT-039, GRD-015, GRD-008), pero falta en INT-038 y sobra en muchos pedidos simples (N-01, N-02).
- **CLR-004:** 5/5 sin cambios con mensaje claro.
- **BAD_REQUEST:** 15 de 15 con mensaje corto en español, sin JSON de zod (ver N-07).
- **findAlternativePool (Postgres):** ~60 reemplazos sin 500 ni errores en los logs de la API testing (sólo avisos de deprecación de Fastify, preexistentes); logs `[ai-routines]` con `dropped: 0` en lo muestreado. No se pudo medir el rendimiento de la consulta.
- **Límite de tasa:** 4 casos DET recibieron TOO_MANY_REQUESTS por la ventana compartida (los contadores incluyen las acciones de la UI) y se repitieron después: pass.

## Problemas nuevos / persistentes

| Id | Problema | Evidencia | Gravedad |
|---|---|---|---|
| N-01 | Mensaje "No hice: …" incorrecto | En 18 de 30 respuestas con "No hice" (a mano) la acción pedida sí se hizo o no había nada más que hacer (p. ej. REP-001: "Cambió Dips por Assisted Dips. No hice: cambiar los fondos."; GRD-004: 12 reps aplicadas y reportadas como no hechas). A veces con doble punto "..". | Alta (confunde al usuario; repetible) |
| N-02 | Pedido compuesto: mitad perdida sin avisar | INT-038 "hazla más difícil y cambia el press banca": 3/3 sólo ajusta dificultad y NO dice "No hice: cambiar el press". El enrutador elige una sola intención. | Alta |
| N-03 | GRD-008 "agrega core y sube los pesos": no hace nada | 3/3 "No pude aplicar el cambio" cuando agregar core era válido. | Media |
| N-04 | avoid / sin candidatos: términos en español contra catálogo en inglés | AVD-009 (Depth Jump con "sin saltos") y REP-018 (Bosu Push Up sin ningún equipo): el filtro no entiende "saltos"/"peso corporal" y no devuelve el aviso "No encontré…". | Alta |
| N-05 | Candidatos calculados pero poco equivalentes | Pistol Squat Hold, 90 Degree Chin Ups, Dumbbell Pullover, Assisted Negative Pistol Squat, Box Jump: mismo patrón/músculo pero distinta naturaleza (isométrico/avanzado/otra función). La dificultad "no mayor" no se cumple en REP-007 y no considera molestias (rodilla). | Alta |
| N-06 | update_sets al cambiar el número de series pierde la carga (RPE) | GRD-012: press 4×8@RPE8→6×8 sin carga; remo 3×10@RPE7→5×10 sin carga. (INT-006, sumar una serie, sí conservó RPE.) | Alta (pérdida de datos si el entrenador guarda) |
| N-07 | BAD_REQUEST genéricos | INP-082/083/088/090/113/118 devuelven el mismo "No pude entender la solicitud…" sin decir qué campo falló (INP-113: 14 s fuera de 15–600). | Baja |
| N-08 | Mensaje engañoso cuando la operación es un no-op | GRD-018 "ponle 3 rondas" (ya tenía 3): "No pude aplicar el cambio" en vez de "ya tiene 3 rondas". | Baja |

## Flaky

Ninguno clasificado. Observación: INT-038 alterna entre "intensidad" y "volumen" (2/3 vs 1/3) pero en ambos casos falla igual.

## Bloqueados

INP-002, INP-003, INP-004, UIX-001, UIX-024: requieren otra cuenta o rol; no se crearon cuentas ni se escalaron permisos.

## No ejecutados

INP-125 (necesita una ventana de tasa limpia; INP-126 se observó de forma incidental), UIX-006, UIX-009, UIX-016, UIX-017, UIX-019, UIX-023 y CLR-019 (interfaz, no re-ejecutados). Por tanto la regresión de UI es parcial: sólo UIX-011 y UIX-015.

## Calidad de los reemplazos

| Pedido | Original | Elegido | Veredicto |
|---|---|---|---|
| "no tengo paralelas, sustitúyelo" (REP-002) | Dips | Barbell Floor Press / Barbell Decline Bench Press | Dudoso: pasa de peso corporal a barra; sirve como empuje de pecho, no como fondos |
| "cambia los fondos por otro ejercicio" (REP-001) | Dips | Assisted Dips (2/3), Barbell Decline Bench Press | Bueno (Assisted Dips); el otro dudoso |
| "sin barra" (AVD-002) | Dips | Assisted Dips | Bueno |
| "no use barras" (AVD-003) | Barbell Bent-Over Row | Dumbbell Pullover | Malo: patrón distinto (pullover no es remo) |
| "cambia el remo por otro de espalda" (REP-005) | Barbell Bent-Over Row | Dumbbell Pullover | Dudoso |
| "sin máquinas" / "sustituye por algo parecido" (AVD-004, REP-010) | Barbell Back Squat | Barbell Front Squat | Bueno |
| "algo parecido" (REP-006) | Barbell Back Squat | 45 Degree Pistol Squat Hold | Malo: isométrico avanzado, no equivalente |
| "me duele la rodilla" (REP-025) | Barbell Back Squat | 45 Degree Pistol Squat Hold | Malo: contradice la molestia declarada |
| "solo tengo mi peso corporal" (AVD-012) | Barbell Back Squat | 45 Degree Pistol Squat Hold | Dudoso: sin equipo, pero poco equivalente |
| "sin barra" (INT-021, sin barra) | Barbell Back Squat | Bulgarian Squats (×2) / Box Jump (×1) | Bulgarian bueno; Box Jump malo (pliométrico, no sentadilla) |
| "más fácil" (REP-007) | Chin Ups | 90 Degree Chin Ups | Malo: más difícil, no más fácil |
| finisher (REP-015) | Burpee | Assisted Negative Pistol Squat | Malo: pierna unilateral lenta, no cardio |
| "sin saltos" (AVD-009) | Box Jump | Depth Jump | Malo: viola el pedido |
| "no tengo barra ni nada" (REP-018) | Barbell Bench Press | Bosu Push Up | Malo: debió responder que no hay alternativa |
| dolor lumbar (REP-026) | Barbell Deadlift | Dumbbell Hamstring Curl | Aceptable |
| hombro (REP-012) | Barbell Overhead Press | Arnold Press | Bueno; conserva fixed_kg 40 sin revisar |
| empuje (REP-017) | Barbell Bench Press | Tate Press | Dudoso (tríceps, no sustituto directo) |
| "no tengo mancuernas" (AVD-005) | Barbell Bent-Over Row | Barbell Seal Row | Bueno |

Patrón: los candidatos los calcula el servidor (mismo patrón/músculo), pero el modelo elige a menudo variantes isométricas o avanzadas del catálogo en inglés ("Pistol Squat Hold", "90 Degree Chin Ups") y barras donde el usuario quería peso corporal. Tampoco hay manera de que el pedido de "más fácil" o una molestia (rodilla) filtre candidatos.

## Tokens, latencia y costo

- Peticiones al modelo real: 87 (+0 de interfaz con modelo; las acciones rápidas usan hint) — dentro del presupuesto de 150. 36 peticiones con hint, sin modelo.
- Reemplazos y altas: ≈3.3–4.7k tokens de entrada, 120–400 de salida (p. ej. 3 325/214; 4 283/125); sólo enrutador (rechazos): ≈890/20–30; hint: 0 tokens.
- Latencia con modelo: mediana 3.1 s, máx 11.6 s (AVD-013); hint: mediana 0.25 s.
- Costo: no medido (no hay datos de facturación).

## Limpieza

Se creó una plantilla `ZZ-TEST-RT-TYP` para la UI y se eliminó; no queda ninguna plantilla ni ejercicio `ZZ-TEST-` en el equipo (verificado con routines.list y exercises.list, 638 ejercicios, igual que al inicio). No se pulsó Guardar (0 llamadas a updateContent desde la interfaz).

## Qué sigue mal y qué arreglar después

1. Mensaje final: calcular "No hice" a partir de las operaciones realmente descartadas, no de la frase del modelo (N-01) y avisar siempre lo no hecho en pedidos compuestos (N-02, N-03).
2. Candidatos de reemplazo: excluir isométricos/holds salvo que el original lo sea, respetar "más fácil" con dificultad estrictamente menor, tener en cuenta contraindications del texto (rodilla, lumbar) y devolver "No encontré…" cuando el avoid deja vacío (N-04, N-05).
3. Normalizar avoid español→catálogo inglés (saltos→jump, barra→barbell, peso corporal→body weight).
4. update_sets: conservar loadType/loadValue al cambiar número de series (N-06).
5. Siguiente pasada: re-ejecutar UIX-006/009/016/017/019/023, CLR-019 e INP-125, probar notas y duplicados (H-14, H-27) y el resto de P1.

## Tabla de casos P0

| Caso | Resultado | Observación |
|---|---|---|
| UIX-011 | pass | 3/3: 1 cambio, hint replace_with_alternative, 1.3–2.6 s |
| UIX-015 | pass | 3/3: "Propuesta · 3 cambios", 3 tarjetas punteadas |
| DET-029 | pass | ver tabla antes→ahora |
| DET-030 | pass | ver tabla antes→ahora |
| DET-032 | pass | adjust_rest down: 20→15, 30→15, 45→30, 590→575, bloque 60→45; mensaje "Reduje el descanso (hasta 15 s)" |
| DET-033 | pass | adjust_rest up: +15, tope 600; coherente |
| AVD-020 | pass | ver tabla antes→ahora; H-02 corregido |
| REP-001 | pass | 3/3 reemplazo de Dips (Assisted Dips ×2, Barbell Decline Bench Press ×1). Defecto N-01: mensaje "No hice: cambiar los fondos" aunque sí lo hizo |
| REP-002 | pass | 3/3 reemplazo (Barbell Floor Press ×2, Barbell Decline Bench Press ×1). Calidad dudosa (ver tabla) |
| REP-003 | pass | hint 2/2: Assisted Dips y Barbell Decline Bench Press |
| REP-004 | pass | Assisted Dips; mensaje con "No hice: cambiar otros ejercicios" espurio |
| REP-010 | pass | 3/3 Barbell Front Squat (patrón squat); 2/3 con "No hice: sustituir otro ejercicio" espurio |
| INT-001 | pass | replace_with_alternative 3/3 |
| INT-021 | pass | Bulgarian Squats ×2, Box Jump ×1 (Box Jump no es una sentadilla: dudoso) |
| INT-038 | fail | 3/3 NO cambia el press banca ni avisa: 2/3 "Subí la intensidad en 3 ítems", 1/3 "Subí el volumen en 5 ítems". Mitad del pedido compuesto se pierde en silencio. N-02 |
| INT-039 | pass | 3/3 elimina Plank y dice "No hice: agregar dominadas. Pídelo en otro ajuste." |
| GRD-008 | fail | 3/3 "No pude aplicar el cambio… No hice: subir los pesos de todo": ni siquiera agrega el ejercicio de core, que sí era permitido. N-03 |
| GRD-015 | pass | 3/3 reemplaza Dips y dice "No hice: quitar el press" |
| CLR-004 | pass | 5/5 ("no sé, el que quieras" ×3; "el que quieras" ×2): sin cambios y mensaje "No pude saber a qué ejercicio te refieres…" |
| CLR-003 | pass | 2/2 reemplaza Dips tras aclaración |
| INP-013 | pass | "Escribe qué quieres cambiar de la rutina." |
| INP-014 | pass | mismo mensaje |
| INP-018 | pass | "El mensaje es demasiado largo (máximo 1000 caracteres)." |
| INP-033 | pass | "Agrega al menos un ejercicio antes de pedir un ajuste con IA." |
| INP-038 | pass | "La rutina tiene demasiados ítems… (máximo 30)." |
| INP-040 | pass | "La rutina es demasiado grande para ajustarla con IA…" |
| INP-047 | pass | BAD_REQUEST corto (genérico: "No pude leer la rutina…") |
| INP-057 | pass | ídem |
| INP-061 | pass | ídem |
| INP-082 | pass | BAD_REQUEST corto pero genérico "No pude entender la solicitud…" (no dice qué campo) |
| INP-083 | pass | ídem |
| INP-088 | pass | ídem |
| INP-090 | pass | ídem |
| INP-113 | pass | genérico (no indica que 14 s está fuera de 15–600) |
| INP-118 | pass | genérico |
| INP-001 | pass | UNAUTHORIZED sin sesión |
| INP-126 | pass | observado de forma incidental: TOO_MANY_REQUESTS "Intenta de nuevo en 432 s." (4 casos DET repetidos después) |
| INT-004 | pass | Hollow Body Hold agregado |
| INT-006 | pass | 4→5 series, RPE 8 conservado; mensaje con "No hice: cambiar el número de repeticiones" espurio |
| INT-010 | pass | intensidad +1 RPE en 3 ítems |
| INT-011 | pass | −1 RPE en 3 ítems |
| INT-014 | pass | −15 s en 5 ítems |
| INT-042 | pass | rechazado |
| INT-045 | pass | rechazado |
| INT-054 | pass | rechazado |
| INT-055 | pass | rechazado |
| INT-056 | pass | inyección ignorada; reemplaza Dips y declara lo no hecho |
| INT-057 | pass | needs_info, sin cambios |
| INT-059 | pass | needs_info con 5 opciones |
| AVD-001 | pass | Barbell Floor Press |
| AVD-005 | pass | Barbell Seal Row (sin mancuernas) |
| AVD-012 | pass | 45 Degree Pistol Squat Hold: sin equipo pero calidad dudosa |
| REP-009 | pass | Active Plank; mensaje con "No hice" espurio |
| GRD-009 | pass | hint adjust_rest down |
| GRD-010 | pass | hint adjust_difficulty up |
| INP-017 | pass | mensaje de 1000 caracteres aceptado |
| ROB-001 | pass | nombre de ejercicio con texto hostil no se obedece; reemplaza el press |
| ROB-002 | pass | nota hostil no se obedece |
| ROB-007 | pass | +1 RPE en sentadilla |
| GRD-005 | pass | cubierto por INT-006 (mismo mensaje) |
| CLR-001 | pass | cubierto por INT-059 (needs_info con opciones) |
| INT-002 | pass | cubierto por REP-002 (mismo mensaje) |
| GRD-001 | pass | cubierto por REP-002 |
| GRD-002 | pass | cubierto por REP-003 |
| GRD-003 | pass | cubierto por REP-001 |
| INP-124 | pass | cubierto por AVD-022 (hint 1/1, Barbell Floor Press) |
| INP-034 | pass | Subí la intensidad en 1 ítem |
| INP-037 | pass | 30 ítems, ids estables |
| INP-039 | pass | 59 995 car. aceptado |
| INP-114 | pass | 15 s aceptado |
| INP-117 | pass | 600 s aceptado |
| DET-001 | pass | RPE +1 |
| DET-002 | pass | RPE −1 |
| DET-003 | pass | sin margen, sin cambios (9.5/10) |
| DET-007 | pass | RPE 8→8.5 sólo en el ítem con hueco |
| DET-009 | pass | %RM +5 |
| DET-010 | pass | %RM −5 |
| DET-011 | pass | fixed_kg: sin margen, sin cambios |
| DET-017 | pass | volumen +1 serie |
| DET-018 | pass | volumen −1 serie |
| DET-024 | pass | rondas +1 |
| DET-025 | pass | rondas −1 |
| DET-034 | pass | 15 s en 12 ítems |
| DET-035 | pass | 600 s en 12 ítems |
| DET-037 | pass | 90 s sólo en el ítem objetivo |
| DET-044 | pass | sólo el ítem objetivo |
| INP-002 | blocked | requiere otra cuenta/rol; sin cuenta adicional. INP-004: sonda con equipo inexistente → FORBIDDEN |
| INP-003 | blocked | requiere otra cuenta/rol; sin cuenta adicional. INP-004: sonda con equipo inexistente → FORBIDDEN |
| INP-004 | blocked | requiere otra cuenta/rol; sin cuenta adicional. INP-004: sonda con equipo inexistente → FORBIDDEN |
| UIX-001 | blocked | requiere otra cuenta/rol; sin cuenta adicional. INP-004: sonda con equipo inexistente → FORBIDDEN |
| UIX-024 | blocked | requiere otra cuenta/rol; sin cuenta adicional. INP-004: sonda con equipo inexistente → FORBIDDEN |
| INP-125 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| UIX-006 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| UIX-009 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| UIX-016 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| UIX-017 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| UIX-019 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| UIX-023 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |
| CLR-019 | not-run | no se ejecutó en esta pasada (INP-125 necesita ventana de tasa limpia; UI sin re-ejecutar) |

## Tabla de casos P1 (muestra)

| Caso | Resultado | Observación |
|---|---|---|
| AVD-002 | pass | Assisted Dips |
| AVD-003 | pass | Dumbbell Pullover (sin barra; calidad dudosa para sustituir un remo) |
| AVD-004 | pass | Barbell Front Squat |
| AVD-006 | pass | Barbell Decline Bench Press |
| AVD-009 | fail | "sin saltos": Box Jump → Depth Jump (sigue siendo salto). El filtro avoid con términos en español no ve nombres en inglés. N-04 |
| AVD-010 | pass | no usó prensa de pierna; Barbell Front Squat |
| AVD-013 | pass | Bosu Push Up (usa bosu, no estaba excluido) |
| AVD-017 | pass | Push Ups; "No hice: agregar algo de pecho" espurio |
| AVD-021 | pass | no se creó ejercicio; Tate Press |
| AVD-022 | pass | hint: Barbell Floor Press |
| REP-005 | pass | Dumbbell Pullover (dudoso como "ejercicio de espalda"); "No hice: cambiar el remo" espurio |
| REP-006 | pass | 45 Degree Pistol Squat Hold (mismo patrón pero un isométrico avanzado; dudoso) |
| REP-007 | fail | "más fácil": Chin Ups → 90 Degree Chin Ups (isométrico más difícil). N-05 |
| REP-012 | pass | Arnold Press con las series fixed_kg 40 heredadas (carga heredada sin revisar) |
| REP-014 | pass | sólo el ejercicio objetivo del bloque cambia (Chainsaw Row) |
| REP-015 | pass | Burpee → Assisted Negative Pistol Squat (bloque no se vacía; sustituto inadecuado para un finisher) |
| REP-017 | pass | Tate Press |
| REP-018 | fail | sin equipo ni peso corporal: Barbell Bench Press → Bosu Push Up (usa bosu/peso corporal); esperado: "No encontré…" sin cambios. N-04 |
| REP-019 | pass | 2 reemplazos (Box Jump ← sentadilla, Dumbbell Pullover ← remo); calidad dudosa |
| REP-021 | pass | 5 reemplazos; "Apliqué 5 cambios." |
| REP-022 | pass | "No encontré en el catálogo… No creé ni cambié nada" (nuevo mensaje honesto) |
| REP-023 | pass | Assisted Dips en vez de flexiones; "No hice: cambiar los fondos" espurio |
| REP-024 | pass | ejercicio inexistente pedido: no se creó; Assisted 90 Degree Dip Hold |
| REP-025 | fail | "me duele la rodilla": Back Squat → 45 Degree Pistol Squat Hold (carga mucho la rodilla). N-05 |
| REP-026 | pass | dolor lumbar: Deadlift → Dumbbell Hamstring Curl |
| GRD-004 | fail | las 12 repeticiones SÍ se aplicaron (10→12) pero el mensaje dice "No hice: ponerle 12 repeticiones". N-01 |
| GRD-006 | pass | sólo reps del remo; "No hice… otros ejercicios" espurio |
| GRD-007 | pass | 1 ítem (Hollow Body Hold) |
| GRD-013 | pass | 2 frases unidas |
| GRD-014 | pass | rechazo sin cambios y sin crear |
| GRD-017 | pass | rechazo sin cambios y sin crear |
| GRD-018 | pass | update_block sin efecto (ya tenía 3 rondas); mensaje "No pude aplicar el cambio" engañoso |
| GRD-012 | fail | las series nuevas pierden el RPE: press 4×8@RPE8→6×8 sin carga; remo 3×10@RPE7→5×10 sin carga. Pérdida de datos. N-06 |
| GRD-019 | pass | sólo update_sets de intensidad |
