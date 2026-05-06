# Setup local

## Requisitos

- Node.js 22+
- pnpm (`corepack enable pnpm`)
- Docker Desktop

## Primera vez

### 1. Levantar la base de datos

```bash
docker compose up -d
```

### 2. Variables de entorno

```bash
# API
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env y cambiar BETTER_AUTH_SECRET por un string largo

# DB (ya está listo con las credenciales del docker-compose)
cp packages/db/.env.example packages/db/.env
```

`apps/api/.env`:
```
DATABASE_URL=postgresql://atleta:atleta@localhost:5432/atleta
BETTER_AUTH_SECRET=<string-aleatorio-min-32-caracteres>
BETTER_AUTH_URL=http://localhost:3001
WEB_URL=http://localhost:3000
PORT=3001
```

`apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Migraciones

```bash
pnpm db:generate   # genera los archivos SQL desde el schema
pnpm db:migrate    # aplica las migraciones a la BD
```

### 5. Seed (datos de ejemplo)

Requiere que la API esté corriendo (paso 6).

```bash
pnpm db:seed
```

Crea:
- `coach@atleta.dev` / `atleta123` — entrenador
- `atleta1@atleta.dev` / `atleta123` — atleta
- `atleta2@atleta.dev` / `atleta123` — atleta
- Equipo "Equipo Demo" con los tres usuarios
- Catálogo de 7 ejercicios
- Rutina "Rutina A — Fuerza" con 3 ejercicios

### 6. Levantar aplicaciones

```bash
# Terminal 1
pnpm dev:api    # API en http://localhost:3001

# Terminal 2
pnpm dev:web    # Web en http://localhost:3000
```

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `pnpm dev:api` | API con hot reload (tsx watch) |
| `pnpm dev:web` | Web con hot reload (Next.js) |
| `pnpm db:generate` | Genera migraciones desde el schema Drizzle |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:seed` | Pobla la BD con datos de ejemplo |
| `pnpm db:studio` | Abre Drizzle Studio (explorador visual de BD) |

---

## Docker

### Solo base de datos (desarrollo local)
```bash
docker compose up -d       # levantar
docker compose down        # detener
docker compose down -v     # detener y borrar datos
```

### API en Docker (opcional, o para Railway)
El `Dockerfile` de la API está en `apps/api/Dockerfile`.
Se construye desde la raíz del monorepo:

```bash
docker build -f apps/api/Dockerfile -t atleta-api .
docker run -p 3001:3001 --env-file apps/api/.env atleta-api
```
