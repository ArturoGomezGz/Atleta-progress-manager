CREATE TYPE "public"."rm_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "athlete_exercise_rm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"rm_lbs" numeric(6, 2) NOT NULL,
	"source" "rm_source" NOT NULL,
	"session_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_athlete_id_user_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_exercise_rm" ADD CONSTRAINT "athlete_exercise_rm_session_id_training_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_session"("id") ON DELETE set null ON UPDATE no action;
