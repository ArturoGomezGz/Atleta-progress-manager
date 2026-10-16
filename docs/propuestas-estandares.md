# Propuestas de estándares — bandeja de entrada

Cada corrida de la Routine "Atleta - revisión diaria de estándares de
calidad" agrega una sección nueva abajo, más reciente arriba. Cada entrada
es la salida del subagente `software-standards-agent`
(`.claude/agents/software-standards-agent.md`) analizando
`.quality-reports/*.json` contra `docs/estandares-calidad.md`.

Esto es una propuesta, nunca un fix aplicado. Si algo de aquí se implementa,
bórralo de este archivo en el mismo commit que lo resuelve.

---

## 2026-10-16

Revisión sobre `master` @ `61e187f`. 29 hallazgos mecánicos frescos
(`.quality-reports/*.json`, generados 06:17 UTC). El `software-standards-agent`
descartó los 23 de `logging-audit`/`error-flow-audit` como falsos positivos
o fuera de la ruta de un request (scripts de CLI, arranque del proceso), y
encontró 3 hallazgos reales. 2 de los 3 se implementaron y tienen PR abierto
hacia `master` (no mergeado, pendiente de revisión):

- PR [#75](https://github.com/ArturoGomezGz/Atleta-progress-manager/pull/75) (`standards-fix/share-critical-target`) — agrega `apps/api/src/routers/share.ts` a `critical-targets.json`, para que `unit-test-gap-finder` deje de ignorarlo (era la única superficie pública sin autenticación fuera de la lista de archivos críticos).
- PR [#76](https://github.com/ArturoGomezGz/Atleta-progress-manager/pull/76) (`standards-fix/share-preview-rate-limit`) — rate limit por IP en `share.preview`/`share.start` (antes servían como oráculo público sin límite). Incluye su propia decisión pendiente: si activar `trustProxy` en Fastify (ver el PR).

### Pendiente de decisión humana (sin rama ni PR): tests sobre autorización multi-tenant

**Archivo:** `apps/api/src/routers/teams.ts:185-210` — `assertMember`,
`assertCoach`, `assertAthleteInTeam`. Son la única barrera que separa los
datos de un equipo de otro en todo el API, y no tienen ningún test. Una
regresión futura (reordenar un `and(...)` de un `where`, relajar un
chequeo al "optimizar" una función) podría filtrar historial de
rendimiento o PII de un equipo a un usuario de otro equipo sin que nada lo
detecte hoy.

El developer-agent asignado a este hallazgo se detuvo antes de escribir
código: el repo no tiene infraestructura de Postgres de test (no hay
`TEST_DATABASE_URL`, `.env.test`, ni CI que corra `pnpm test` contra una
base de datos), y los helpers de `@atleta/db` se conectan a Postgres real
en el momento del import. Hay dos caminos y ninguno es trivial:

1. **Postgres real de test** (local, contenedor en CI, o algo como
   `@electric-sql/pglite` para evitar Docker) — prueba el `where` SQL real,
   que es justo donde vive el riesgo.
2. **Inyectar `db` como dependencia** (`assertMember(userId, teamId, database = db)`,
   sin romper la firma pública) — más simple, pero con un `db` falso no se
   detecta una regresión en el filtro `and(...)`/`or(...)` del `where`
   mismo, solo en la lógica de `FORBIDDEN`/`NOT_FOUND` alrededor de él.

Un hallazgo hermano sobre `apps/api/src/routers/share.ts` (`claim`, 4 casos
de test: reclamo duplicado, reclamo concurrente con `CONFLICT`, caída en
equipo personal) tiene el mismo bloqueo exacto y queda pendiente de la
misma decisión. En cuanto alguien del equipo elija una opción, ambos
hallazgos se pueden implementar juntos con el mismo enfoque.

---
