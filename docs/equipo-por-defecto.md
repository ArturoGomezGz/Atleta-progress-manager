# Equipo por defecto

## Qué se crea

Un equipo llamado **"Mi equipo"** (`DEFAULT_TEAM_NAME` en `apps/api/src/services/team-setup.ts`) donde el usuario es coach y tiene el auto-entrenamiento activado (`team_member.self_athlete = true`). Así puede crear entrenamientos, asignárselos y verlos en "Hoy" sin invitar a nadie.

No se precrea ningún entrenamiento: el usuario arma el suyo y elige sus ejercicios. Al crear el equipo también se marca el onboarding del usuario como en curso ([onboarding.md](onboarding.md)), en la misma transacción.

## Plaza de atleta

El auto-entrenamiento ocupa una plaza de atleta (`team.max_athletes`, 1 por defecto): cuentan los miembros con `role = "athlete"` o `self_athlete = true` (`countAthletePlazas`). Con el equipo por defecto el usuario no puede invitar atletas hasta desactivarlo. Activarlo exige plaza libre; desactivarlo siempre se permite. Los equipos existentes que queden sobre el límite no se tocan.

## Cuándo

La mutación `teams.ensureDefault` la llama el dashboard (`/dashboard`) cuando `teams.list` viene vacío. Cubre registros con correo y con Google, y a usuarios existentes con 0 equipos (lo reciben la próxima vez que entran). Tras crearlo, el dashboard navega a `/teams/<id>/plantillas`.

Si la creación falla, el dashboard muestra el estado vacío de siempre (crear equipo propio / esperar invitación).

## Casos excluidos

- **Invitación (`/join/[token]`)**: el registro/login conserva `?redirect=/join/<token>`, así que el usuario no pasa por `/dashboard` antes de unirse. Si ya se unió, tiene membresía y `ensureDefault` no crea nada.
- **Invitado que reclama (`/reclamar`, `/r/*`)**: el dashboard no llama a `ensureDefault` si el navegador guarda un entrenamiento de invitado pendiente (`readGuestWorkout()`). Además, `share.claim` ya reutiliza un equipo coach con auto-entrenamiento como equipo personal.
- Usuarios con equipos: no cambian.

## Idempotencia

`ensureDefaultTeam` corre en una transacción con `pg_advisory_xact_lock` por usuario y solo crea si el usuario tiene 0 membresías. Doble clic, refresh o dos pestañas se serializan: la segunda ve la membresía de la primera. No requiere migración ni índice nuevo.

Nota: si el usuario elimina su único equipo, al volver al dashboard se le crea otro "Mi equipo".
