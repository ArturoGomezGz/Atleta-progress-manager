// Primer import de src/mock/index.ts: el cliente de la base (@atleta/db/client) lee
// DATABASE_URL al importarse, así que tiene que quedar definido antes que cualquier
// otro módulo. postgres-js no conecta hasta la primera consulta, así que basta con
// conocer el puerto donde luego escuchará PGlite.

export const MOCK_PG_PORT = Number(process.env.MOCK_PG_PORT ?? 54329)

// max=1: PGlite es una sola sesión de Postgres. Con varias conexiones del pool en
// paralelo, pglite-socket intercala sus mensajes (prepared statements, transacciones)
// y las consultas concurrentes fallan. Con una sola conexión postgres-js las encola.
process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${MOCK_PG_PORT}/postgres?max=1`
process.env.BETTER_AUTH_SECRET ??= "mock-server-secret-no-usar-en-produccion-0123456789"
process.env.BETTER_AUTH_URL ??= "http://localhost:3001"
process.env.WEB_URL ??= "http://localhost:3000"
