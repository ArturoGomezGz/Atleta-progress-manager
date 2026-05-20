-- Agregar estado "completed" al enum de athlete_session para que el atleta pueda marcar su sesión
--> statement-breakpoint
ALTER TYPE "public"."athlete_session_status" ADD VALUE IF NOT EXISTS 'completed';
