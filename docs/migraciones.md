# Migraciones — Guía y flujo de trabajo

---

## Cómo funciona el sistema de migraciones

Usamos **Drizzle ORM** con migraciones generadas automáticamente por `drizzle-kit generate` a partir del schema TypeScript.

### Archivos relevantes

| Archivo | Descripción |
|---|---|
| `packages/db/src/schema/*.ts` | Fuente de verdad — aquí se define el schema |
| `packages/db/src/migrations/*.sql` | Archivos SQL generados por drizzle-kit |
| `packages/db/src/migrations/meta/_journal.json` | Índice que Drizzle usa para saber qué migraciones existen |
| `packages/db/src/migrate.ts` | Script que corre las migraciones + seeds |

### Cómo Drizzle rastrea migraciones aplicadas

Drizzle mantiene una tabla `__drizzle_migrations` en la base de datos con dos columnas:

| Columna | Descripción |
|---|---|
| `hash` | SHA-256 del contenido raw del archivo `.sql` |
| `created_at` | Timestamp del campo `when` del journal |

Al correr `pnpm db:migrate`, Drizzle:
1. Lee `meta/_journal.json` para saber qué migraciones existen
2. Hashea el contenido de cada `.sql`
3. Compara contra los hashes en `__drizzle_migrations`
4. Solo corre las migraciones no registradas
5. Registra cada migración aplicada en la misma transacción

---

## Flujo para agregar cambios al schema

```
1. Modificar packages/db/src/schema/*.ts

2. Generar la migración:
   pnpm --filter @atleta/db generate

   drizzle-kit detecta el diff entre el snapshot anterior y el schema actual,
   genera el SQL y actualiza el journal automáticamente.

3. Revisar el archivo .sql generado en packages/db/src/migrations/

4. Commit + push → Railway corre pnpm db:migrate en pre-deploy
```

**Nunca escribir SQL a mano ni editar el journal directamente.**

---

## Resetear un entorno desde cero

Si la DB no tiene historial de migraciones (entorno nuevo, reset manual):

1. Borrar y recrear el servicio PostgreSQL en Railway
2. Actualizar `DATABASE_URL` en el servicio API si cambia
3. El próximo deploy aplica todas las migraciones desde `0000` → DB queda en estado correcto

No se necesita ningún script especial — Drizzle construye el schema completo desde cero.

---

## Correr migraciones manualmente contra Railway

```powershell
# Opción A — con el DATABASE_URL de Railway en la variable de entorno
$env:DATABASE_URL="postgresql://..." ; pnpm db:migrate

# Opción B — via Railway CLI
railway run --service <nombre-api> pnpm db:migrate
```

El `DATABASE_URL` se encuentra en Railway → servicio PostgreSQL → pestaña **Variables**.

---

## Historial

**Mayo 2026** — Se colapsaron las 18 migraciones manuales (0000–0017) en una sola migración generada por drizzle-kit (`0000_material_blue_marvel.sql`). La causa raíz era que las migraciones escritas a mano requerían mantener el journal sincronizado manualmente y usar sintaxis específica de Drizzle, lo que generaba fallos frecuentes en nuevos entornos. El nuevo flujo delega todo esto a drizzle-kit.
