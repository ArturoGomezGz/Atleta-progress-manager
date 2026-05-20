import { sql } from "drizzle-orm"
import { db } from "@atleta/db/client"

/**
 * Elimina todos los datos de negocio antes de cada test de integración.
 * Las tablas de catálogo (muscle_group, muscle, equipment) no se tocan.
 * El CASCADE de PostgreSQL propaga la limpieza a todas las tablas dependientes.
 */
export async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE "user", "team", "exercise"
    CASCADE
  `)
}
