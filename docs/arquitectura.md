# Arquitectura del proyecto

## Visión general

Monorepo con `pnpm workspaces` dividido en dos aplicaciones y un paquete compartido.

```
cmw-atleta/
├── apps/
│   ├── web/      Next.js 15 — frontend del entrenador y atleta
│   └── api/      Fastify 5 — backend REST/tRPC + autenticación
├── packages/
│   └── db/       Drizzle ORM — schema, migraciones y cliente de BD
├── docker-compose.yml
└── package.json  (pnpm workspaces root)
```

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| Backend | Fastify 5 + TypeScript |
| API layer | tRPC v11 (tipado end-to-end) |
| Autenticación | better-auth v1 |
| ORM | Drizzle ORM |
| Base de datos | PostgreSQL 16 |
| Runtime | tsx (transpilación en tiempo de ejecución) |
| Deploy API | Railway |
| Deploy Web | Vercel |
| Dev local BD | Docker Compose |

## Flujo de datos

```
Browser (Next.js)
  │
  ├── better-auth client  →  POST /api/auth/*  →  Fastify  →  better-auth handler
  │
  └── tRPC client         →  POST /trpc/*      →  Fastify  →  tRPC router
                                                               │
                                                               ├── verifica sesión (better-auth)
                                                               ├── verifica rol (assertCoach / assertMember)
                                                               └── Drizzle ORM  →  PostgreSQL
```

## Roles

| Rol | Acceso |
|---|---|
| `coach` | Crear/gestionar rutinas, ejecutar sesiones, registrar series, ver progreso de todos los atletas del equipo |
| `athlete` | Ver únicamente su propio progreso |

Los roles son por equipo — un usuario puede ser coach en un equipo y atleta en otro.

## Comunicación web ↔ API

- **Autenticación**: `better-auth` en el cliente llama directamente a `/api/auth/*` en el backend. Las cookies `httpOnly` se gestionan automáticamente.
- **Datos**: `tRPC` con `httpBatchLink` bajo `/trpc/*`. Todas las llamadas incluyen la cookie de sesión (`credentials: "include"`).
- **Tipos compartidos**: `AppRouter` se exporta desde `@atleta/api` y se importa en el web como tipo, garantizando tipado end-to-end sin schemas duplicados.
