# Rutinas compartidas por enlace (invitados)

Un entrenador comparte una rutina con un enlace o un código corto. Cualquier
persona puede hacerla **sin cuenta**; la cuenta se pide al terminar, cuando ya
hay algo que conservar. Es el canal de adquisición de la plataforma: el
entrenador invita, la persona entrena y solo después decide registrarse.

---

## Flujo

```
Coach                        Invitado                        Cuenta nueva
─────                        ────────                        ────────────
Plantilla → Compartir
  └── código ABCD2345
      /r/ABCD2345  ──────►  Vista previa (videos)
                            Empezar rutina
                              └── token en localStorage
                            Ejecuta y registra series
                            Termina
                              └── "Crea tu cuenta"  ──────►  /register
                                                             verificación
                                                             /reclamar
                                                               └── el entrenamiento
                                                                   pasa a su historial
```

| Paso | Ruta web | Requiere sesión |
|---|---|---|
| Vista previa y ejecución | `/r/<code>` | No |
| Entrada manual del código | `/r` | No |
| Guardar en la cuenta | `/reclamar` | Sí |

El entrenador genera el enlace desde dos sitios: **Nueva sesión**, marcando
*Invitado* junto a los atletas, o el botón **Compartir** de la plantilla.

El middleware deja `/r` fuera de la autenticación; `/reclamar` sí la exige, así
que quien llega sin sesión pasa por login y vuelve.

`/trpc` también queda fuera del middleware: cada procedimiento autoriza por su
cuenta, y si pasara por ahí las llamadas del invitado se redirigirían al login.
De paso, las de cualquier usuario dejan de pagar una consulta de sesión extra
por cada petición de datos.

---

## Identidad del invitado

Al pulsar *Empezar rutina* el servidor crea un `guest_workout` y devuelve un
`token` de 48 caracteres hexadecimales. Ese token:

- es la **única credencial** del invitado mientras no tiene cuenta;
- se guarda en `localStorage` (`atleta.guestWorkout`) y **nunca viaja por URL ni
  por correo**, para que no se filtre por el `Referer` ni por el enlace de
  verificación;
- permite cerrar la pestaña y retomar la rutina donde quedó;
- solo sirve en el navegador que empezó la rutina. Si la persona verifica su
  correo en otro dispositivo, `/reclamar` lo explica en vez de fallar.

El código del enlace (8 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sin
`0/O/1/I`) es público y puede dictarse por teléfono.

---

## Snapshot

`guest_workout.content` copia la rutina al momento de empezar, igual que
`training_session.content`. El invitado termina lo que empezó aunque el coach
edite la plantilla mientras tanto.

Como todavía no existen filas de `session_exercise` / `session_set_target`, cada
serie se identifica por su posición en el contenido aplanado
(`exercise_order`) y su número (`set_number`). Es la misma numeración que usa
`flattenContent` para una sesión normal — de ahí que la conversión al reclamar
sea directa.

---

## Reclamar: de anónimo a historial

`share.claim` convierte el entrenamiento en datos de primera clase, dentro de una
transacción:

1. `training_session` (status `completed`, con el snapshot y la fecha original)
2. `session_exercise` + `session_set_target` desde el mismo contenido
3. `athlete_session` del usuario, ya completada
4. `set_record` por cada serie del invitado, ligada a su objetivo planeado
5. `guest_workout` pasa a `claimed`

A partir de ahí el entrenamiento se lee por el camino normal
(`sessions.myProgress`): el usuario nuevo abre la app con su primer
entrenamiento ya en el historial.

### ¿En qué equipo queda?

| Situación | Resultado |
|---|---|
| Ya es miembro del equipo | Se guarda ahí |
| Hay cupo de atletas | Entra al equipo como atleta y se guarda ahí |
| El equipo llegó a `max_athletes` | Se guarda en su **espacio personal** (equipo propio con `self_athlete`), creado si no existe |

El límite de atletas del plan se respeta igual que en las invitaciones de
equipo: compartir una rutina no regala cupos. Pero el entrenamiento nunca se
pierde — en el peor caso la persona se queda con su propio espacio, que es lo
mismo que obtendría creando un equipo por su cuenta.

---

## Límites y abuso

Un enlace público es una superficie de escritura sin sesión, así que está acotada:

- `share.recordSet` solo acepta series **que existen en el snapshot**: una
  posición o un número de serie fuera de la rutina se rechaza. El volumen de
  datos por entrenamiento queda acotado por lo que planeó el coach.
- Repetir una serie la actualiza en vez de duplicarla (reintentos seguros).
- Terminado el entrenamiento no se aceptan más series.
- Máximo 300 entrenamientos por enlace y hora (`MAX_STARTS_PER_HOUR`).
- Solo rutinas de **entrenamiento**: las de evaluación las registra el coach en
  persona.
- El coach puede desactivar el enlace cuando quiera (`revoked_at`); los
  entrenamientos ya hechos se conservan.

---

## Tablas

| Tabla | Descripción |
|---|---|
| `routine_share` | Enlace vigente de una rutina: código, quién lo creó, si está revocado |
| `guest_workout` | Ejecución anónima: token, snapshot, estado y a qué cuenta se reclamó |
| `guest_set_record` | Serie registrada por el invitado (`exercise_order` + `set_number`) |

---

## Procedimientos

| Procedimiento | Sesión | Descripción |
|---|---|---|
| `share.forRoutine` | Coach | Enlace activo y cuántos empezaron / terminaron / se registraron |
| `share.createLink` | Coach | Crea el enlace (o devuelve el vigente) |
| `share.revokeLink` | Coach | Desactiva el enlace |
| `share.preview` | — | Rutina, ejercicios y quién la comparte, antes de empezar |
| `share.start` | — | Crea el entrenamiento y devuelve el token |
| `share.workout` | — | Estado del entrenamiento, con el formato de `sessions.myProgress` |
| `share.recordSet` | — | Registra (o corrige) una serie |
| `share.complete` | — | Cierra el entrenamiento y devuelve el resumen |
| `share.claim` | Sí | Convierte el entrenamiento en una sesión de la cuenta |

---

## Una sola pantalla de ejecución

El invitado y el atleta con cuenta ven **la misma UI**:
`apps/web/src/components/workout-runner.tsx` (vista previa, ejecución,
descansos, cronómetros e historial) no sabe de dónde vienen los datos. Cada
pantalla le pasa sus acciones:

| | Atleta | Invitado |
|---|---|---|
| Datos | `sessions.myProgress` | `share.workout` |
| Guardar serie | `sessions.recordSet` | `share.recordSet` |
| Al terminar | `sessions.completeMySession` | `share.complete` + invitación a registrarse |

`share.workout` y `share.preview` devuelven la forma exacta de
`sessions.myProgress`, con ids derivados de la posición (`e{order}`,
`e{order}s{setNumber}`) en lugar de ids de tabla.
