# Experiencia inmersiva de entrenamiento

> **Estado:** Planeada (en definición). **Última revisión:** 2026-10-08.

Te pones los audífonos con tu música y el entrenamiento te guía por voz paso a paso: qué ejercicio sigue, cuándo empezar, el ritmo de cada repetición, cuánto llevas de descanso y cuándo volver. La idea es no tener que ver el teléfono.

No todos los entrenamientos podrán usarla: solo los que tengan todo lo necesario para que la guía sea exacta (ver "Requisitos de un entrenamiento").

## Requisitos de un entrenamiento

Partiendo del contenido actual de la rutina (`apps/api/src/services/routine-content-schema.ts`):

| Requisito | Hoy | Falta |
|---|---|---|
| Cada serie por tiempo tiene duración | `targetDurationSeconds` existe | Exigirlo |
| Cada serie por repeticiones se puede cronometrar | `targetReps` + `tempo` (texto libre, opcional) | Un formato de tempo validado (p. ej. `3-1-1-0`) y obligatorio, o una duración por repetición |
| Descanso entre series | `restSeconds` por ejercicio, opcional | Exigirlo |
| Descanso entre ejercicios | No existe por separado | Campo nuevo (o usar `restSeconds` del ejercicio anterior) |
| Descanso entre rondas de circuito | `restBetweenRoundsSeconds`, opcional | Exigirlo en circuitos |
| Ejercicios por cada lado | En desarrollo ("Por cada lado") | Dos cronómetros / dos bloques de reps y una transición "cambia de lado" |
| Tiempo de transición (preparar equipo, cambiar de estación) | No existe | Campo nuevo o un valor por defecto |
| Series por distancia y AMRAP | Existen | No se pueden cronometrar: excluirlas o pedir confirmación manual |

El builder debería indicar si un entrenamiento es "apto para modo inmersivo" y, si no, qué le falta.

## Funcionalidades de apoyo

- [ ] **Por cada lado** (en desarrollo): reps o tiempo por lado; en tiempo, dos cronómetros seguidos.
- [ ] Formato de tempo estructurado y validado.
- [ ] Descanso entre ejercicios y tiempo de transición.
- [ ] Indicador "apto para modo inmersivo" en el builder.

## Consideraciones técnicas

- **Voz:** texto a voz (`expo-speech` en móvil, Web Speech API en web) y sonidos cortos (cuenta regresiva 3-2-1, beep por repetición).
- **Música:** bajar el volumen de la música mientras habla la guía (ducking). En Android es posible; en web no se puede controlar la música de otras apps.
- **Pantalla apagada:** la guía debe seguir con la pantalla bloqueada; en Android requiere servicio en primer plano. En web solo con la pantalla encendida (Wake Lock).
- **Control sin ver el teléfono:** botones de los audífonos (pausa, siguiente) mediante Media Session.
- **Prioridad:** la app móvil es el destino natural; la web sería secundaria.

## Preguntas abiertas

1. ¿Al terminar las repeticiones la guía avanza sola o espera confirmación (botón de audífonos o toque)?
2. ¿Se registra lo realmente hecho (reps, peso) durante la sesión o al final?
3. ¿Qué dice la voz en cada momento y con qué detalle (peso, notas del coach, número de serie)?
4. ¿Móvil primero, o también web desde el inicio?
5. ¿Es una función limitada (flag) mientras se prueba?
