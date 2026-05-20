CREATE TYPE "public"."load_type" AS ENUM('fixed_kg', 'percent_rm', 'rpe');--> statement-breakpoint
CREATE TYPE "public"."set_type" AS ENUM('reps', 'time');--> statement-breakpoint
ALTER TABLE "routine_set_target" ADD COLUMN "set_type" "set_type" DEFAULT 'reps' NOT NULL;--> statement-breakpoint
ALTER TABLE "routine_set_target" ADD COLUMN "target_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "routine_set_target" ADD COLUMN "load_type" "load_type";--> statement-breakpoint
ALTER TABLE "routine_set_target" ADD COLUMN "load_value" numeric(7, 2);