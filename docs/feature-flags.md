# Feature flags por usuario

Permiten ocultar funciones que aún no están listas y activarlas solo para un conjunto de usuarios (p. ej. el dueño, para seguir probando). No hay migración de BD: la allowlist vive en variables de entorno de la API (en Railway, cambiarlas redespliega).

## Variables

Formato: lista separada por comas de **correos o ids de usuario** (sin distinguir mayúsculas). `*` la activa para todos.

| Variable | Clave | Qué controla |
|---|---|---|
| `FEATURE_EVALUATION_USERS` | `evaluation` | Entrenamientos, asignados e historial de categoría "evaluación" y su registro de series. Sin el flag solo existe "entrenamiento". |
| `FEATURE_PROGRESS_USERS` | `progress` | Vista Progreso (PRs/RM) y su entrada del menú. Requiere además `evaluation`. |
| `FEATURE_AI_GENERATOR_USERS` | `ai_generator` | Generador de rutinas con IA. |
| `FEATURE_TEAM_APPEARANCE_USERS` | `team_appearance` | Edición de la apariencia del equipo (logo y color). |
| `FEATURE_SHARE_LINKS_USERS` | `share_links` | Crear enlaces para compartir rutinas. |
| `FEATURE_SCHEDULED_SESSIONS_USERS` | `scheduled_sessions` | Programar un asignado para una fecha futura (opción "Programar fecha"). Sin el flag solo se asigna "Ahora". Los programados ya creados siguen visibles y funcionando. |
| `FEATURE_GROUPS_USERS` | `groups` | Grupos de atletas dentro de Equipo (crear, agregar y quitar miembros). |
| `FEATURE_ALL_USERS` | todas | Atajo: activa todas las claves para esos usuarios. |

Ejemplo para el dueño: `FEATURE_ALL_USERS=dueno@ejemplo.com`.

Por defecto (sin variables) **todas las claves están apagadas para todos**, incluidos los usuarios existentes.

## Cómo funciona

- Registro central: `apps/api/src/lib/features.ts` (`FEATURES`, `hasFeature`, `assertFeature`).
- `features.mine` (tRPC) devuelve las claves activas del usuario; la web las consume con `useFeature('evaluation')` / `useFeatures()` / `<FeatureGate>` (`apps/web/src/lib/features.tsx`). Mientras carga, o si falla, cuenta como NO activo.
- La API rechaza con `FORBIDDEN` aunque la UI esté oculta. Los datos existentes no se borran: solo quedan ocultos.

## Qué se oculta / bloquea sin el flag

- `evaluation`: `routines.create` (categoría evaluation), `duplicate/get/updateContent/rename/delete` de rutinas de evaluación, `sessions.create` y todas las operaciones sobre sesiones de evaluación (ver, activar, registrar/editar series, completar, cancelar) lanzan `FORBIDDEN`. `routines.list`, `sessions.list`, `sessions.myList` y `sessions.myPending` filtran la evaluación (la app móvil recibe las mismas formas de respuesta).
- `progress`: todo el router `rms.*` (`FORBIDDEN`). `sessions.athleteRms` no se bloquea: lo usa el entrenamiento con % RM.
- `ai_generator`: `routines.aiAvailable` devuelve `false` y `routines.generateWithAI` es `FORBIDDEN`. Se conservan las allowlists anteriores `AI_ROUTINES_USERS` / `AI_ROUTINES_TEAM_IDS` (ver `ia-generacion-rutinas.md`) como vía alterna.
- `team_appearance`: `teams.updateBranding` es `FORBIDDEN`. La ruta `/teams/[teamId]/apariencia` ya redirige a Equipo. El `TeamThemeApplicator` **no** se condiciona al flag: así los atletas siguen viendo el tema que un entrenador con flag ya configuró, y un equipo sin tema usa el tema por defecto.
- `scheduled_sessions`: `sessions.create` con `scheduledDate` es `FORBIDDEN`; desaparece la sección "Cuándo" en Asignar. Los programados existentes, su listado y el inicio por el atleta no cambian.
- `groups`: todo el router `groups.*` es `FORBIDDEN` y la sección Grupos desaparece de Equipo. Los datos existentes no se borran.
- `share_links`: `share.createLink` es `FORBIDDEN` y desaparece la opción "Invitado" en Nueva sesión. Los enlaces ya creados siguen funcionando: `/r/[code]`, `share.preview/start/workout/recordSet/complete/claim`, y su gestión (`share.forRoutine/listForTeam/attendance/revokeLink` y `/rutinas/enlace/[routineId]`).

## Agregar una función nueva

1. Añadir la clave a `FEATURES` en `apps/api/src/lib/features.ts` (y dependencias en `REQUIRES` si aplica).
2. Proteger los endpoints con `featureProcedure("clave")` o `assertFeature(ctx.session.user, "clave")`.
3. Ocultar la UI con `useFeature("clave")` o `<FeatureGate>`.
4. Documentar la variable `FEATURE_<CLAVE>_USERS` aquí y en `apps/api/.env.example`.
