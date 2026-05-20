-- Nuevos campos en athlete_session para seguimiento por atleta
-- (ALTER TYPE 'scheduled' se aplica fuera de transacción en migrate.ts)
--> statement-breakpoint
ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "rpe" integer;
