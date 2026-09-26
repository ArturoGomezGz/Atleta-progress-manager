# Estándares de calidad — fuente de verdad

Este documento es la base de conocimiento para el futuro **agente experto en
estándares de software**. Su trabajo no será corregir código: será leer
inputs (por ahora, los reportes de `pnpm qa:agents`, ver `docs/quality-agents.md`),
cruzarlos contra las categorías de este documento, priorizar según el riesgo
real para Atleta, y entregarle al desarrollador una propuesta de solución
concreta — nunca un commit propio.

Por eso cada categoría lleva un **por qué** específico de esta aplicación, no
un principio genérico de ingeniería. Los agentes actuales (`logging-audit`,
`error-flow-audit`, `unit-test-gap-finder`) detectan patrones por regex sin
ese contexto; este documento es lo que le falta al pipeline para razonar en
vez de solo contar coincidencias.

---

## Qué hace única a Atleta (y por qué determina las prioridades)

- **Tipo de app**: SaaS B2B multi-tenant por equipos, con dos roles
  (`coach`/`athlete`) cuya única barrera es la verificación de rol dentro de
  cada procedimiento tRPC — no hay un gateway central que la imponga.
- **Datos que almacena**: PII (nombre, email), credenciales de sesión
  (`better-auth`, cookies `httpOnly`), tokens anónimos de invitado
  (`localStorage`), historial de rendimiento físico de personas reales, y a
  corto plazo datos de facturación (`team_subscription`, IDs de cliente/
  suscripción de LemonSqueezy — ver `docs/monetizacion.md`).
- **Procesos críticos**: sesión de evaluación en tiempo real con edición
  concurrente y no lineal (el coach agrega/invalida/elimina series sin flujo
  fijo — es una decisión de diseño, no un descuido); reclamo de entrenamiento
  de invitado → cuenta (fusiona datos anónimos con una cuenta real); reportes
  y autofill generados con IA sobre datos del catálogo.
- **Superficie pública sin autenticación**: los procedimientos `share.*`
  (`preview`, `start`, `workout`, `recordSet`, `complete`) son la única parte
  del API abierta a cualquiera, protegidos solo por un código de 8
  caracteres o un token de invitado — ver `docs/rutinas-compartidas.md`.

---

## Categorías priorizadas

### 1. Errores no controlados en rutas de autorización — **crítico**

`assertCoach` / `assertMember` (`apps/api/src/routers/teams.ts`) son la única
barrera entre "cualquier usuario autenticado" y los datos de otro equipo. Un
crash *antes* de llegar al assert no es solo un bug de UX: es una ruta sin
comportamiento garantizado (¿niega acceso? ¿revienta con 500?) en el único
punto que separa equipos entre sí.

**Hallazgo real** — `apps/api/src/routers/sessions.ts:458-491`:
```ts
const [session] = await db.select().from(trainingSession).where(eq(trainingSession.id, as!.sessionId)).limit(1)
await assertCoach(ctx.session.user.id, session!.teamId)
```
Si `session` no existe (fila inconsistente o borrada), `session!.teamId`
lanza un `TypeError` sin control en vez de un `NOT_FOUND`/`FORBIDDEN` — y
esto ocurre *antes* de la verificación de rol. `sessions.ts` ya está en
`scripts/quality-agents/config/critical-targets.json`: el agente debe tratar
sus hallazgos como severidad alta por defecto, no como "uno más entre N
console.log".

### 2. Errores crudos expuestos en la superficie de autenticación

`apps/api/src/index.ts:47` — el handler de `/api/auth/*` responde
`reply.status(500).send({ error: String(err) })` ante cualquier excepción no
controlada. Es el endpoint de login/signup/reset-password: el primero que se
prueba desde fuera. Un error de la librería o de Postgres se serializa tal
cual hacia el cliente.

### 3. Cobertura de pruebas nula sobre autorización y dinero

0 archivos `.test`/`.spec` en todo el monorepo. `unit-test-gap-finder` ya lo
señala mecánicamente; el porqué priorizado aquí es:
- `assertCoach`/`assertMember` — toda la separación multi-tenant depende de
  dos funciones sin un solo test.
- El flujo de reclamo de invitado (`share.claim`) — fusiona datos anónimos
  con una cuenta autenticada; un bug ahí filtra o duplica historial de otra
  persona.
- Cuando aterrice `team_subscription`, el enforcement de límites de atletas
  (free vs. pro) será lógica de facturación sin ninguna red de seguridad.

### 4. Enumeración del código de rutina compartida

`share.preview` y `share.start` reciben el código de 8 caracteres
(`codeSchema`). `start` tiene throttling por enlace (`MAX_STARTS_PER_HOUR`),
pero **`preview` no tiene rate limiting** — es una query pública que confirma
si un código existe y expone nombre de rutina/coach. Eso permite enumerar
códigos válidos de cualquier equipo sin disparar nunca el límite de `start`.
No es un problema de "falta manejo de errores": es un gap de rate limiting
en la única superficie sin auth de la app.

### 5. Confidencialidad del token de invitado en `localStorage`

`apps/web/src/lib/guest-workout.ts` guarda el token del entrenamiento de
invitado (24 bytes aleatorios) en `localStorage`, sin expiración. Es una
decisión de diseño documentada y razonable — pero como ese flujo es el canal
de adquisición de usuarios nuevos ("primero entrenan, después decidan"), vale
la pena que el estándar cubra explícitamente: nunca loguear el token
completo, y cualquier future feature que serialice `StoredGuestWorkout` debe
mantener esa misma disciplina.

### 6. Logging sin correlación de request

`console.*` detectado en 6 archivos, mezclado de forma inconsistente con el
logger estructurado de Fastify (`req.log`, ver `index.ts`). Dado que el
flujo de sesión permite "múltiples atletas, múltiples coaches editando sin
flujo lineal" por diseño, reconstruir qué pasó (p. ej. "se perdió una serie")
sin un `requestId` trazable de extremo a extremo es prácticamente imposible.

### 7. Fallos silenciosos de proveedores de IA

`GEMINI_API_KEY`/`OPENAI_API_KEY` son opcionales en producción
(`docs/deploy.md`). `docs/ia-providers.md` ya documenta el riesgo con
palabras propias del equipo: el autofill "devuelve UUIDs que deben coincidir
exactamente... un error produce datos inválidos silenciosamente". Ese riesgo
está identificado en la documentación pero no cubierto por ningún agente de
calidad — `ai-reports.ts` y el autofill de `exercises.ts` están en
`critical-targets.json` sin embargo.

---

## Cómo se alimenta el agente (inputs)

- **Hoy**: los JSON de `.quality-reports/*.json`, generados por
  `pnpm qa:agents` y publicados por `.github/workflows/quality-agents.yml`
  (`pull_request`, `workflow_dispatch`, cron diario `0 8 * * *`).
- El agente no debe priorizar por volumen de hallazgos; debe cruzar cada uno
  contra las categorías de arriba y contra si el archivo afectado está en
  `critical-targets.json`.
- **Salida esperada**: por cada hallazgo relevante, una propuesta (qué
  cambiar y por qué) entregada al desarrollador — nunca una corrección
  aplicada directamente por el agente.

## Estado

El agente vive como subagente en
`.claude/agents/software-standards-agent.md`. No tiene acceso de
`Edit`/`Write` sobre código de la app a propósito, y **tampoco entrega el
resultado él mismo** — solo lee, corre los agentes mecánicos, y devuelve la
propuesta como texto. Entregarla es trabajo de quien lo invoca.

Se dispara con una Routine de Claude Code (no toca `quality-agents.yml`):
corre diario a medianoche hora Ciudad de México, en una sesión nueva que:
1. Actualiza `master` y corre `pnpm qa:agents`.
2. Invoca a `software-standards-agent` para obtener la propuesta priorizada.
3. La entrega: issue/comentario de GitHub si esa sesión tiene las
   herramientas `mcp__github__*` disponibles; si no, la agrega a
   `docs/propuestas-estandares.md` y hace commit + push a la rama
   `standards-review` (nunca a `master`/`testing`, y nunca tocando código de
   la app).

La primera corrida de prueba confirmó que la sesión de la Routine **no
tenía** herramientas de GitHub disponibles — por eso existe el fallback de
archivo. `docs/propuestas-estandares.md` es la bandeja de entrada real hoy;
la entrega por GitHub es un mejor-esfuerzo que se usará si algún día la
Routine sí carga esos conectores.

## Pendiente de decidir

- Si vale la pena resolver que la Routine cargue conectores de GitHub (para
  que la entrega sea un issue en vez de un archivo), o si el archivo en
  `standards-review` es suficiente.
- Qué hacer con `standards-review` cuando se acumulen varias corridas: ¿se
  abre un PR hacia `master` de vez en cuando, o se revisa directo en la
  rama?
