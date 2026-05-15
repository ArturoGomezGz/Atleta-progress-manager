-- Agregar estado "scheduled" al enum de athlete_session (activación por atleta en entrenamiento)
--> statement-breakpoint
ALTER TYPE "public"."athlete_session_status" ADD VALUE IF NOT EXISTS 'scheduled';
--> statement-breakpoint
ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "athlete_session" ADD COLUMN IF NOT EXISTS "rpe" integer;
