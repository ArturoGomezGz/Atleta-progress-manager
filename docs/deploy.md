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
| `BETTER_AUTH_URL` | URL pública de la API (ej. `https://atleta-api.railway.app`) |
| `WEB_URL` | URL pública del web (ej. `https://atleta.vercel.app`) |
| `PORT` | `3001` |

> Railway expone automáticamente la URL pública en la variable `RAILWAY_PUBLIC_DOMAIN`. La URL final de la API será `https://<RAILWAY_PUBLIC_DOMAIN>`.

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

## Checklist de primer deploy a producción

- [ ] PostgreSQL creado en Railway y `DATABASE_URL` copiada
- [ ] Servicio API creado en Railway apuntando al `Dockerfile`
- [ ] Variables de entorno configuradas en Railway
- [ ] Migraciones aplicadas en la BD de producción
- [ ] Servicio Web creado en Vercel apuntando a `apps/web`
- [ ] `NEXT_PUBLIC_API_URL` configurada en Vercel apuntando a la URL de Railway
- [ ] `WEB_URL` en Railway actualizada con la URL de Vercel
- [ ] Verificar login en la URL de producción
