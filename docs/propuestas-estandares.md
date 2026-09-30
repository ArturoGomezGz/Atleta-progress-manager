# Propuestas de estándares — bandeja de entrada

Cada corrida de la Routine "Atleta - revisión diaria de estándares de
calidad" agrega una sección nueva abajo, más reciente arriba. Cada entrada
es la salida del subagente `software-standards-agent`
(`.claude/agents/software-standards-agent.md`) analizando
`.quality-reports/*.json` contra `docs/estandares-calidad.md`.

Esto es una propuesta, nunca un fix aplicado. Si algo de aquí se implementa,
bórralo de este archivo en el mismo commit que lo resuelve.

---

## 2026-09-30

**Resultado de esta corrida:** 15 hallazgos en `.quality-reports/*.json`, 14
descartados por el `software-standards-agent`, 1 escalado pero **pendiente de
decisión humana** — no se creó ninguna rama `standards-fix/*` ni PR porque el
único hallazgo accionable requiere aprobar primero una herramienta de testing
para el monorepo (hoy no hay ningún test ni test runner configurado en
ninguno de los `package.json`).

### P1 (pendiente de decisión humana): sin tests sobre autorización/aislamiento por equipo

**Archivos:** `apps/api/src/routers/teams.ts` (`assertMember`, `assertCoach`,
`assertAthleteInTeam`), `apps/api/src/trpc.ts` (`protectedProcedure`),
`apps/api/src/routers/share.ts` (`claim`, líneas 574-695).

**Problema:** no existe ningún archivo `.test`/`.spec` en el monorepo ni
dependencia `vitest`/`jest`. El código de autorización es correcto hoy, pero
nada detectaría una regresión futura (p. ej. que `assertCoach` se afloje al
agregar un rol nuevo, o que se pierda la condición `claimedBy IS NULL` en
`share.claim` y dos personas reclamen el mismo entrenamiento de invitado).

**Decisión humana requerida antes de implementar:** qué test runner adoptar
para `apps/api` (el agente propone `vitest`) y si se acepta agregarlo como
devDependency nueva del paquete. Una vez aprobado, el fix es:

1. Agregar `vitest` a `apps/api/package.json` (`"test": "vitest run"`) y un
   script equivalente en el `package.json` raíz.
2. `apps/api/src/routers/teams.test.ts`: mockear `@atleta/db/client` y
   probar que `assertMember` lanza `FORBIDDEN` sin membresía y la devuelve
   con fila; `assertCoach` lanza `FORBIDDEN` para `role: "athlete"` y para
   ausencia de fila (no `TypeError`); `assertAthleteInTeam` lanza
   `NOT_FOUND` (no `FORBIDDEN`) sin fila, según el comentario de la línea 201.
3. `apps/api/src/trpc.test.ts`: con `ctx.session = null`, un procedimiento
   con `protectedProcedure` lanza `UNAUTHORIZED`.
4. `share.claim` queda para una segunda rama con Postgres real (su garantía
   vive en el `WHERE` de SQL, un mock no la prueba).

### Descartados en esta corrida

- `error-flow-audit` `rms.ts:37` y `ai-routines.ts:211` (los dos "high"): falsos
  positivos — el `!` de TypeScript es innecesario para runtime, el `set`/chequeo
  previo ya garantiza el valor.
- `logging-audit`/`error-flow-audit` en `index.ts:11,15,61,62`: riesgo trivial,
  son logs de arranque del proceso antes de que exista el logger de Fastify
  por request.
- `logging-audit` `auth.ts:23,25`: no escalar — el log completo con token solo
  corre fuera de producción (intencional para dev local); el único riesgo real
  es que producción corra sin `NODE_ENV=production`, que es un tema de
  configuración de deploy, no de código.
- Los otros 5 hallazgos de `unit-test-gap-finder`: agrupados en el P1 de
  arriba (mismo problema de fondo: cero tests, cero runner).

### Nota para quien mantiene `docs/estandares-calidad.md`

La doc quedó desactualizada en tres puntos:
- Categoría 1 cita `sessions.ts:458-491` con `session!.teamId`; ya no existe
  ninguna aserción `!.` en `sessions.ts`.
- Categoría 2 dice que `index.ts:47` responde `String(err)`; hoy responde
  `{ error, requestId }` y loguea con `req.log.error` — ya resuelto.
- Categoría 4 (sin rate limiting en `share.preview`) sigue vigente y es el
  riesgo abierto más serio de la superficie pública, pero no lo detecta
  ningún agente automático (no es un patrón de regex) y por eso no salió en
  esta corrida.

---
