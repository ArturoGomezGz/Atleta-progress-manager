# Propuestas de estándares — bandeja de entrada

Cada corrida de la Routine "Atleta - revisión diaria de estándares de
calidad" agrega una sección nueva abajo, más reciente arriba. Cada entrada
es la salida del subagente `software-standards-agent`
(`.claude/agents/software-standards-agent.md`) analizando
`.quality-reports/*.json` contra `docs/estandares-calidad.md`.

Esto es una propuesta, nunca un fix aplicado. Si algo de aquí se implementa,
bórralo de este archivo en el mismo commit que lo resuelve.

---

## 2026-10-02

**Resultado de esta corrida:** 22 hallazgos en `.quality-reports/*.json` (10
"high", 12 "medium"), 16 descartados por el `software-standards-agent`, 6
reales pero con la misma causa de fondo ya registrada el 2026-09-30 (sin
infraestructura de tests), y 2 riesgos adicionales identificados fuera de lo
que detectan los agentes automáticos. **No se creó ninguna rama
`standards-fix/*` ni PR** — ningún hallazgo de hoy es un fix mecánico
independiente de una decisión humana.

### P1 (pendiente de decisión humana, repetido desde 2026-09-30): sin tests sobre autorización/aislamiento por equipo

**Archivos:** `apps/api/src/routers/teams.ts` (`assertMember`, `assertCoach`,
`assertAthleteInTeam`, líneas 185-210), `apps/api/src/routers/sessions.ts`,
`apps/api/src/routers/rms.ts`, `apps/api/src/trpc.ts`,
`apps/api/src/services/report-trigger.ts`, `apps/api/src/routers/ai-reports.ts`.

**Problema:** sigue sin existir ningún framework de pruebas en el monorepo
(ni en el `package.json` raíz ni en `apps/api/package.json`). Ejemplo
concreto del riesgo: si a `assertAthleteInTeam` se le cae el filtro
`eq(teamMember.teamId, teamId)`, un coach podría ver o modificar los RMs de
un atleta de otro equipo vía `rms.setManual`/`rms.listByAthlete`, y nada lo
detectaría hoy.

**Decisión humana requerida antes de implementar:** runner (`vitest` es lo
natural dado el stack ESM/TS) y estrategia de base de datos para el test
(Postgres efímero vía testcontainers/CI, que sí prueba el `WHERE` real, vs.
un `db` mockeado, que no detectaría el bug del ejemplo porque vive en el
`WHERE` de SQL) y si estas pruebas bloquean el merge en
`.github/workflows/quality-agents.yml`. Cobertura mínima sugerida una vez
decidido: `assertMember` lanza `FORBIDDEN` sin membresía; `assertCoach` lanza
`FORBIDDEN` para `role: "athlete"`; `assertAthleteInTeam` lanza `NOT_FOUND`
si el atleta es de otro equipo y acepta un coach con `selfAthlete=true`.
Después, una segunda rama para `share.claim` (no está en
`critical-targets.json`, pero el estándar lo menciona expresamente).

**Nota operativa:** estos 6 hallazgos de `unit-test-gap-finder` van a seguir
saliendo idénticos cada día mientras P1 no se resuelva; no son una
regresión nueva.

### P2 (pendiente de decisión humana, nuevo hoy): contraseña por defecto predecible en `reset-password.ts`

**Archivo:** `apps/api/src/reset-password.ts:8` —
`const DEFAULT_PASSWORD = "changeMe123"`.

**Problema:** si el script de admin se corre sin pasar contraseña, la cuenta
queda con un valor fijo e igual para todas las cuentas, conocido porque está
en el repo. Nada obliga a cambiarlo, solo se sugiere. Mientras no se cambie,
cualquiera que conozca el email de la cuenta puede entrar con ese valor y
ver datos personales e historial de rendimiento del atleta.

**Por qué no se escaló como fix directo:** el comentario de la línea 2 del
archivo indica que la contraseña genérica es una decisión de diseño del
flujo de soporte, así que cambiarla requiere confirmar esa intención.
**Propuesta a decidir:** generar un valor aleatorio por ejecución (p. ej.
`randomBytes(9).toString("base64url")`) en vez del literal fijo, impreso
igual que hoy; opcionalmente marcar la cuenta para forzar el cambio en el
siguiente login.

### P3 (pendiente de decisión humana, sigue vigente desde 2026-09-30): sin rate limiting en `share.preview`

**Archivo:** `apps/api/src/routers/share.ts:402`.

Sigue siendo el riesgo abierto más serio de la superficie pública y
tampoco lo detecta ningún agente automático (no es un patrón de regex). El
riesgo de enumerar códigos de 8 caracteres en `[A-Z2-9]` (~1.8×10^12
combinaciones) es bajo en la práctica, pero cada `preview` corre un join de
4 tablas más `buildProgress` sin autenticación, así que el riesgo real es de
costo/DoS barato, no de adivinar códigos. Requiere decidir entre
`@fastify/rate-limit` (dependencia nueva), un limitador en memoria por IP, o
no hacer nada, y fijar los umbrales.

### Descartados en esta corrida

- `rms.ts:37` (`exerciseMap.get(...)!.history`, "high"): falso positivo —
  el `set` de la línea anterior ya garantiza la clave antes del `get`, y el
  procedimiento corre después de `assertMember`/`assertAthleteInTeam`, no
  antes.
- `ai-routines.ts:211` (`ctx.allowedEquipment!.has(...)`, "high"): falso
  positivo — el `!ctx.allowedEquipment ||` de la misma expresión ya cubre el
  caso nulo; el `!` es solo para TypeScript dentro del closure.
- `index.ts:61` (logging "high" + error-flow "medium"), `.catch` de
  `main()`: es el fallo de arranque del proceso, no hay request ni ID de
  correlación posible; registrar y `exit(1)` es correcto.
- `index.ts:11`, `index.ts:15` ("medium"): logs de arranque/migraciones
  antes de que exista el logger de Fastify; sin riesgo real.
- `reset-password.ts:13,22,32,39,43,44` (resto de hallazgos de logging y
  error-flow en este archivo): es un CLI de admin, la consola es su salida
  normal; el único riesgo real de este archivo es P2.
- `auth.ts:23`: ya enmascara el email y no registra el enlace completo;
  correcto.
- `auth.ts:25`: registra el enlace con token completo, pero solo cuando
  `NODE_ENV !== "production"`, y el `Dockerfile` fija
  `NODE_ENV=production` en todos los despliegues de Railway
  (`docs/deploy.md:65`). Mejora opcional (no escalada): invertir a
  `=== "development"` para que un `NODE_ENV` mal configurado nunca exponga
  tokens, aunque eso cambiaría el comportamiento local si ahí no está
  definido.

### Nota para quien mantiene `docs/estandares-calidad.md`

Las dos correcciones señaladas el 2026-09-30 siguen confirmadas: Categoría 1
(`sessions.ts`, antes `session!.teamId`) ya no tiene ningún `!.` en ese
archivo, y Categoría 2 (`index.ts:47`) ya responde
`{ error: "Internal Server Error", requestId }` con `req.log.error` en vez
de `String(err)`. Conviene actualizar esas secciones para que no se sigan
priorizando como riesgos vigentes.

### Sugerencia para el pipeline de agentes mecánicos (no es un fix de app)

- `error-flow-audit` marca cualquier `!.` como "high" aunque no esté cerca
  de una autorización; podría limitar esa severidad al patrón real de la
  categoría 1 (un `!` antes de un `assert*` en el mismo procedimiento).
- `logging-audit` podría excluir o bajar la severidad de scripts de CLI
  (`reset-password.ts`, migraciones): hoy son 7 de sus 12 hallazgos.

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
