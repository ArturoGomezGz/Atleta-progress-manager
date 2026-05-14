-- Eliminar sistema antiguo de sesiones asignadas
-- Las tablas nuevas (training_session, athlete_session, set_record) permanecen intactas

--> statement-breakpoint
DROP TABLE IF EXISTS "athlete_set_completion";

--> statement-breakpoint
DROP TABLE IF EXISTS "athlete_session_execution";

--> statement-breakpoint
DROP TABLE IF EXISTS "assigned_session";

--> statement-breakpoint
DROP TYPE IF EXISTS "public"."assigned_session_status";

--> statement-breakpoint
DROP TYPE IF EXISTS "public"."athlete_session_execution_status";
