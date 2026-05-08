CREATE TYPE "public"."report_source" AS ENUM('ai', 'coach');--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD COLUMN "report_source" "report_source" DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_progress_report" ADD COLUMN "seen_at" timestamp with time zone;