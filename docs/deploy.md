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
| `GOOGLE_CLIENT_ID` | Client ID del OAuth 2.0 de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret del OAuth 2.0 de Google Cloud Console |
| `ANTHROPIC_API_KEY` | API key de Anthropic |

> **`BETTER_AUTH_URL` debe ser la URL del web, no de la API.** El web proxea `/api/auth/*` hacia la API. El estado OAuth se almacena en una cookie del dominio web — si el callback apunta directamente a la API (diferente dominio), la cookie no existe y Google devuelve `state_mismatch`. Apuntando al web, el callback pasa por el proxy y la cookie está disponible.

### Migraciones en producción

Las migraciones **no corren automáticamente**. Hay dos opciones:

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
