CREATE TYPE "public"."exercise_objective" AS ENUM('strength', 'hypertrophy', 'endurance', 'power', 'cardio', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."routine_type" AS ENUM('sequential', 'circuit');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('normal', 'evaluation');--> statement-breakpoint
ALTER TYPE "public"."athlete_session_status" ADD VALUE 'completed' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "session_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_session_id" uuid NOT NULL,
	"effort" integer,
	"mood" integer,
	"notes" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_feedback_athlete_session_id_unique" UNIQUE("athlete_session_id")
);
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "type" "routine_type" DEFAULT 'sequential' NOT NULL;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "rounds" integer;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN "target_sets" integer;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN "objective" "exercise_objective";--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN "tempo" text;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD COLUMN "rest_between_sets_seconds" integer;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "session_type" "session_type" DEFAULT 'evaluation' NOT NULL;--> statement-breakpoint
ALTER TABLE "training_session" ADD COLUMN "scheduled_date" date;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_athlete_session_id_athlete_session_id_fk" FOREIGN KEY ("athlete_session_id") REFERENCES "public"."athlete_session"("id") ON DELETE cascade ON UPDATE no action;