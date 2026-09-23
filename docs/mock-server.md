# Servidor mock

Levanta la aplicación completa (web + API) **sin PostgreSQL, sin Docker y sin variables de entorno**, con datos de prueba ya cargados. Sirve para revisar cambios de UI rápido, en local o en un despliegue de preview.

```bash
pnpm install
pnpm dev:mock        # web en http://localhost:3000 · API mock en :3001
```

Ctrl+C apaga los dos procesos. Cada arranque parte de cero: lo que se cree o edite se pierde al reiniciar.

## Cómo funciona

No es una API falsa: es la **API real** (`apps/api`) corriendo sobre [PGlite](https://pglite.dev), Postgres compilado a WASM que vive en memoria dentro del proceso.

```
pnpm dev:mock  (scripts/mock/run.mjs)
  ├── API mock  (apps/api/src/mock/index.ts)
  │     ├── PGlite en memoria, expuesto por el protocolo de Postgres en 127.0.0.1:54329
  │     ├── migraciones de Drizzle + packages/db/sql/02–04 (catálogos, cuentas, 638 ejercicios)
  │     ├── datos mock (apps/api/src/mock/seed.ts)
  │     └── src/index.ts sin cambios: Fastify + tRPC + better-auth en :3001
  └── web  (next dev | next start) con NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
```

Como Drizzle, better-auth y los routers son los de siempre, todo lo que se pruebe en el mock se comporta igual que con la base real: login, crear plantillas, iniciar sesiones, registrar series.

> La API se conecta con **una sola conexión** (`?max=1` en `DATABASE_URL`, ver `apps/api/src/mock/env.ts`). PGlite es una única sesión de Postgres y, con varias conexiones en paralelo, `pglite-socket` intercala sus mensajes y las consultas concurrentes fallan.

## Cuentas

| Correo | Contraseña | Rol en el equipo Neo |
|---|---|---|
| `arturogomezgz04@gmail.com` | `admin` | Coach |
| `tester@gmail.com` | `12345678` | Atleta |
| `abuela@gmail.com` | `12345678` | Atleta |
| `diego@atleta.dev` | `12345678` | Atleta (solo mock) |
| `sofia@atleta.dev` | `12345678` | Atleta (solo mock) |
| `coach@atleta.com` | `12345678` | Cuenta del sistema, dueña del catálogo público |

## Datos mock

Las plantillas están pensadas para cubrir cada combinación de [zonas corporales](./ejercicios-schema.md#10-sistema-de-color-por-zona-corporal):

| Plantilla | Reparto por series |
|---|---|
| pierna pesada | Inferior 100 % |
| pierna + acondicionamiento | Inferior 63 % · Full body 38 % |
| torso empuje y jalón | Superior 100 % |
| core y estabilidad | Core 86 % · Full body 14 % |
| full body metabólico (circuito) | Full body 67 % · Inferior 22 % · Core 11 % |
| mixta tren superior e inferior | Superior 50 % · Inferior 38 % · Core 13 % |
| evaluación de fuerza (%RM) | Inferior 67 % · Superior 33 % |

Sesiones: en curso con series ya registradas, programadas para los próximos días, completadas (con series y RMs de la evaluación) y una cancelada, repartidas entre los cuatro atletas. Para cambiarlas, edita `ROUTINES` y `SESSIONS` en `apps/api/src/mock/seed.ts`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev:mock` | API mock + `next dev` (recarga en caliente de la web) |
| `pnpm mock:api` | Solo la API mock en `:3001`, para usarla con un `pnpm dev:web` propio (`NEXT_PUBLIC_API_URL=http://localhost:3001`) |
| `node scripts/mock/run.mjs start` | API mock + `next start`; requiere `next build` previo. Es lo que ejecuta el contenedor |

Variables opcionales: `PORT` (web, 3000), `MOCK_API_PORT` (3001), `MOCK_PG_PORT` (54329), `PUBLIC_URL` (URL pública de la web; en Railway se toma de `RAILWAY_PUBLIC_DOMAIN`).

## Despliegue de preview

`Dockerfile.mock` empaqueta web + API mock en **un solo contenedor** que solo expone la web (la web proxea `/trpc` y `/api/auth` a la API interna). No necesita base de datos ni variables.

```bash
docker build -f Dockerfile.mock -t atleta-mock .
docker run -p 3000:3000 atleta-mock
```

### En Railway

1. En el proyecto: **New → GitHub Repo** y elige este repositorio (o un servicio nuevo en un entorno aparte).
2. **Settings → Source**: la rama que quieras previsualizar.
3. **Variables**: `RAILWAY_DOCKERFILE_PATH=Dockerfile.mock`. No hace falta nada más: `PORT` y `RAILWAY_PUBLIC_DOMAIN` los pone Railway.
4. **Settings → Networking → Generate Domain**.

Cada push a esa rama reconstruye el preview con datos frescos. El servicio **no toca** la base ni la API de producción.

> Las cuentas de prueba tienen contraseñas públicas (están en este documento). No uses el mock para datos reales.
