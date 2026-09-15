import { db } from "@atleta/db/client"
import { sql } from "drizzle-orm"

/**
 * Recalcula `exercise_stats` a partir de la interacción que el producto ya registra:
 * uso en sesiones reales, consumación de series, cancelaciones en vivo, inclusión en
 * rutinas, guardados y reacciones explícitas.
 *
 * Es una sola sentencia: leer, agregar y reescribir ocurren dentro de Postgres sin
 * traer filas al proceso de Node.
 */

// Ventana para las señales que son eventos con fecha (uso, consumación, cancelación).
// Las señales de estado —guardados, reacciones, inclusión en rutina— se cuentan completas:
// la fila existe porque esa sigue siendo la postura del usuario hoy, no porque pasó algo.
const WINDOW_DAYS = 180

// Observaciones necesarias para dejar de creerle al promedio global y creerle al ejercicio.
const M_SESSIONS = 20
const M_REACTIONS = 5

// Nivel de adopción (coaches únicos + guardados) en el que el empuje satura.
const ADOPTION_REF = 50

const W_QUALITY = 0.45
const W_REACTION = 0.25
const W_ADOPTION = 0.30
const CANCEL_WEIGHT = 0.5

// Un ejercicio se marca "recomendado" solo si además lo adoptaron varios coaches distintos
// y no arrastra reportes de defecto sin resolver.
const SCORE_THRESHOLD = 0.6
const MIN_COACHES = 3

export type ExerciseStatsRefresh = { rows: number; durationMs: number }

export async function refreshExerciseStats(): Promise<ExerciseStatsRefresh> {
  const startedAt = Date.now()

  const result = await db.execute(sql`
    WITH session_use AS (
      SELECT se.exercise_id, se.id AS session_exercise_id
      FROM session_exercise se
      JOIN training_session ts ON ts.id = se.session_id
      WHERE ts.started_at >= now() - make_interval(days => ${WINDOW_DAYS})
    ),
    completed AS (
      SELECT DISTINCT session_exercise_id FROM set_record WHERE status = 'valid'
    ),
    cancelled AS (
      SELECT DISTINCT session_exercise_id FROM athlete_session_exercise_cancelled
    ),
    session_agg AS (
      SELECT
        su.exercise_id,
        COUNT(*)::int AS session_uses,
        COUNT(*) FILTER (WHERE c.session_exercise_id IS NOT NULL)::int AS completed_uses,
        COUNT(*) FILTER (WHERE x.session_exercise_id IS NOT NULL)::int AS cancelled_uses
      FROM session_use su
      LEFT JOIN completed c ON c.session_exercise_id = su.session_exercise_id
      LEFT JOIN cancelled x ON x.session_exercise_id = su.session_exercise_id
      GROUP BY su.exercise_id
    ),

    -- Los ejercicios viven dentro de routine.content (jsonb), sueltos o anidados en circuitos.
    -- Se juntan ambos niveles en un solo arreglo antes de expandir: dos laterales anidados
    -- hacen que el planificador estime 100x100 filas por rutina y dimensione el sort para
    -- millones de filas que no existen. jsonpath en modo lax además ignora un content
    -- malformado en lugar de reventar, y se compara como texto para no castear a uuid.
    routine_ref AS (
      SELECT r.created_by, r.id AS routine_id, eid AS exercise_id
      FROM routine r
      CROSS JOIN LATERAL jsonb_array_elements_text(
        COALESCE(jsonb_path_query_array(r.content, '$.items[*].exerciseId'), '[]'::jsonb)
        || COALESCE(jsonb_path_query_array(r.content, '$.items[*].exercises[*].exerciseId'), '[]'::jsonb)
      ) AS eid
    ),
    routine_agg AS (
      SELECT
        exercise_id,
        COUNT(DISTINCT created_by)::int AS unique_coaches,
        COUNT(DISTINCT routine_id)::int AS unique_routines
      FROM routine_ref
      GROUP BY exercise_id
    ),

    save_agg AS (
      SELECT exercise_id, COUNT(*)::int AS saves FROM exercise_save GROUP BY exercise_id
    ),

    reaction_agg AS (
      SELECT
        exercise_id,
        COUNT(*) FILTER (WHERE value = 'positive')::int AS positive_reactions,
        COUNT(*) FILTER (WHERE value = 'negative')::int AS negative_reactions,
        -- Solo los motivos que describen un defecto del contenido cuentan como reporte.
        -- "no_me_sirve" y "otro" son opinión: pesan en el score, no bloquean el ejercicio.
        COUNT(*) FILTER (
          WHERE resolved_at IS NULL
            AND reason IN ('video_roto', 'video_no_corresponde', 'datos_incorrectos', 'duplicado')
        )::int AS open_reports
      FROM exercise_reaction
      GROUP BY exercise_id
    ),

    -- Tasa media de consumación del catálogo: el prior al que caen los ejercicios sin historia
    global AS (
      SELECT COALESCE(SUM(completed_uses)::float8 / NULLIF(SUM(session_uses), 0), 0.5) AS c
      FROM session_agg
    ),

    computed AS (
      SELECT
        e.id AS exercise_id,
        e.is_public,
        COALESCE(ra.unique_coaches, 0) AS unique_coaches,
        COALESCE(ra.unique_routines, 0) AS unique_routines,
        COALESCE(sa.session_uses, 0) AS session_uses,
        COALESCE(sa.completed_uses, 0) AS completed_uses,
        COALESCE(sa.cancelled_uses, 0) AS cancelled_uses,
        COALESCE(sv.saves, 0) AS saves,
        COALESCE(re.positive_reactions, 0) AS positive_reactions,
        COALESCE(re.negative_reactions, 0) AS negative_reactions,
        COALESCE(re.open_reports, 0) AS open_reports,

        -- Calidad: proporción de veces que el ejercicio se programó y terminó ejecutándose,
        -- corrida hacia la media global mientras haya pocas observaciones
        (
          (COALESCE(sa.session_uses, 0)::float8 / (COALESCE(sa.session_uses, 0) + ${M_SESSIONS}))
          * CASE WHEN COALESCE(sa.session_uses, 0) = 0 THEN 0
                 ELSE COALESCE(sa.completed_uses, 0)::float8 / sa.session_uses END
          + (${M_SESSIONS}::float8 / (COALESCE(sa.session_uses, 0) + ${M_SESSIONS})) * g.c
        ) AS quality,

        -- Opinión explícita, con el mismo tratamiento bayesiano y prior neutro en 0.5
        (
          ((COALESCE(re.positive_reactions, 0) + COALESCE(re.negative_reactions, 0))::float8
            / (COALESCE(re.positive_reactions, 0) + COALESCE(re.negative_reactions, 0) + ${M_REACTIONS}))
          * CASE WHEN COALESCE(re.positive_reactions, 0) + COALESCE(re.negative_reactions, 0) = 0 THEN 0
                 ELSE COALESCE(re.positive_reactions, 0)::float8
                      / (COALESCE(re.positive_reactions, 0) + COALESCE(re.negative_reactions, 0)) END
          + (${M_REACTIONS}::float8
            / (COALESCE(re.positive_reactions, 0) + COALESCE(re.negative_reactions, 0) + ${M_REACTIONS})) * 0.5
        ) AS reaction,

        -- Adopción logarítmica: el décimo coach aporta mucho menos que el segundo
        LEAST(
          1.0,
          ln(1 + COALESCE(ra.unique_coaches, 0) + COALESCE(sv.saves, 0))::float8 / ln(1 + ${ADOPTION_REF}::float8)
        ) AS adoption,

        CASE WHEN COALESCE(sa.session_uses, 0) = 0 THEN 0
             ELSE COALESCE(sa.cancelled_uses, 0)::float8 / sa.session_uses END AS cancel_rate
      FROM exercise e
      LEFT JOIN session_agg sa ON sa.exercise_id = e.id
      LEFT JOIN routine_agg ra ON ra.exercise_id = e.id::text
      LEFT JOIN save_agg sv ON sv.exercise_id = e.id
      LEFT JOIN reaction_agg re ON re.exercise_id = e.id
      CROSS JOIN global g
      WHERE e.deleted_at IS NULL
    ),

    scored AS (
      SELECT
        c.*,
        GREATEST(0, LEAST(1,
          (${W_QUALITY} * c.quality + ${W_REACTION} * c.reaction + ${W_ADOPTION} * c.adoption)
          * (1 - ${CANCEL_WEIGHT} * c.cancel_rate)
        )) AS score
      FROM computed c
    )

    INSERT INTO exercise_stats (
      exercise_id, unique_coaches, unique_routines, session_uses, completed_uses,
      cancelled_uses, saves, positive_reactions, negative_reactions, open_reports,
      score, is_recommended, window_days, last_computed_at
    )
    SELECT
      s.exercise_id, s.unique_coaches, s.unique_routines, s.session_uses, s.completed_uses,
      s.cancelled_uses, s.saves, s.positive_reactions, s.negative_reactions, s.open_reports,
      s.score,
      -- Solo el catálogo público se recomienda: los conteos de un ejercicio de equipo
      -- delatarían la actividad de ese equipo al resto de la plataforma
      (s.is_public AND s.score >= ${SCORE_THRESHOLD} AND s.unique_coaches >= ${MIN_COACHES} AND s.open_reports = 0),
      ${WINDOW_DAYS},
      now()
    FROM scored s
    ON CONFLICT (exercise_id) DO UPDATE SET
      unique_coaches     = EXCLUDED.unique_coaches,
      unique_routines    = EXCLUDED.unique_routines,
      session_uses       = EXCLUDED.session_uses,
      completed_uses     = EXCLUDED.completed_uses,
      cancelled_uses     = EXCLUDED.cancelled_uses,
      saves              = EXCLUDED.saves,
      positive_reactions = EXCLUDED.positive_reactions,
      negative_reactions = EXCLUDED.negative_reactions,
      open_reports       = EXCLUDED.open_reports,
      score              = EXCLUDED.score,
      is_recommended     = EXCLUDED.is_recommended,
      window_days        = EXCLUDED.window_days,
      last_computed_at   = EXCLUDED.last_computed_at
  `)

  return { rows: result.count ?? 0, durationMs: Date.now() - startedAt }
}
