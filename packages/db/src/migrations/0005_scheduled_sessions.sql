-- Agregar estado "scheduled" y fecha programada a training_session

--> statement-breakpoint
ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'scheduled';

--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN IF NOT EXISTS "scheduled_date" date;
