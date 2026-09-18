# Deploy

---

## Local (desarrollo)

Ver [setup.md](./setup.md) para el flujo completo. Resumen rápido:

```bash
docker compose up -d          # PostgreSQL
pnpm install                  # dependencias
pnpm db:generate              # genera migraciones
pnpm db:migrate               # aplica migraciones
pnpm dev:api                  # terminal 1 — API en :3001
pnpm dev:web                  # terminal 2 — Web en :3000
pnpm db:seed                  # terminal 3 — datos de ejemplo (API debe estar corriendo)
```

---

## Producción

### Servicios

| Componente | Plataforma | Notas |
|---|---|---|
| Base de datos | Railway (PostgreSQL plugin) | Gestionado por Railway |
| API (Fastify) | Railway | Usa el `Dockerfile` de `apps/api/` |
| Web (Next.js) | Vercel | Deploy automático desde `apps/web/` |

---

## Deploy de la base de datos en Railway

1. Crear un nuevo proyecto en [railway.app](https://railway.app)
2. **Add Service → Database → PostgreSQL**
3. Una vez creado, ir a la pestaña **Connect** del servicio PostgreSQL
4. Copiar la variable `DATABASE_URL` (formato `postgresql://...`)

---

## Deploy de la API en Railway

### Primera vez

1. En el mismo proyecto de Railway: **Add Service → GitHub Repo**
2. Seleccionar el repositorio `cmw-atleta`
3. En **Settings → Build**:
   - **Root Directory**: `/` (raíz del monorepo)
   - **Dockerfile Path**: `apps/api/Dockerfile`
4. En **Settings → Deploy**:
   - **Start Command**: dejar vacío (lo toma del `CMD` del Dockerfile)

### Variables de entorno en Railway

Ir a la pestaña **Variables** del servicio API y agregar:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Copiar del servicio PostgreSQL de Railway |
| `BETTER_AUTH_SECRET` | String aleatorio seguro (mín. 32 caracteres) |
| `BETTER_AUTH_URL` | URL pública del **web** (ej. `https://atleta.vercel.app`) — ver nota abajo |
| `WEB_URL` | URL pública del web (ej. `https://atleta.vercel.app`) |
| `PORT` | `3001` |
| `RESEND_API_KEY` | API key de Resend |
| `FROM_EMAIL` | Dirección de envío verificada (ej. `noreply@tudominio.com`) |
| `GOOGLE_CLIENT_ID` | *(Opcional)* Client ID del OAuth 2.0 de Google Cloud Console. Sin él, el login con Google se desactiva |
| `GOOGLE_CLIENT_SECRET` | *(Opcional)* Client Secret del OAuth 2.0 de Google Cloud Console |
| `SEED_DEMO_DATA` | `true` para sembrar cuentas de prueba + catálogo de ejercicios al arrancar (idempotente). `false` en producción real |
| `GEMINI_API_KEY` | *(Opcional)* Reportes de progreso con IA |
| `OPENAI_API_KEY` | *(Opcional)* Botón "Completar con IA" al crear ejercicios |

> **Videos:** ya no se usa Cloudflare Stream (se eliminaron `CF_ACCOUNT_ID` y `CF_STREAM_API_TOKEN`). Los ejercicios guardan el ID de un video de YouTube; no hay almacenamiento ni costo por video.

> **`BETTER_AUTH_URL` debe ser la URL del web, no de la API.** El web proxea `/api/auth/*` hacia la API. El estado OAuth se almacena en una cookie del dominio web — si el callback apunta directamente a la API (diferente dominio), la cookie no existe y Google devuelve `state_mismatch`. Apuntando al web, el callback pasa por el proxy y la cookie está disponible.

### Base de datos: primer despliegue con los scripts SQL

En `packages/db/sql/` hay 4 scripts **idempotentes** (se pueden ejecutar más de una vez sin duplicar nada), listos para pegar en Railway → servicio PostgreSQL → pestaña **Data → Query**, o para correr con `psql`:

| Orden | Archivo | Contenido |
|---|---|---|
| 1 | `01_schema.sql` | Esquema completo. Registra la migración en `drizzle.__drizzle_migrations`, así la API no intenta recrear las tablas al arrancar |
| 2 | `02_catalogs.sql` | Grupos musculares, músculos y equipamiento (incluye calistenia) |
| 3 | `03_accounts.sql` | Equipo **Neo** y cuentas de prueba verificadas (ver tabla abajo) |
| 4 | `04_exercises.sql` | Catálogo público de 638 ejercicios con video de YouTube (calistenia, gimnasio, halterofilia, movilidad, pilates…) de la cuenta del sistema `coach@atleta.com` + una rutina de ejemplo |

```bash
# Con psql y la DATABASE_URL pública de Railway (pestaña Connect del servicio PostgreSQL)
for f in packages/db/sql/0*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

**Cuentas de prueba** (cámbialas o bórralas antes de abrir la app al público):

| Correo | Contraseña | Rol en equipo Neo |
|---|---|---|
| `coach@atleta.com` | `12345678` | Sin equipo — cuenta del sistema, dueña del catálogo público de ejercicios |
| `arturogomezgz04@gmail.com` | `admin` | Coach (arma rutinas con los ejercicios públicos) |
| `tester@gmail.com` | `12345678` | Atleta |
| `abuela@gmail.com` | `12345678` | Atleta (perfil de pruebas de accesibilidad) |
| `nuevo.coach@atleta.com` | `12345678` | Coach — para probar la bienvenida a usuarios nuevos |
| `nuevo.atleta@atleta.com` | `12345678` | Atleta — para probar la bienvenida a usuarios nuevos |

> Si la base se sembró antes con otra cuenta como dueña de los ejercicios (el coach o `calixpert@gmail.com`), `04_exercises.sql` los transfiere a `coach@atleta.com` conservando sus IDs. Si existe la cuenta `calixpert@gmail.com`, `03_accounts.sql` la renombra a `coach@atleta.com`.

> Si una base anterior tenía la cuenta `chinita@gmail.com`, `03_accounts.sql` la renombra a `tester@gmail.com`.

> **`nuevo.coach@atleta.com` / `nuevo.atleta@atleta.com`:** `03_accounts.sql` corre en cada arranque de la API cuando `SEED_DEMO_DATA=true`, y para estas dos cuentas además borra su fila de `user_preferences` cada vez. Así siempre quedan como si nunca hubieran entrado a la app — sirven para ver la bienvenida a usuarios nuevos (ver `docs/onboarding-bienvenida.md`) las veces que haga falta en un PR environment, sin tener que registrar una cuenta nueva cada vez. No las uses para probar nada que dependa de preferencias persistentes.

Alternativa sin consola SQL: con `SEED_DEMO_DATA=true` la API ejecuta el migrador de Drizzle + los scripts 02–04 al arrancar.

**Regenerar los scripts** después de cambiar el schema o el dataset de ejercicios (`packages/db/data/calisthenics-exercises.json` y `packages/db/data/exercises/*.json`, uno por canal de YouTube):

```bash
pnpm --filter @atleta/db generate        # nueva migración en src/migrations
pnpm --filter @atleta/db build-sql       # valida el catálogo (nombres y videos únicos, músculos/equipamiento válidos) y reescribe packages/db/sql/*.sql
pnpm --filter @atleta/db verify-videos   # comprueba vía oEmbed que cada video exista y se pueda embeber
```

> ⚠️ La migración base `0000_youtube_baseline.sql` reemplaza al historial anterior (0000–0008). Está pensada para una **base de datos nueva**. No la apliques sobre la base del entorno `testing` anterior sin recrearla.

### Migraciones en producción

La API aplica las migraciones pendientes al arrancar. Para correrlas manualmente hay dos opciones:

**Opción A — Railway CLI (recomendado):**
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Correr migraciones apuntando a la BD de producción
railway run --service <nombre-servicio-api> pnpm db:migrate
```

**Opción B — Variable temporal:**
1. Agregar `DATABASE_URL` de producción a `packages/db/.env` localmente (no commitear)
2. Correr `pnpm db:migrate` desde local
3. Eliminar el valor de `packages/db/.env`

---

## Deploy del Web en Vercel

### Primera vez

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repositorio `cmw-atleta`
3. En la configuración del proyecto:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)

### Variables de entorno en Vercel

Ir a **Settings → Environment Variables** y agregar:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública de la API en Railway (ej. `https://atleta-api.railway.app`) |

---

## Flujo de actualizaciones

### Código

```
git push origin main
  │
  ├── Railway detecta el push → rebuild automático de la API
  └── Vercel detecta el push  → rebuild automático del Web
```

### Cambios de schema (migraciones)

Cada vez que se modifica `packages/db/src/schema/`:

```bash
# 1. Generar migración
pnpm db:generate

# 2. Commitear el archivo generado en packages/db/src/migrations/
git add packages/db/src/migrations/
git commit -m "migration: <descripcion>"

# 3. Aplicar en producción antes o después del deploy
railway run --service api pnpm db:migrate
```

> Aplicar la migración **antes** del deploy si es aditiva (nueva tabla, nueva columna nullable).
> Aplicar la migración **después** del deploy si elimina columnas que el código actual todavía usa.

---

---

## Configuración de Resend (email transaccional)

### Testing (sin dominio propio)
- Usar `FROM_EMAIL=onboarding@resend.dev`
- Solo puede enviar emails **al correo con el que te registraste en Resend**
- Suficiente para probar el flujo completo

### Producción (con dominio propio)
1. Entrar a [resend.com](https://resend.com) → **Domains → Add Domain**
2. Añadir los registros DNS que Resend indica (DKIM + SPF + DMARC) en tu proveedor de dominio
3. Verificar el dominio (puede tardar hasta 48h, normalmente minutos)
4. Crear una API key en **API Keys → Create API Key**
5. Configurar `FROM_EMAIL=noreply@tudominio.com` y `RESEND_API_KEY=re_xxxx` en Railway

---

## Configuración de Google OAuth

### Consideraciones por ambiente

Google OAuth requiere un **redirect URI registrado exacto**. Hay dos estrategias:

**Opción A — Un solo OAuth Client con múltiples URIs (más simple):**
- En Google Cloud Console → el mismo client → añadir URIs de testing y producción
- Las URIs deben apuntar al **web**, no a la API (ver nota en variables de entorno)

**Opción B — Un OAuth Client por ambiente (más limpio):**
- Client "atleta-testing" con la URI de testing
- Client "atleta-production" con la URI de producción
- Variables distintas por ambiente en Railway

### URIs a registrar

| Ambiente | URI de redirect |
|---|---|
| Local | `http://localhost:3000/api/auth/callback/google` |
| Testing | `https://web-testing-a80a.up.railway.app/api/auth/callback/google` |
| Producción | `https://<url-web-prod>/api/auth/callback/google` |

> La URI **siempre apunta al web**, no al API. El web proxea el callback a la API internamente.

### Modo test vs verificado

- **Modo test** (por defecto): solo pueden autenticarse los emails añadidos como "usuarios de prueba" en la pantalla de consentimiento. Gratuito e indefinido.
- **Modo producción**: cualquier cuenta de Google puede autenticarse. Requiere verificación de la app por Google (proceso de revisión). Necesario cuando se abre a usuarios reales.

Para solicitar verificación: Google Cloud Console → OAuth consent screen → **Publicar app**.

---

## Checklist de primer deploy a producción

### Infraestructura
- [ ] PostgreSQL creado en Railway y `DATABASE_URL` copiada
- [ ] Servicio API creado en Railway apuntando al `Dockerfile`
- [ ] Migraciones aplicadas en la BD de producción (`railway run pnpm db:migrate`)
- [ ] Servicio Web creado en Vercel apuntando a `apps/web`

### Variables de entorno
- [ ] `DATABASE_URL` en Railway (API)
- [ ] `BETTER_AUTH_SECRET` en Railway (API) — string aleatorio distinto al de testing
- [ ] `BETTER_AUTH_URL` en Railway (API) — URL del **web** de producción
- [ ] `WEB_URL` en Railway (API) — URL del web de producción
- [ ] `NEXT_PUBLIC_API_URL` en Vercel (Web) — URL de la API en Railway
- [ ] `ANTHROPIC_API_KEY` en Railway (API)

### Resend
- [ ] Dominio verificado en Resend
- [ ] `RESEND_API_KEY` en Railway (API)
- [ ] `FROM_EMAIL` en Railway (API) con dirección del dominio verificado

### Google OAuth
- [ ] URI de producción añadida en Google Cloud Console
- [ ] `GOOGLE_CLIENT_ID` en Railway (API)
- [ ] `GOOGLE_CLIENT_SECRET` en Railway (API)
- [ ] App de Google publicada (si se abre a usuarios fuera de la lista de test)

### Verificación final
- [ ] Login con email + contraseña funciona
- [ ] Email de verificación llega y el link redirige al dashboard
- [ ] Login con Google funciona
- [ ] Reset de contraseña funciona
