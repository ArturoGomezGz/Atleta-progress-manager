# Experiencia inmersiva de entrenamiento

> **Estado:** Planeada (en definición). **Última revisión:** 2026-10-08.

Te pones los audífonos con tu música y el entrenamiento te guía por voz paso a paso: qué ejercicio sigue, el ritmo de cada repetición, cuánto llevas de descanso y cuándo volver. No hay que tocar el teléfono en ningún momento.

## Decisiones tomadas

- **Solo móvil (Android).** No habrá versión web.
- **No es un tipo de rutina nuevo.** El builder no cambia: cualquier entrenamiento que cumpla las condiciones (abajo) muestra en la app móvil la opción "Experiencia inmersiva". Si no las cumple, la opción no aparece.
- **Avance automático.** Al terminar las repeticiones o el tiempo, la guía pasa sola al descanso y a lo siguiente. El atleta nunca marca "terminé".
- **Sin registro de lo realizado.** Se da por hecho lo prescrito; no se capturan reps ni peso reales.
- **Voz:** dice el nombre del ejercicio y marca el tiempo (cuenta de repeticiones según el tempo, o el cronómetro en series por tiempo). Nada más por ahora.
- **Música:** se baja su volumen mientras habla la guía (ducking).
- **Sin transición fija entre series ni entre ejercicios.** Solo hay pausa si la rutina define un descanso. Los únicos 5 s fijos son el cambio de lado en ejercicios "Por cada lado". No se agrega ningún campo en la base de datos.
- **Función limitada** con feature flag mientras se prueba.

## Condiciones para habilitarla

Un entrenamiento es apto si **todas** sus series se pueden cronometrar:

| Tipo de serie | Condición |
|---|---|
| Por tiempo | Tiene `targetDurationSeconds` |
| Por repeticiones | Tiene `targetReps` y el ejercicio tiene un tempo válido (formato estándar, abajo) |
| Por distancia o AMRAP | No apta: si hay alguna, el entrenamiento no se habilita |

Los descansos **no** son obligatorios: si un ejercicio no tiene `restSeconds` (o un circuito no tiene `restBetweenRoundsSeconds`), simplemente no hay descanso.

Los ejercicios "Por cada lado" (`perSide`) cuentan doble: lado 1, cambio de lado de 5 s y lado 2.

## Tempo estandarizado

Formato `B-P-S-P`: cuatro valores separados por guiones, en segundos.

| Posición | Fase |
|---|---|
| 1 | Bajada (excéntrica) |
| 2 | Pausa abajo |
| 3 | Subida (concéntrica) |
| 4 | Pausa arriba |

Cada valor es un entero de 0 a 9 o `X` (explosivo). Ejemplo: `3-1-1-0` → 5 s por repetición.

- Duración de una repetición = suma de las cuatro fases (`X` = explosivo, cuenta como 1 s).
- Duración de la serie = reps × duración de la repetición (×2 más 5 s si es por lado).
- El builder valida el formato al guardar; ya existe `explainTempo` en `workout-text.ts`, que acepta este formato.
- Tempos viejos en texto libre que no cumplan el formato siguen guardados, pero el entrenamiento no será apto hasta corregirlos.

## Consideraciones técnicas (móvil)

- **Voz:** `expo-speech` y sonidos cortos (cuenta regresiva 3-2-1, marca por repetición).
- **Ducking:** modo de audio que baje la música de otras apps mientras habla la guía.
- **Pantalla apagada:** la guía debe seguir con la pantalla bloqueada (servicio en primer plano en Android). Los temporizadores ya se calculan por hora de fin, así que no se desfasan en segundo plano.
- **Feature flag en móvil:** hoy la app móvil no usa funciones limitadas ([mobile.md](mobile.md)); hay que leer el flag desde la API.

## Funcionalidades de apoyo

- [x] **Por cada lado**: reps o tiempo por lado; en tiempo, dos cronómetros seguidos (falta probarlo en la app).
- [ ] Tempo estandarizado y validado en el builder.
- [ ] Cálculo de "apto para experiencia inmersiva" (compartido, usado por la app móvil).
- [ ] Feature flag `immersive` y su lectura en la app móvil.
- [ ] Reproductor inmersivo en móvil (voz, ducking, avance automático, pantalla bloqueada).

## Pendiente de definir

1. Sonidos de las fases de cada repetición: falta un aviso al empezar cada pausa (isométrica) y un sonido más reconocible para la fase explosiva (`X`).
2. Idioma de la voz configurable por el usuario (español o inglés), más adelante.

## Sonidos y voz acordados

- **Fin de descanso y fin de serie por tiempo:** "tic, tic, tic, ta": un tic en cada uno de los últimos 3 s y un "ta" al llegar a cero.
- **Voz en el descanso:** dice "diez segundos" cuando faltan 10 s para el siguiente ejercicio. Por ahora solo en español.
- **Voz con el nombre del ejercicio que sigue:** al empezar el descanso previo; si no hay descanso, al arrancar la serie.
- Prototipo para escucharlos: artefacto "Modo inmersivo: voz o sonidos".
